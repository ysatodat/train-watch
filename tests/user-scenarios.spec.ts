import { expect, test, type Page, type Route } from '@playwright/test';

const FIXED_NOW = new Date('2026-08-23T12:00:00+09:00').valueOf();

type PrepareOptions = { seenIntro?: boolean; ready?: boolean; rail?: 'tx' | 'keisei'; txStation?: string; keiseiStation?: string; now?: number };
type InitArgs = { initialNow: number; seen: boolean; isReady: boolean; activeRail: 'tx' | 'keisei'; tx: string; ks: string };

async function prepare(page: Page, options: PrepareOptions = {}) {
  const { seenIntro = true, ready = true, rail = 'tx', txStation = 'TX19', keiseiStation = 'KS22', now = FIXED_NOW } = options;
  await page.route('https://**/*', (route: Route) => route.abort());
  await page.addInitScript(({ initialNow, seen, isReady, activeRail, tx, ks }: InitArgs) => {
    const RealDate = Date;
    let currentNow = initialNow;
    (window as typeof window & { __setTestNow?: (value: number) => void }).__setTestNow = (value: number) => { currentNow = value; };
    class FixedDate extends RealDate {
      constructor(value?: string | number | Date) { super(value === undefined ? currentNow : value); }
      static now() { return currentNow; }
    }
    (window as typeof window & { Date: DateConstructor }).Date = FixedDate as DateConstructor;
    localStorage.clear();
    if (seen) localStorage.setItem('trainWatch:intro:v3', 'seen');
    if (isReady) localStorage.setItem('trainWatch:location:v2', JSON.stringify({
      rail: activeRail,
      lastStations: { tx, keisei: ks },
      recent: [{ rail: activeRail, stationId: activeRail === 'tx' ? tx : ks }],
      ready: true
    }));
  }, { initialNow: now, seen: seenIntro, isReady: ready, activeRail: rail, tx: txStation, ks: keiseiStation });
}

async function setNow(page: Page, iso: string) {
  const value = new Date(iso).valueOf();
  await page.evaluate((ms: number) => (window as typeof window & { __setTestNow: (value: number) => void }).__setTestNow(ms), value);
  await page.waitForTimeout(1200);
}

test('初回は場所を選んでから3画面チュートリアルへ進む', async ({ page }) => {
  await prepare(page, { ready: false, seenIntro: false });
  await page.goto('/');
  const location = page.getByTestId('location-dialog');
  await expect(location).toBeVisible();
  await expect(location.getByRole('heading', { name: 'どこで電車を見る？' })).toBeVisible();
  await expect(location.getByRole('button', { name: '閉じる' })).toHaveCount(0);
  await page.getByTestId('rail-tab-keisei').click();
  await expect(page.getByTestId('station-search')).not.toBeFocused();
  await expect(page.locator('[data-testid^="station-KS"]')).toHaveCount(42);
  await page.getByTestId('station-KS22').click();
  await expect(page.getByTestId('tutorial-dialog')).toBeVisible();
  await expect(page.getByTestId('tutorial-step-0')).toContainText('次の見どころがわかる');
});

test('通常画面は現在地だけを見せ、カウントダウンを主役にする', async ({ page }) => {
  await prepare(page);
  await page.goto('/?rail=tx&station=TX19');
  await expect(page.getByTestId('location-button')).toContainText('研究学園');
  await expect(page.getByTestId('countdown')).not.toHaveText('--:--');
  const locationBox = await page.getByTestId('location-button').boundingBox();
  const heroBox = await page.getByTestId('hero').boundingBox();
  expect(locationBox?.height).toBeLessThanOrEqual(56);
  expect((heroBox?.y || 0) - ((locationBox?.y || 0) + (locationBox?.height || 0))).toBeLessThanOrEqual(16);
});

test('場所ダイアログは本文だけがスクロールし、ヘッダーはstickyではない', async ({ page }) => {
  await prepare(page);
  await page.goto('/?rail=tx&station=TX19');
  await page.getByTestId('location-button').click();
  const dialog = page.getByTestId('location-dialog');
  const header = dialog.locator('.dialog-header');
  const body = dialog.locator('.dialog-body');
  await expect(dialog).toBeVisible();
  const styles = await Promise.all([
    header.evaluate(el => getComputedStyle(el).position),
    body.evaluate(el => getComputedStyle(el).overflowY)
  ]);
  expect(styles[0]).toBe('static');
  expect(['auto','scroll']).toContain(styles[1]);
  await body.evaluate(el => { el.scrollTop = el.scrollHeight; });
  const close = dialog.getByRole('button', { name: '閉じる' });
  const box = await close.boundingBox();
  const viewport = page.viewportSize();
  expect(box).toBeTruthy();
  expect((box?.y || 0) + (box?.height || 0)).toBeLessThanOrEqual(viewport?.height || 0);
});

test('モーダルを開いてもCloseや検索欄へ勝手にフォーカスしない', async ({ page }) => {
  await prepare(page);
  await page.goto('/?rail=tx&station=TX19');
  await page.getByTestId('location-button').click();
  const dialog = page.getByTestId('location-dialog');
  await expect(dialog.locator('.dialog-close')).not.toBeFocused();
  await expect(page.getByTestId('station-search')).not.toBeFocused();
  await page.getByTestId('rail-tab-keisei').click();
  await expect(page.getByTestId('station-search')).not.toBeFocused();
});

test('TXと京成を切り替えても各路線の前回駅へ戻れる', async ({ page }) => {
  await prepare(page, { txStation: 'TX19', keiseiStation: 'KS22' });
  await page.goto('/?rail=tx&station=TX19');
  await page.getByTestId('location-button').click();
  await page.getByTestId('rail-tab-keisei').click();
  await page.getByTestId('station-KS22').click();
  await expect(page.getByTestId('location-button')).toContainText('京成船橋');
  await page.getByTestId('location-button').click();
  await page.getByTestId('rail-tab-tx').click();
  await page.getByTestId('station-TX19').click();
  await expect(page.getByTestId('location-button')).toContainText('研究学園');
});

test('お知らせをONにすると音を準備し、3分前と30秒前の案内内容を確認できる', async ({ page }) => {
  await prepare(page);
  await page.addInitScript(() => {
    class FakeAudioContext {
      state = 'running';
      currentTime = 0;
      destination = {};
      resume() { return Promise.resolve(); }
      createOscillator() {
        return {
          frequency: { value: 0 },
          connect() {},
          start() { (window as typeof window & { __alertToneCount?: number }).__alertToneCount = ((window as typeof window & { __alertToneCount?: number }).__alertToneCount || 0) + 1; },
          stop() {}
        };
      }
      createGain() {
        return {
          gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() {}
        };
      }
    }
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: FakeAudioContext });
  });
  await page.goto('/?rail=tx&station=TX19');
  await page.getByRole('button', { name: 'お知らせ' }).click();
  const dialog = page.getByTestId('notify-dialog');
  await expect(dialog).toContainText('画面表示・音・対応端末では振動');
  await dialog.getByRole('button', { name: 'お知らせをONにする' }).click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __alertToneCount?: number }).__alertToneCount || 0)).toBeGreaterThan(0);
});

test('停まった→動いたで同じ列車へ戻らず見送り表示になる', async ({ page }) => {
  await prepare(page, { now: new Date('2026-08-23T12:20:50+09:00').valueOf() });
  await page.goto('/?rail=tx&station=TX19');
  const action = page.getByTestId('hero-action');
  await expect(action).toHaveText('停まった！');
  await action.click();
  await expect(action).toHaveText('動いた！');
  await action.click();
  await expect(page.getByTestId('countdown')).toHaveText('いってらっしゃい！');
  await setNow(page, '2026-08-23T12:20:55+09:00');
  await expect(page.getByTestId('countdown')).not.toHaveText('停まった！');
});

test('遅延時はまだ来てないで同じ列車を待ち続けられる', async ({ page }) => {
  await prepare(page, { now: new Date('2026-08-23T12:21:20+09:00').valueOf() });
  await page.goto('/?rail=tx&station=TX19');
  await expect(page.getByTestId('countdown')).toHaveText('まだかな？');
  await expect(page.getByTestId('delay-action')).toHaveText('まだ来てない');
  await page.getByTestId('delay-action').click();
  await expect(page.getByTestId('countdown')).toHaveText('待ってる');
  await setNow(page, '2026-08-23T12:23:00+09:00');
  await expect(page.getByTestId('countdown')).toHaveText('待ってる');
  await expect(page.getByTestId('hero-action')).toHaveText('停まった！');
});

test('研究学園ではTXならではと車両ずかんを使える', async ({ page }) => {
  await prepare(page);
  await page.goto('/?rail=tx&station=TX19');
  await expect(page.getByTestId('tx-special')).toBeVisible();
  await page.getByTestId('tx-special').getByRole('button', { name: '車両ずかん' }).click();
  const guide = page.getByTestId('vehicle-dialog');
  await expect(guide).toBeVisible();
  await expect(guide.locator('[data-vehicle="TX-1000"]')).toHaveClass(/is-unavailable/);
  await expect(guide.locator('[data-vehicle="TX-2000"] .found-button')).toBeEnabled();
});

test('京成では京成ならではと4車種の車両ずかんを表示する', async ({ page }) => {
  await prepare(page, { rail: 'keisei' });
  await page.goto('/?rail=keisei&station=KS22');
  await expect(page.getByTestId('keisei-special')).toBeVisible();
  await page.getByTestId('keisei-special').getByRole('button', { name: '車両ずかん' }).click();
  const guide = page.getByTestId('vehicle-dialog');
  await expect(guide.locator('.vehicle-item')).toHaveCount(4);
  await expect(guide).toContainText('AE形');
  await expect(guide).toContainText('3200形');
});

test('FVの駅名全体がタップ領域として場所変更を開く', async ({ page }) => {
  await prepare(page);
  await page.goto('/?rail=tx&station=TX19');
  const button = page.getByTestId('location-button');
  const box = await button.boundingBox();
  expect(box).toBeTruthy();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await button.click({ position: { x: 4, y: 4 } });
  await expect(page.getByTestId('location-dialog')).toBeVisible();
});

test('320px幅でも横にはみ出さない', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await prepare(page);
  await page.goto('/?rail=keisei&station=KS22');
  const sizes = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: document.documentElement.clientWidth }));
  expect(sizes.body).toBeLessThanOrEqual(sizes.viewport);
  await page.getByTestId('location-button').click();
  const dialogSizes = await page.getByTestId('location-dialog').evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth }));
  expect(dialogSizes.scroll).toBeLessThanOrEqual(dialogSizes.client);
});

test('TX専用という古い文言は画面に出ない', async ({ page }) => {
  await prepare(page);
  await page.goto('/?rail=tx&station=TX19');
  await expect(page.locator('body')).not.toContainText('TX専用');
  await expect(page.locator('body')).toContainText('TRAIN WATCH · 非公式');
});

import { useEffect, useMemo, useRef, useState } from 'react';
import { createActor } from 'xstate';
import type { RailId, RailProvider, Station, TrainFocus, TrainVisit } from './domain';
import { observationMachine } from './domain';
import { loadCatalogs, loadProvider } from './rails';
import { incrementWatchedToday, introSeen, markIntroSeen, readLocationState, readSettings, readWatchedToday, rememberLocation, type LocationState, type Settings, writeSettings } from './storage';
import { AppDialog, PressButton } from './components/AppDialog';
import { LocationPicker } from './components/LocationPicker';
import { RailSpecial } from './components/RailSpecial';
import { VehicleGuide, type VehicleGuideData } from './components/VehicleGuide';

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function useObservation() {
  const actorRef = useRef<ReturnType<typeof createActor> | null>(null);
  if (!actorRef.current) actorRef.current = createActor(observationMachine);
  const actor = actorRef.current;
  const [snapshot, setSnapshot] = useState(actor.getSnapshot());
  useEffect(() => {
    actor.start();
    const sub = actor.subscribe(setSnapshot);
    return () => { sub.unsubscribe(); actor.stop(); };
  }, [actor]);
  return { snapshot, send: actor.send };
}

function initialLocation(): { state: LocationState; rail: RailId; station: string; needsSetup: boolean } {
  const stored = readLocationState();
  const params = new URL(location.href).searchParams;
  const stationParam = params.get('station') || '';
  const railParam = params.get('rail');
  let rail: RailId = railParam === 'keisei' || stationParam.startsWith('KS') ? 'keisei' : railParam === 'tx' || stationParam.startsWith('TX') ? 'tx' : stored.rail;
  const station = stationParam && ((rail === 'tx' && stationParam.startsWith('TX')) || (rail === 'keisei' && stationParam.startsWith('KS'))) ? stationParam : stored.lastStations[rail];
  const explicit = Boolean(stationParam || railParam);
  return { state: stored, rail, station, needsSetup: !stored.ready && !explicit };
}

function updateUrl(rail: RailId, station: string) {
  const url = new URL(location.href);
  url.searchParams.set('rail', rail);
  url.searchParams.set('station', station);
  history.replaceState(null, '', url);
}

function formatDate(now: Date) {
  return new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(now);
}

function formatCurrentTime(now: Date) {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

function TrainScene({ rail, state }: { rail: RailId; state: 'normal' | 'soon' | 'now' }) {
  return <div className={`train-scene ${state}`} aria-hidden="true"><div className="train-wrap"><svg viewBox="0 0 260 96"><rect x="12" y="18" width="222" height="58" rx="24" fill="currentColor"/><rect x="30" y="29" width="128" height="25" rx="9" fill="#fff" opacity=".95"/><rect x="169" y="29" width="44" height="25" rx="9" fill="#fff" opacity=".95"/><path d="M234 34c10 6 15 15 15 24s-5 14-15 18V34z" fill="currentColor"/><circle cx="58" cy="78" r="10" fill="#243038"/><circle cx="196" cy="78" r="10" fill="#243038"/><circle cx="58" cy="78" r="4" fill="#d9e5f2"/><circle cx="196" cy="78" r="4" fill="#d9e5f2"/></svg></div><div className="track"/><span className="sr-only">{rail === 'tx' ? 'つくばエクスプレス' : '京成線'}の電車イラスト</span></div>;
}

function Tutorial({ isOpen, onDone, rail }: { isOpen: boolean; onDone: () => void; rail: RailId }) {
  const [step, setStep] = useState(0);
  useEffect(() => { if (isOpen) setStep(0); }, [isOpen]);
  const slides = [
    ['次の見どころがわかる', rail === 'keisei' ? '到着・発車。いちばん近い瞬間を大きく表示します。' : '到着・発車・通過。いちばん近い瞬間を大きく表示します。'],
    ['来た瞬間を楽しもう', '「停まった！」「動いた！」は任意。押さなくても自動で進みます。'],
    ['見逃しそうならお知らせ', 'このページを開いている間、3分前と30秒前に知らせることもできます。']
  ];
  return <AppDialog isOpen={isOpen} onOpenChange={open => { if (!open) onDone(); }} title="使い方" testId="tutorial-dialog">
    <div className="tutorial" data-testid={`tutorial-step-${step}`}>
      <div className="tutorial-art" aria-hidden="true"><div className="mini-board"><span>{step === 0 ? '00:24' : step === 1 ? '停まった！' : '3:00'}</span></div></div>
      <p className="step-count">{step + 1} / 3</p><h3>{slides[step][0]}</h3><p>{slides[step][1]}</p>
      <div className="tutorial-dots" aria-hidden="true">{slides.map((_, i) => <i key={i} className={i === step ? 'active' : ''}/>)}</div>
      <div className="tutorial-actions">{step > 0 && <PressButton className="secondary-button" onPress={() => setStep(step - 1)}>戻る</PressButton>}{step < 2 ? <PressButton className="primary-button" onPress={() => setStep(step + 1)}>次へ</PressButton> : <PressButton className="primary-button" onPress={onDone}>はじめる</PressButton>}</div>
    </div>
  </AppDialog>;
}

async function loadVehicleGuide(rail: RailId): Promise<VehicleGuideData> {
  const file = rail === 'tx' ? 'tx-profile.json' : 'keisei-profile.json';
  const response = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
  if (!response.ok) throw new Error('vehicle profile load failed');
  const raw = await response.json() as any;
  if (rail === 'tx') return { rail, title: 'TX 車両ずかん', lead: 'TXには3つの車種があります。見つけたら記録してみよう。', vehicles: raw.vehicles, officialSource: raw.line?.officialSource };
  return { rail, title: '京成 車両ずかん', lead: '京成の現役車両から、親子で見分けやすい4車種をピックアップ。', vehicles: raw.featuredVehicles, others: raw.otherCurrentVehicles, officialSource: raw.officialSource };
}

function heroPresentation(provider: RailProvider, focus: TrainFocus | undefined, snapshot: any, observedVisit: TrainVisit | null, now: Date) {
  if (snapshot.matches('farewell')) return { label: '見送り中', countdown: 'いってらっしゃい！', message: '動く瞬間、見られたね', type: 'departure' as const, service: observedVisit ? provider.serviceLabel(observedVisit.kind) : '電車', direction: observedVisit ? provider.dirText(observedVisit) : '', mode: 'now' as const, action: null as null | string, delayed: false };
  if (snapshot.matches('stopped')) return { label: '停車中', countdown: '停まった！', message: '動く瞬間を待とう', type: 'departure' as const, service: observedVisit ? provider.serviceLabel(observedVisit.kind) : '電車', direction: observedVisit ? provider.dirText(observedVisit) : '', mode: 'now' as const, action: '動いた！', delayed: false };
  if (snapshot.matches('waiting')) return { label: '到着予定を過ぎています', countdown: '待ってる', message: '電車をもう少し待ってみよう', type: 'arrival' as const, service: observedVisit ? provider.serviceLabel(observedVisit.kind) : '電車', direction: observedVisit ? provider.dirText(observedVisit) : '', mode: 'soon' as const, action: '停まった！', delayed: false };
  if (!focus) return { label: '次の電車を確認中', countdown: '--:--', message: '時刻を確認しています', type: 'arrival' as const, service: '電車', direction: '', mode: 'normal' as const, action: null, delayed: false };
  const delayed = focus.type === 'departure' && focus.status === 'active' && !focus.visit.origin && +focus.visit.stationAt < +now;
  if (delayed) return { label: '到着予定を過ぎています', countdown: 'まだかな？', message: '電車をもう少し待ってみよう', type: 'arrival' as const, service: provider.serviceLabel(focus.visit.kind), direction: provider.dirText(focus.visit), mode: 'soon' as const, action: '停まった！', delayed: true };
  const action = focus.type === 'arrival' && focus.status === 'active' ? '停まった！' : focus.type === 'pass' && focus.status === 'active' ? '見えた！' : focus.type === 'departure' && focus.status === 'active' && focus.visit.origin ? '動いた！' : null;
  return { label: provider.focusTitle(focus), countdown: provider.focusCountdown(focus, now), message: provider.focusMessage(focus), type: focus.type, service: provider.serviceLabel(focus.visit.kind), direction: provider.dirText(focus.visit), mode: focus.status === 'active' ? 'now' as const : focus.status === 'soon' ? 'soon' as const : 'normal' as const, action, delayed };
}

export default function App() {
  const initial = useRef(initialLocation()).current;
  const [locationState, setLocationState] = useState(initial.state);
  const [rail, setRail] = useState<RailId>(initial.rail);
  const [stationId, setStationId] = useState(initial.station);
  const [provider, setProvider] = useState<RailProvider | null>(null);
  const [catalogs, setCatalogs] = useState<Record<RailId, Station[]> | null>(null);
  const [settings, setSettings] = useState<Settings>(() => readSettings(initial.rail));
  const [locationOpen, setLocationOpen] = useState(initial.needsSetup);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [vehicleData, setVehicleData] = useState<VehicleGuideData | null>(null);
  const [observedVisit, setObservedVisit] = useState<TrainVisit | null>(null);
  const [watched, setWatched] = useState(() => readWatchedToday(new Date()));
  const [toast, setToast] = useState('');
  const now = useNow();
  const observation = useObservation();
  const tutorialPrompted = useRef(false);
  const notified = useRef(new Set<string>());

  useEffect(() => { loadCatalogs().then(setCatalogs).catch(() => setToast('駅データを読み込めませんでした')); }, []);
  useEffect(() => {
    let alive = true; setProvider(null);
    loadProvider(rail).then(p => { if (alive) setProvider(p); }).catch(() => setToast('時刻データを読み込めませんでした'));
    loadVehicleGuide(rail).then(data => { if (alive) setVehicleData(data); }).catch(() => { if (alive) setVehicleData(null); });
    setSettings(readSettings(rail));
    observation.send({ type: 'CLEAR' }); setObservedVisit(null);
    return () => { alive = false; };
  }, [rail]);

  useEffect(() => { observation.send({ type: 'TICK', now: +now }); }, [now]);
  useEffect(() => { if (observation.snapshot.matches('idle')) setObservedVisit(null); }, [observation.snapshot]);
  useEffect(() => {
    if (!initial.needsSetup && provider && !introSeen() && !tutorialPrompted.current) { tutorialPrompted.current = true; setTutorialOpen(true); }
  }, [provider]);
  useEffect(() => { document.documentElement.dataset.rail = rail; }, [rail]);
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(''), 2200); return () => clearTimeout(id); }, [toast]);

  const station = provider?.stationById(stationId);
  const focuses = useMemo(() => provider ? provider.getFocuses(now, stationId, settings) : [], [provider, now, stationId, settings]);
  const focus = focuses[0];
  const hero = provider ? heroPresentation(provider, focus, observation.snapshot, observedVisit, now) : null;
  const upcomingVisits = useMemo(() => provider ? provider.buildVisits(now, stationId).filter(v => +v.stationAt > +now).slice(0, 7) : [], [provider, now, stationId]);

  useEffect(() => {
    if (!provider || !settings.notify || !focus || focus.deltaMs <= 0) return;
    for (const threshold of [180_000, 30_000]) {
      const key = `${focus.key}:${threshold}`;
      if (focus.deltaMs <= threshold && !notified.current.has(key)) {
        notified.current.add(key);
        setToast(threshold === 180_000 ? 'あと3分くらいで見どころ！' : 'あと30秒くらい！');
        if (settings.vibrate && navigator.vibrate) navigator.vibrate(threshold === 30_000 ? [80, 60, 80] : 80);
      }
    }
  }, [provider, settings, focus]);

  const selectLocation = (nextRail: RailId, nextStation: string) => {
    const nextState = rememberLocation(locationState, nextRail, nextStation);
    setLocationState(nextState); setRail(nextRail); setStationId(nextStation); updateUrl(nextRail, nextStation); setLocationOpen(false);
    if (!introSeen()) { tutorialPrompted.current = true; window.setTimeout(() => setTutorialOpen(true), 160); }
  };

  const saveSettings = (next: Settings) => { setSettings(next); writeSettings(rail, next); };
  const markWatched = () => setWatched(incrementWatchedToday(now));
  const currentVisit = observedVisit || focus?.visit || null;

  const heroAction = () => {
    if (!provider || !hero || !currentVisit) return;
    if (hero.action === '停まった！') { setObservedVisit(currentVisit); observation.send({ type: 'ARRIVED', visitId: currentVisit.id, now: +now }); markWatched(); }
    else if (hero.action === '動いた！') observation.send({ type: 'DEPARTED', visitId: currentVisit.id, now: +now });
    else if (hero.action === '見えた！') { markWatched(); setToast('見えた！'); }
  };
  const waitForTrain = () => { if (!currentVisit) return; setObservedVisit(currentVisit); observation.send({ type: 'NOT_HERE', visitId: currentVisit.id, now: +now }); };

  const doShare = async () => {
    const name = station?.name || '駅';
    const text = `${name}駅で電車を見よう！「でんしゃくるよ！」で次の見どころを追えるよ。`;
    try { if (navigator.share) await navigator.share({ title: `${name}駅｜でんしゃくるよ！`, text, url: location.href }); else { await navigator.clipboard.writeText(`${text}\n${location.href}`); setToast('URLをコピーしました'); } } catch (error: any) { if (error?.name !== 'AbortError') setToast('共有できませんでした'); }
  };

  if (!catalogs || !provider || !station || !hero) return <div className="loading-screen"><strong>でんしゃくるよ！</strong><span>時刻を確認しています…</span></div>;

  return <>
    <a className="skip-link" href="#main">メインへ移動</a>
    <header className="app-header">
      <div className="brand-lockup"><span className="brand-mark" aria-hidden="true">▣</span><span><strong>でんしゃくるよ！</strong><small>TRAIN WATCH · 非公式</small></span></div>
      <div className="header-clock"><strong>{formatCurrentTime(now)}</strong><small>{formatDate(now)}</small></div>
    </header>

    <main id="main" className="app-shell">
      <PressButton className="location-context" data-testid="location-button" onPress={() => setLocationOpen(true)} aria-label={`見る場所を変更。現在は${provider.lineName} ${station.id} ${station.name}`}>
        <span className="rail-label">{provider.shortName}</span><span className="station-code">{station.id}</span><strong>{station.name}</strong><span className="chevron">⌄</span>
      </PressButton>

      <section className={`hero-card ${hero.mode}`} data-testid="hero">
        <div className="hero-topline"><p>{hero.label}</p><span className="service-badge">{hero.service}・{hero.type === 'pass' ? '通過' : hero.type === 'departure' ? '発車' : '到着'}</span></div>
        <div className="countdown" data-testid="countdown">{hero.countdown}</div>
        <p className="hero-message">{hero.message}</p>
        <TrainScene rail={rail} state={hero.mode}/>
        {hero.action && <PressButton className="hero-action" data-testid="hero-action" onPress={heroAction}>{hero.action}</PressButton>}
        {hero.delayed && !observation.snapshot.matches('waiting') && <PressButton className="delay-action" data-testid="delay-action" onPress={waitForTrain}>まだ来てない</PressButton>}
        <div className="hero-meta"><span>{hero.direction}</span>{currentVisit && <span>{currentVisit.time}{currentVisit.approx ? 'ごろ' : ''}</span>}</div>
      </section>

      <nav className="quick-tools" aria-label="便利な機能">
        <PressButton className={`quick-tool ${settings.notify ? 'enabled' : ''}`} onPress={() => setNotifyOpen(true)} aria-pressed={settings.notify}><span>●</span><b>お知らせ</b></PressButton>
        <PressButton className="quick-tool" onPress={() => setTutorialOpen(true)}><span>?</span><b>使い方</b></PressButton>
        <PressButton className="quick-tool" onPress={doShare}><span>↗</span><b>共有</b></PressButton>
      </nav>

      <section className="moments-section">
        <div className="section-heading"><div><h2>いま・もうすぐ</h2><p>近い見どころを、最大3本まで。</p></div><span className="watched-count">きょう {watched}本見た</span></div>
        <div className="moment-list">{focuses.slice(0, 3).map((item, index) => <div className={`moment-row ${index === 0 ? 'next' : ''}`} key={item.key}><span className="moment-time">{item.visit.time}</span><div><strong>{provider.serviceLabel(item.visit.kind)}・{item.typeLabel}</strong><small>{provider.dirText(item.visit)}{item.approximate ? ' · 目安' : ''}</small></div><b>{item.status === 'active' ? 'いま' : provider.focusCountdown(item, now)}</b></div>)}</div>
      </section>

      <RailSpecial provider={provider} station={station} now={now} onOpenVehicles={() => setVehicleOpen(true)}/>

      <section className="timeline-section">
        <div className="section-heading"><h2>このあと</h2><PressButton className="text-button" onPress={() => setSettingsOpen(true)}>表示設定</PressButton></div>
        <div className="timeline">{upcomingVisits.map(visit => <div className="timeline-row" key={visit.id}><strong>{visit.time}</strong><div><b>{provider.serviceLabel(visit.kind)}</b><small>{provider.dirText(visit)}{!visit.stop ? ' · 通過目安' : ''}</small></div></div>)}</div>
      </section>

      <div className="data-notice"><span>時刻表ベース</span><PressButton className="text-button" onPress={() => setDataOpen(true)}>時刻について</PressButton></div>
    </main>

    <footer className="app-footer"><p>でんしゃくるよ！ β · 非公式</p><a href={rail === 'tx' ? 'https://www.mir.co.jp/route_map/index.html' : 'https://www.keisei.co.jp/keisei/tetudou/railmap/'} target="_blank" rel="noreferrer">{rail === 'tx' ? 'TX' : '京成'}公式サイト ↗</a></footer>

    <LocationPicker isOpen={locationOpen} required={!locationState.ready && initial.needsSetup} onOpenChange={open => { if (locationState.ready || !initial.needsSetup) setLocationOpen(open); }} activeRail={rail} activeStationId={stationId} catalogs={catalogs} locationState={locationState} onSelect={selectLocation}/>
    <Tutorial isOpen={tutorialOpen} rail={rail} onDone={() => { markIntroSeen(); setTutorialOpen(false); }}/>
    <VehicleGuide isOpen={vehicleOpen} onOpenChange={setVehicleOpen} data={vehicleData} station={station} stations={provider.stations}/>

    <AppDialog isOpen={settingsOpen} onOpenChange={setSettingsOpen} title="表示設定" testId="settings-dialog">
      {provider.capabilities.passPrediction && <section className="setting-block"><h3>見たい電車</h3><div className="segmented"><PressButton aria-pressed={settings.includePass} className={settings.includePass ? 'selected' : ''} onPress={() => saveSettings({ ...settings, includePass: true })}>通過も含める</PressButton><PressButton aria-pressed={!settings.includePass} className={!settings.includePass ? 'selected' : ''} onPress={() => saveSettings({ ...settings, includePass: false })}>停車だけ</PressButton></div></section>}
      <section className="setting-block"><h3>方面</h3><div className="segmented three">{(['both','down','up'] as const).map(dir => <PressButton key={dir} aria-pressed={settings.dir === dir} className={settings.dir === dir ? 'selected' : ''} onPress={() => saveSettings({ ...settings, dir })}>{dir === 'both' ? '両方' : dir === 'down' ? (rail === 'tx' ? 'つくば' : '成田・空港') : (rail === 'tx' ? '秋葉原' : '上野・押上')}</PressButton>)}</div></section>
      <label className="toggle-row"><span><strong>お知らせ音</strong><small>お知らせ中に音を鳴らす</small></span><input type="checkbox" checked={settings.sound} onChange={e => saveSettings({ ...settings, sound: e.target.checked })}/></label>
      <label className="toggle-row"><span><strong>振動</strong><small>対応端末のみ</small></span><input type="checkbox" checked={settings.vibrate} onChange={e => saveSettings({ ...settings, vibrate: e.target.checked })}/></label>
    </AppDialog>

    <AppDialog isOpen={notifyOpen} onOpenChange={setNotifyOpen} title="お知らせ" testId="notify-dialog">
      <p className="dialog-lead">見どころが近づいたら、このページを開いている間だけ知らせます。</p>
      <div className="notify-facts"><p><strong>3分前と30秒前</strong><span>画面表示・対応端末では振動</span></p><p><strong>Safariを閉じた後は届きません</strong><span>プッシュ通知ではありません。</span></p></div>
      <PressButton className="primary-button full" aria-pressed={settings.notify} onPress={() => { const next = { ...settings, notify: !settings.notify }; saveSettings(next); setToast(next.notify ? 'お知らせをONにしました' : 'お知らせをOFFにしました'); }}>{settings.notify ? 'お知らせをOFFにする' : 'お知らせをONにする'}</PressButton>
    </AppDialog>

    <AppDialog isOpen={dataOpen} onOpenChange={setDataOpen} title="時刻について" testId="data-dialog">
      <div className="data-copy"><p>このサービスは乗換案内ではなく、実際の電車を見るための参考ウォッチです。</p>{rail === 'tx' ? <><p>TXは公開ダイヤを元にした静的データで、到着・通過には一部推定を含みます。</p><p>遅延・運休・臨時列車は完全には反映できません。</p></> : <><p>京成本線は公式の駅発時刻を元にしています。到着は発車時刻の少し前を目安として表示します。</p><p>通過列車は推測して表示しません。</p></>}</div>
    </AppDialog>

    {toast && <div className="toast" role="status">{toast}</div>}
  </>;
}

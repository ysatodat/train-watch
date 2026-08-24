# アーキテクチャ

「でんしゃくるよ！」のフロントエンドは React + TypeScript + Vite を採用し、配信は引き続き GitHub Pages を使います。

## 方針

- サーバーを持たず、時刻表は静的JSONとして配信する
- UIはReactコンポーネントで構成する
- TX / 京成本線の違いは `RailProvider` に閉じ込める
- 観察状態（まだ来ない / 停まった / 動いた / 見送り）はXStateで管理する
- 外部データはZodでランタイム検証する
- Dialog / Buttonなどの操作プリミティブはReact Aria Componentsを使う
- PWAキャッシュはVite PWA / Workboxで生成する
- GitHub Actions上でtypecheck / unit / production build / mobile WebKit E2Eを通してから本番へ出す

## 構成

```text
src/
  App.tsx                 アプリケーションUIと状態の接続
  domain.ts               鉄道ドメイン型・観察State Machine
  rails.ts                TX / 京成 RailProvider
  storage.ts              localStorageと旧データ移行
  components/
    AppDialog.tsx         React Aria Dialog / Button
    LocationPicker.tsx    「見る場所を変える」
    RailSpecial.tsx       TXならでは / 京成ならでは
    VehicleGuide.tsx      共通車両ずかん
  styles.css              デザイントークンとレスポンシブUI

data/
  timetable.json          TX
  tx-profile.json
  keisei-main.json        京成本線
  keisei-main-stations.json
  keisei-profile.json
```

## データフロー

```text
公開時刻表 / GitHub Actions
        ↓
     静的JSON
        ↓
      Zod
        ↓
   RailProvider
    ↙       ↘
 TXProvider  KeiseiProvider
        ↓
  Normalized TrainVisit
        ↓
      React UI
```

UIは個別のJSON構造を直接参照せず、`RailProvider` が返す `Station` / `TrainVisit` / `TrainFocus` を扱います。京成では `passPrediction: false` のため、確実な時刻がない通過列車をUI側で推測しません。

## GitHub Pages

Viteのproduction buildで `dist/` を生成し、GitHub Pages Actionsでその成果物だけを配信します。ソースのTypeScriptをPagesへ直接公開しません。

PWAは `vite-plugin-pwa` がWorkboxベースのService Workerを生成します。JS/CSS/HTML/SVGはprecacheし、大きな時刻表JSONはNetwork Firstのruntime cacheにしています。

## QAゲート

PRでは次を必須にしています。

1. JSON構文確認
2. 京成公式時刻表パーサー確認
3. TypeScript typecheck
4. Vitest unit tests
5. Vite production build
6. iPhone相当のWebKit Playwrightシナリオ

利用者シナリオが失敗しているPRはmainへマージしません。

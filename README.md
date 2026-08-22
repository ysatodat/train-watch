# でんしゃくるよ！ 🚆

**あと何秒？を、親子のワクワクに。**

子どもと一緒に「もうすぐ電車が来る！」を楽しむための、つくばエクスプレス向けカウントダウンWebアプリです。

## 公開URL
https://ysatodat.github.io/train-watch/

## UX / Design
- Brand: **でんしゃくるよ！ / TRAIN WATCH**
- Design direction: **Material Design 3 Expressive** の感情・色・形・モーションの考え方
- Component foundation: **Web Awesome 3.11** の Button / Dialog / Switch / Design Tokens
- UX review: [`docs/ux-review.md`](./docs/ux-review.md)
- Brand foundation: [`docs/brand.md`](./docs/brand.md)

## 主な機能
- TX01 秋葉原〜TX20 つくばの全20駅
- 秒単位のカウントダウン
- 3分 / 30秒 / 10秒で段階的に親子向け演出
- 停車 / 通過（推定）、方面フィルター
- 複数お気に入りを localStorage 保存
- ページを開いている間の音・振動・画面内お知らせ
- 駅別URLを Web Share API でLINE / AirDrop等へ共有
- PWA / Service Worker
- prefers-reduced-motion 対応

## 時刻について
現在は土休日の日中運行パターンを中心にしたβ版です。通過駅は補間による推定を含みます。遅延・運休・臨時列車は反映しません。

公式情報: https://www.mir.co.jp/route_map/index.html

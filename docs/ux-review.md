# UI/UX Review & Scenario Test — 2026-08-22

## Review summary
旧UIは機能として成立していた一方、親子利用に対して「設定・情報・主目的」の視覚優先度が近く、ブランドも技術的な TRAIN WATCH 表記と絵文字に依存していた。また、独自モーダルはフォーカス管理などアクセシビリティを自前で担保する必要があった。

## Main issues found
1. **Primary task dilution** — 「次の電車まで」が主目的なのに、フィルター・お気に入り・通知が同じ画面密度で競合。
2. **Trust clarity** — 平日参考表示・通過推定・遅延未反映が主画面から遠く、秒単位表示の精密さと実データの精度にギャップ。
3. **Notification expectation** — Pages制約によりバックグラウンド保証できないのに「通知ON」が永続化されると誤解を生む。
4. **Brand inconsistency** — dark technical UI + emoji中心。親子向けサービスとして記憶に残る名前・色・言葉・形が未定義。
5. **Accessibility maintenance cost** — 独自modal・toggleを自前実装。focus trap / Escape / label / touch targetの継続管理が必要。
6. **Outdoor readability** — 駅で使う前提なら、暗色UIより明るい面＋高コントラストの方が昼間の視認性を作りやすい。
7. **Child delight is device-dependent** — 絵文字の見た目がOS依存。独自SVGの電車を主ビジュアルにした方が一貫する。

## Scenario tests
### S1: 初めて共有URLを受け取った親
Goal: 研究学園駅の次の電車を即確認。
- Before: ブランド/機能説明より操作要素が先に目に入りやすい。
- Change: station queryを保持し、最上部で駅名→秒読みを1画面内に配置。共有URLは駅指定を維持。

### S2: 2歳児と駅で電車を待つ
Goal: 子どもに「あと何秒」を見せる。
- Before: 数字は大きいが、楽しさは絵文字と単純アニメ中心。
- Change: 独自電車SVG、3分/30秒/10秒で段階的な色・コピー・動き。10秒以内は一緒に数える。

### S3: 親が子どもを見ながら片手操作
Goal: 駅切替・お気に入りを最小操作で行う。
- Change: 主要タップ領域48px以上、駅選択をWeb Awesome Dialogへ。お気に入りは横スクロールの一発切替。

### S4: 近くで遊びながら電車接近を待つ
Goal: 3分前/30秒前に気づく。
- Risk: GitHub Pagesだけでは閉じたアプリへの確実な通知はできない。
- Change: 「このページでお知らせ」と明記。毎セッション明示タップ。音/振動/Toastを組み合わせる。

### S5: 友達家族へ共有
Goal: 同じ駅を開いてもらう。
- Change: Web Share APIを主要CTA化。station query付きURLをLINE/AirDrop等へ共有。

### S6: 平日に開く
Goal: 表示を信用してよいか判断。
- Change: 最上部に「平日は参考表示」を常時出し、時刻説明Dialogへ1タップで到達。

### S7: 視覚・運動アクセシビリティ
Goal: 色覚差・Reduce Motion・キーボードでも利用。
- Change: 色＋文言を併用、prefers-reduced-motion対応、Web Awesome Dialog/Switch/Button採用、skip link追加。

## Implemented priorities
P0: 情報階層、通知の期待値、推定時刻の説明、タップサイズ、Dialog accessibility。
P1: ブランド、独自SVG、M3 Expressive的な色/形/モーション、共有導線、お気に入り導線。
P2: PWA/オフライン、設定永続化。

## Remaining product risk
最大の未解決点は時刻データの完全性。UI上で「β / モデル / 推定」を明示しているが、将来的には公式ダイヤを列車単位で保守できるデータ生成フローを作るべき。

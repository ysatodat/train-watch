# Improvement Plan — executed 2026-08-22

## Goal
親が片手で迷わず操作でき、子どもは電車が近づく時間そのものを楽しめる。さらに、サービスとして名前・色・言葉・コンポーネントに一貫性を持たせる。

## P0 — usability & trust
- 主目的を「次の電車まで」に集約し、設定をDialogへ退避
- 推定 / β / 平日参考を主画面から確認可能に
- 通知をセッション単位へ変更し、Pages制約を明示
- 48px級の主要タップ領域、skip link、Reduce Motion
- 独自modalをWeb Awesome Dialogへ置換

## P1 — brand & delight
- Brand: でんしゃくるよ！
- Promise: あと何秒？を、親子のワクワクに。
- 独自電車SVG、Sky Blue / Sun Yellow / Go Coralの状態変化
- 3分 / 30秒 / 10秒の感情曲線
- 共有を主要CTAへ

## P2 — retention
- 複数お気に入りをlocalStorageに保持
- PWA / Service Worker / app icon
- 駅別ディープリンク

## Next product work
UI/UXではなくデータ品質が最大の次課題。公式ダイヤから列車単位データを生成・検証する保守フローを別途整備する。

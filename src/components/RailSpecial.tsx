import type { RailProvider, Station, TrainVisit } from '../domain';
import { PressButton } from './AppDialog';

function waitLabel(visit: TrainVisit, now: Date): string {
  const ms = +visit.stationAt - +now;
  if (ms < 60_000) return 'もうすぐ';
  if (ms < 60 * 60_000) return `あと${Math.max(1, Math.round(ms / 60_000))}分`;
  return visit.time;
}

type Props = { provider: RailProvider; station: Station; now: Date; onOpenVehicles: () => void };

export function RailSpecial({ provider, station, now, onOpenVehicles }: Props) {
  const visits = provider.buildVisits(now, station.id).filter(v => +v.stationAt > +now);

  if (provider.id === 'tx') {
    const nextPass = visits.find(v => !v.stop) || null;
    let rare: { a: TrainVisit; b: TrainVisit } | null = null;
    const limit = +now + 18 * 60 * 60_000;
    for (let i = 0; i < visits.length && !rare; i++) {
      if (+visits[i].stationAt > limit) break;
      for (let j = i + 1; j < visits.length; j++) {
        const diff = +visits[j].stationAt - +visits[i].stationAt;
        if (diff > 75_000) break;
        if (visits[i].dir !== visits[j].dir) { rare = { a: visits[i], b: visits[j] }; break; }
      }
    }
    return (
      <section className="rail-special" data-testid="tx-special" aria-labelledby="rail-special-title">
        <div className="special-heading"><div><h2 id="rail-special-title">TXならでは</h2><p>{station.name}で、見逃したくない瞬間。</p></div><PressButton className="text-button" onPress={onOpenVehicles}>車両ずかん</PressButton></div>
        <div className="special-list">
          <div className="special-row"><span>次のビューン</span><strong>{nextPass ? `${provider.serviceLabel(nextPass.kind)}が通過` : 'この駅は通過が少なめ'}</strong><b>{nextPass ? waitLabel(nextPass, now) : '—'}</b><p>{nextPass ? `${nextPass.time}ごろ · ${provider.dirText(nextPass)} · 通過時刻は目安` : '次の通過を確認できませんでした。'}</p></div>
          <div className="special-row"><span>次のほぼ同時</span><strong>{rare ? '上下線がほぼ同時' : '近い時間には見つからず'}</strong><b>{rare ? `${rare.a.time}ごろ` : '—'}</b><p>{rare ? 'ダイヤ上の目安。2本をいっしょに見られるかも。' : '次の18時間で組み合わせは見つかりませんでした。'}</p></div>
        </div>
      </section>
    );
  }

  const linerKinds = new Set(['skyliner', 'morningLiner', 'eveningLiner']);
  const airportKinds = new Set(['skyliner', 'accessExpress']);
  const liner = visits.find(v => linerKinds.has(v.kind)) || null;
  const airport = visits.find(v => v.dir === 'down' && (airportKinds.has(v.kind) || /airport|narita|空港/i.test(v.destination || ''))) || null;
  return (
    <section className="rail-special" data-testid="keisei-special" aria-labelledby="rail-special-title">
      <div className="special-heading"><div><h2 id="rail-special-title">京成ならでは</h2><p>{station.name}で、京成らしい1本を探してみよう。</p></div><PressButton className="text-button" onPress={onOpenVehicles}>車両ずかん</PressButton></div>
      <div className="special-list">
        <div className="special-row"><span>次のライナー</span><strong>{liner ? provider.serviceLabel(liner.kind) : 'この駅に停まる便は見つからず'}</strong><b>{liner ? waitLabel(liner, now) : '—'}</b><p>{liner ? `${liner.time}発 · ${provider.dirText(liner)}` : '通過するライナーの時刻は推測しません。'}</p></div>
        <div className="special-row"><span>空港へ向かう電車</span><strong>{airport ? `${provider.serviceLabel(airport.kind)}${airport.destination ? ` · ${airport.destination}` : ''}` : '次の対象列車を確認できず'}</strong><b>{airport ? waitLabel(airport, now) : '—'}</b><p>{airport ? `${airport.time}発 · 成田・空港方面` : '通常の一覧にはこの駅の停車列車を表示します。'}</p></div>
      </div>
    </section>
  );
}

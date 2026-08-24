import { useMemo, useState } from 'react';
import type { RailId, Station } from '../domain';
import { readCollection, writeCollection } from '../storage';
import { AppDialog, PressButton } from './AppDialog';

export type VehicleImage = { src: string; page: string; author: string; license: string; licenseUrl: string };
export type Vehicle = {
  id: string;
  label: string;
  subtitle?: string;
  kidHint: string;
  fact?: string;
  rangeText?: string;
  serviceRange?: { from: string; to: string };
  image: VehicleImage;
};

export type VehicleGuideData = {
  rail: RailId;
  title: string;
  lead: string;
  vehicles: Vehicle[];
  others?: Array<{ label: string; note: string }>;
  officialSource?: string;
};

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  data: VehicleGuideData | null;
  station: Station;
  stations: Station[];
};

export function VehicleGuide({ isOpen, onOpenChange, data, station, stations }: Props) {
  const key = data?.rail === 'keisei' ? 'trainWatch:vehicles:keisei:v2' : 'trainWatch:vehicles:tx:v2';
  const [version, setVersion] = useState(0);
  const found = useMemo(() => { void version; return readCollection(key); }, [key, version]);

  if (!data) return null;
  const byId = new Map(stations.map(s => [s.id, s.i]));
  const available = (vehicle: Vehicle) => {
    if (data.rail !== 'tx' || !vehicle.serviceRange) return true;
    const here = station.i;
    const from = byId.get(vehicle.serviceRange.from) ?? 0;
    const to = byId.get(vehicle.serviceRange.to) ?? stations.length - 1;
    return here >= Math.min(from, to) && here <= Math.max(from, to);
  };
  const availableCount = data.vehicles.filter(available).length;
  const foundCount = data.vehicles.filter(v => found.has(v.id)).length;

  const toggle = (id: string) => {
    const next = readCollection(key);
    if (next.has(id)) next.delete(id); else next.add(id);
    writeCollection(key, next);
    setVersion(v => v + 1);
  };

  return (
    <AppDialog isOpen={isOpen} onOpenChange={onOpenChange} title={data.title} className="vehicle-modal" testId="vehicle-dialog">
      <p className="dialog-lead">{data.lead}</p>
      <p className="vehicle-summary">{data.rail === 'tx' ? `${station.name}駅で会えるのは ${availableCount}種類。` : `${foundCount} / ${data.vehicles.length} 車種みつけた`}</p>
      <div className="vehicle-list">
        {data.vehicles.map(vehicle => {
          const canMeet = available(vehicle);
          const isFound = found.has(vehicle.id);
          return (
            <article className={`vehicle-item ${canMeet ? '' : 'is-unavailable'}`} key={vehicle.id} data-vehicle={vehicle.id}>
              <img className="vehicle-photo" src={vehicle.image.src} alt={`${vehicle.label}の実車写真`} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
              <div className="vehicle-head"><h3>{vehicle.label}</h3>{(vehicle.subtitle || vehicle.rangeText) && <span>{vehicle.subtitle || vehicle.rangeText}</span>}</div>
              <p className="vehicle-hint">{vehicle.kidHint}</p>
              {vehicle.fact && <p className="vehicle-fact">{vehicle.fact}</p>}
              {data.rail === 'tx' && <p className="vehicle-status">{canMeet ? `${station.name}駅で会えるよ` : `この駅には来ないよ${vehicle.rangeText ? `（${vehicle.rangeText}）` : ''}`}</p>}
              <div className="vehicle-actions">
                <PressButton className="found-button" isDisabled={!canMeet} aria-pressed={isFound} onPress={() => toggle(vehicle.id)}>
                  {canMeet ? (isFound ? '見つけた ✓' : '見つけた！') : 'この駅では会えない'}
                </PressButton>
                <p className="vehicle-credit">写真: <a href={vehicle.image.page} target="_blank" rel="noreferrer">{vehicle.image.author}</a> / <a href={vehicle.image.licenseUrl} target="_blank" rel="noreferrer">{vehicle.image.license}</a></p>
              </div>
            </article>
          );
        })}
      </div>
      {data.others?.length ? <details className="other-vehicles"><summary>ほかの現役車両も見る</summary><ul>{data.others.map(v => <li key={v.label}><strong>{v.label}</strong> — {v.note}</li>)}</ul></details> : null}
      {data.officialSource && <p className="source-note">車両の特徴は <a href={data.officialSource} target="_blank" rel="noreferrer">鉄道会社の車両情報</a> を参照。写真はWikimedia Commonsの再利用可能な作品です。</p>}
    </AppDialog>
  );
}

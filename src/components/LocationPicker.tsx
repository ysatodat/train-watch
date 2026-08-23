import { useMemo, useState } from 'react';
import { Input, Label, TextField } from 'react-aria-components';
import type { RailId, Station } from '../domain';
import type { LocationState } from '../storage';
import { AppDialog, PressButton } from './AppDialog';

const railMeta: Record<RailId, { label: string; name: string }> = {
  tx: { label: 'TX', name: 'つくばエクスプレス' },
  keisei: { label: '京成', name: '京成本線' }
};

type Props = {
  isOpen: boolean;
  required: boolean;
  onOpenChange: (open: boolean) => void;
  activeRail: RailId;
  activeStationId: string;
  catalogs: Record<RailId, Station[]>;
  locationState: LocationState;
  onSelect: (rail: RailId, stationId: string) => void;
};

export function LocationPicker({ isOpen, required, onOpenChange, activeRail, activeStationId, catalogs, locationState, onSelect }: Props) {
  const [pickerRail, setPickerRail] = useState<RailId>(activeRail);
  const [query, setQuery] = useState('');

  const stations = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalogs[pickerRail].filter(s => !q || s.name.toLowerCase().includes(q) || s.en.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
  }, [catalogs, pickerRail, query]);

  const recent = locationState.recent
    .map(item => ({ ...item, station: catalogs[item.rail].find(s => s.id === item.stationId) }))
    .filter((item): item is typeof item & { station: Station } => Boolean(item.station));

  return (
    <AppDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      required={required}
      title={required ? 'どこで電車を見る？' : '見る場所を変える'}
      className="location-modal"
      testId="location-dialog"
    >
      <p className="dialog-lead">{required ? 'いま電車が見える場所を選んでね。' : '次に見たい場所を選びます。'}</p>

      {!required && recent.length > 0 && (
        <section className="recent-section" aria-labelledby="recent-title">
          <h3 id="recent-title">最近見た場所</h3>
          <div className="recent-list">
            {recent.map(item => (
              <PressButton key={`${item.rail}-${item.stationId}`} className="recent-location" onPress={() => onSelect(item.rail, item.stationId)}>
                <span>{railMeta[item.rail].label}</span><strong>{item.station.name}</strong><small>{item.station.id}</small>
              </PressButton>
            ))}
          </div>
        </section>
      )}

      <div className="rail-tabs" role="tablist" aria-label="路線">
        {(Object.keys(railMeta) as RailId[]).map(rail => (
          <PressButton
            key={rail}
            role="tab"
            aria-selected={pickerRail === rail}
            className="rail-tab"
            data-testid={`rail-tab-${rail}`}
            onPress={() => { setPickerRail(rail); setQuery(''); }}
          >
            <strong>{railMeta[rail].label}</strong><small>{railMeta[rail].name}</small>
          </PressButton>
        ))}
      </div>

      <TextField className="location-search" value={query} onChange={setQuery}>
        <Label>駅を探す</Label>
        <Input placeholder="駅名・駅番号" autoComplete="off" inputMode="search" data-testid="station-search" />
      </TextField>

      <div className="station-list-heading"><strong>{railMeta[pickerRail].name}</strong><span>{catalogs[pickerRail].length}駅</span></div>
      <div className="station-list" data-testid="station-list">
        {stations.map(station => {
          const current = pickerRail === activeRail && station.id === activeStationId;
          return (
            <PressButton
              key={station.id}
              className="station-choice"
              data-testid={`station-${station.id}`}
              aria-current={current ? 'true' : undefined}
              onPress={() => onSelect(pickerRail, station.id)}
            >
              <span className="station-code-chip">{station.id}</span>
              <span className="station-choice-name"><strong>{station.name}</strong><small>{station.en}</small></span>
              {current && <span className="current-label">いま</span>}
            </PressButton>
          );
        })}
        {stations.length === 0 && <p className="empty-state">該当する駅がありません。</p>}
      </div>
    </AppDialog>
  );
}

import type { RailFilters, RailId } from './domain';

export type Settings = RailFilters & {
  sound: boolean;
  vibrate: boolean;
  notify: boolean;
};

export type LocationState = {
  rail: RailId;
  lastStations: Record<RailId, string>;
  recent: Array<{ rail: RailId; stationId: string }>;
  ready: boolean;
};

const LOCATION_KEY = 'trainWatch:location:v2';
const SETTINGS_PREFIX = 'trainWatch:settings:v2:';
const INTRO_KEY = 'trainWatch:intro:v3';
const WATCHED_KEY = 'trainWatch:watched:v2';

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch {}
}

function defaultLocation(): LocationState {
  return { rail: 'tx', lastStations: { tx: 'TX19', keisei: 'KS22' }, recent: [], ready: false };
}

export function readLocationState(): LocationState {
  try {
    const current = JSON.parse(safeGet(LOCATION_KEY) || 'null') as LocationState | null;
    if (current?.lastStations?.tx && current?.lastStations?.keisei) return current;
  } catch {}

  const migrated = defaultLocation();
  try {
    const oldRail = JSON.parse(safeGet('denshaKuruyoRailContextV1') || '{}') as { rail?: RailId; lastStations?: Partial<Record<RailId, string>> };
    const oldState = JSON.parse(safeGet('denshaKuruyoV1') || '{}') as { station?: string };
    if (oldRail.rail === 'tx' || oldRail.rail === 'keisei') migrated.rail = oldRail.rail;
    if (oldRail.lastStations?.tx?.startsWith('TX')) migrated.lastStations.tx = oldRail.lastStations.tx;
    if (oldRail.lastStations?.keisei?.startsWith('KS')) migrated.lastStations.keisei = oldRail.lastStations.keisei;
    if (oldState.station?.startsWith('TX')) migrated.lastStations.tx = oldState.station;
    if (oldState.station?.startsWith('KS')) migrated.lastStations.keisei = oldState.station;
    migrated.ready = safeGet('denshaKuruyoLocationReadyV1') === '1' || Boolean(oldState.station || oldRail.rail);
  } catch {}
  safeSet(LOCATION_KEY, JSON.stringify(migrated));
  return migrated;
}

export function writeLocationState(state: LocationState): void {
  safeSet(LOCATION_KEY, JSON.stringify(state));
}

export function rememberLocation(state: LocationState, rail: RailId, stationId: string): LocationState {
  const recent = [{ rail, stationId }, ...state.recent.filter(x => !(x.rail === rail && x.stationId === stationId))].slice(0, 4);
  const next: LocationState = { rail, lastStations: { ...state.lastStations, [rail]: stationId }, recent, ready: true };
  writeLocationState(next);
  return next;
}

export function readSettings(rail: RailId): Settings {
  const defaults: Settings = { includePass: rail === 'tx', dir: 'both', sound: true, vibrate: true, notify: false };
  try { return { ...defaults, ...(JSON.parse(safeGet(`${SETTINGS_PREFIX}${rail}`) || '{}') as Partial<Settings>) }; } catch { return defaults; }
}

export function writeSettings(rail: RailId, settings: Settings): void {
  safeSet(`${SETTINGS_PREFIX}${rail}`, JSON.stringify(settings));
}

export const introSeen = () => safeGet(INTRO_KEY) === 'seen';
export const markIntroSeen = () => safeSet(INTRO_KEY, 'seen');

export function readWatchedToday(now: Date): number {
  const key = now.toISOString().slice(0, 10);
  try {
    const value = JSON.parse(safeGet(WATCHED_KEY) || '{}') as { date?: string; count?: number };
    return value.date === key ? value.count || 0 : 0;
  } catch { return 0; }
}

export function incrementWatchedToday(now: Date): number {
  const count = readWatchedToday(now) + 1;
  safeSet(WATCHED_KEY, JSON.stringify({ date: now.toISOString().slice(0, 10), count }));
  return count;
}

export function readCollection(key: string): Set<string> {
  try {
    const value = JSON.parse(safeGet(key) || '[]');
    return new Set(Array.isArray(value) ? value : []);
  } catch { return new Set(); }
}

export function writeCollection(key: string, values: Set<string>): void {
  safeSet(key, JSON.stringify([...values]));
}

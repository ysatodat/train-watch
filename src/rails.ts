import { z } from 'zod';
import type { Direction, RailFilters, RailId, RailProvider, Station, TrainFocus, TrainVisit } from './domain';
import { dateKey, formatClock, formatTime } from './domain';

const stationTuple = z.tuple([z.string(), z.string(), z.string()]);
const offsetRecord = z.record(z.string(), z.array(z.number().nullable()));
const txSchema = z.object({
  dataVersion: z.string(),
  timetableRevision: z.string(),
  validThrough: z.string().nullable().optional(),
  stations: z.array(stationTuple),
  services: z.record(z.string(), z.string()),
  offsets: z.object({ down: offsetRecord, up: offsetRecord }),
  daytimeBases: z.object({
    startHour: z.number(),
    endHour: z.number(),
    down: z.array(z.tuple([z.string(), z.number()])),
    up: z.array(z.tuple([z.string(), z.number()]))
  }),
  verifiedEdgeTimes: z.record(z.string(), z.unknown()).optional(),
  calendar: z.object({ holidayDates: z.array(z.string()) }).optional()
});

const keiseiVisitSchema = z.object({
  time: z.string(),
  dir: z.enum(['up', 'down']),
  service: z.string(),
  destination: z.string().optional(),
  origin: z.boolean().optional()
});
const keiseiSchema = z.object({
  dataVersion: z.string(),
  timetableRevision: z.string(),
  stations: z.array(z.object({ id: z.string(), name: z.string(), en: z.string(), i: z.number() })),
  services: z.record(z.string(), z.string()),
  directions: z.record(z.string(), z.string()).optional(),
  timetable: z.object({
    weekday: z.record(z.string(), z.array(keiseiVisitSchema)),
    holiday: z.record(z.string(), z.array(keiseiVisitSchema))
  })
});

const HOLIDAYS_2026 = new Set([
  '2026-01-01','2026-01-12','2026-02-11','2026-02-23','2026-03-20','2026-04-29','2026-05-03','2026-05-04','2026-05-05','2026-05-06','2026-07-20','2026-08-11','2026-09-21','2026-09-22','2026-09-23','2026-10-12','2026-11-03','2026-11-23'
]);

const ARRIVAL_LEAD_MS = 35_000;
const DEPARTURE_WINDOW_MS = 60_000;
const PASS_ACTIVE_BEFORE_MS = 10_000;
const PASS_ACTIVE_AFTER_MS = 10_000;
const LONG_WAIT_MS = 90 * 60_000;
const SERVICE_DAY_BOUNDARY_HOUR = 4;

function serviceDateForMoment(moment: Date): Date {
  const d = new Date(moment);
  if (d.getHours() < SERVICE_DAY_BOUNDARY_HOUR) d.setDate(d.getDate() - 1);
  d.setHours(12, 0, 0, 0);
  return d;
}

function isHoliday(moment: Date, extra = new Set<string>()): boolean {
  const d = serviceDateForMoment(moment);
  return d.getDay() === 0 || d.getDay() === 6 || HOLIDAYS_2026.has(dateKey(d)) || extra.has(dateKey(d));
}

function focusTitle(f: TrainFocus): string {
  if (f.type === 'arrival') {
    if (f.status === 'active') return 'いま、停まるところ！';
    if (f.deltaMs <= 30_000) return 'もうすぐ到着！';
    return 'つぎは到着';
  }
  if (f.type === 'departure') {
    if (f.status === 'active') return '発車の時間帯！';
    if (f.deltaMs <= 30_000) return 'もうすぐ発車の時間！';
    return 'つぎは発車';
  }
  if (f.status === 'active') return 'いま、通過！';
  if (f.deltaMs <= 30_000) return 'もうすぐ通過！';
  return 'つぎは通過';
}

function focusMessage(f: TrainFocus): string {
  if (f.type === 'arrival') return f.status === 'active' ? '停まる瞬間を見よう' : '電車が入ってくるよ';
  if (f.type === 'departure') return f.status === 'active' ? '動く瞬間を見よう' : '発車を見逃さないで';
  return f.status === 'active' ? 'ビューン！' : '速い電車を見よう';
}

function focusCountdown(f: TrainFocus, now: Date): string {
  if (f.status === 'active') return 'いま！';
  if (f.deltaMs > LONG_WAIT_MS) return f.visit.time;
  return formatClock(+f.target - +now);
}

function sortFocuses(items: TrainFocus[]): TrainFocus[] {
  const rank = { active: 0, soon: 1, future: 2 } as const;
  return items.sort((a, b) => rank[a.status] - rank[b.status] || Math.max(0, a.deltaMs) - Math.max(0, b.deltaMs) || +a.visit.stationAt - +b.visit.stationAt);
}

function filterVisits(visits: TrainVisit[], filters: RailFilters): TrainVisit[] {
  return visits.filter(v => (filters.includePass || v.stop) && (filters.dir === 'both' || filters.dir === v.dir));
}

function buildTxProvider(raw: unknown): RailProvider {
  const data = txSchema.parse(raw);
  const stations: Station[] = data.stations.map(([id, name, en], i) => ({ id, name, en, i }));
  const holidays = new Set(data.calendar?.holidayDates || []);
  const stationById = (id: string) => stations.find(s => s.id === id) || stations[18];
  const localDown = data.offsets.down.local;
  const localUp = data.offsets.up.local;

  const interpolate = (arr: Array<number | null>, index: number, baseline: Array<number | null>) => {
    if (arr[index] != null) return { offset: arr[index] as number, approx: false };
    let l = index - 1, r = index + 1;
    while (l >= 0 && arr[l] == null) l--;
    while (r < arr.length && arr[r] == null) r++;
    if (l < 0 || r >= arr.length || baseline[l] == null || baseline[r] == null || baseline[index] == null) return { offset: null as number | null, approx: true };
    const p = ((baseline[index] as number) - (baseline[l] as number)) / ((baseline[r] as number) - (baseline[l] as number));
    return { offset: (arr[l] as number) + ((arr[r] as number) - (arr[l] as number)) * p, approx: true };
  };

  const buildPatternVisits = (now: Date, stationId: string): TrainVisit[] => {
    const station = stationById(stationId);
    const day = new Date(now); day.setHours(0, 0, 0, 0);
    const visits: TrainVisit[] = [];
    const add = (dir: Direction, kind: string, hour: number, minute: number) => {
      const table = data.offsets[dir][kind];
      const baseline = dir === 'down' ? localDown : localUp;
      if (!table) return;
      const info = interpolate(table, station.i, baseline);
      if (info.offset == null) return;
      const at = new Date(day); at.setMinutes(hour * 60 + minute + info.offset);
      visits.push({
        id: `tx-model-${dir}-${hour}-${minute}-${kind}-${stationId}`,
        kind, dir, stationId, stop: table[station.i] != null, approx: info.approx, verified: false,
        stationAt: at, time: formatTime(at)
      });
    };
    const lastHour = stationId === 'TX19' ? 22 : data.daytimeBases.endHour;
    for (let hour = data.daytimeBases.startHour; hour <= lastHour; hour++) {
      data.daytimeBases.down.forEach(([kind, minute]) => add('down', kind, hour, minute));
      data.daytimeBases.up.forEach(([kind, minute]) => add('up', kind, hour, minute));
    }
    return visits;
  };

  const exactVisitsForDate = (day: Date, stationId: string): TrainVisit[] => {
    if (stationId !== 'TX19') return [];
    const edge = (data.verifiedEdgeTimes?.TX19 || {}) as Record<string, any>;
    const out: TrainVisit[] = [];
    for (const dayType of ['weekday', 'holiday'] as const) {
      for (const dir of ['up', 'down'] as Direction[]) {
        const rows = edge?.[dayType]?.[dir] as Array<[number, number, string]> | undefined;
        for (const [h, m, kind] of rows || []) {
          const at = new Date(day); at.setHours(h, m, 0, 0);
          const actualType = isHoliday(at, holidays) ? 'holiday' : 'weekday';
          if (actualType !== dayType) continue;
          out.push({ id: `tx-verified-${dayType}-${dir}-${dateKey(day)}-${h}-${m}`, kind, dir, stationId, stop: true, approx: false, verified: true, stationAt: at, time: formatTime(at) });
        }
      }
    }
    return out;
  };

  const buildVisits = (now: Date, stationId: string): TrainVisit[] => {
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(0, 0, 0, 0);
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const visits = [
      ...buildPatternVisits(now, stationId),
      ...exactVisitsForDate(yesterday, stationId),
      ...exactVisitsForDate(today, stationId),
      ...exactVisitsForDate(tomorrow, stationId)
    ].filter(v => +v.stationAt - +now > -90_000).sort((a, b) => +a.stationAt - +b.stationAt);
    const seen = new Set<string>();
    return visits.filter(v => { const key = `${v.dir}-${+v.stationAt}-${v.stationId}`; if (seen.has(key)) return false; seen.add(key); return true; });
  };

  const isOrigin = (v: TrainVisit) => (v.dir === 'down' && v.stationId === 'TX01') || (v.dir === 'up' && v.stationId === 'TX20');
  const isTerminal = (v: TrainVisit) => (v.dir === 'down' && v.stationId === 'TX20') || (v.dir === 'up' && v.stationId === 'TX01');
  const focusForVisit = (v: TrainVisit, now: Date): TrainFocus | null => {
    const nowMs = +now, stationMs = +v.stationAt;
    if (!v.stop) {
      const delta = stationMs - nowMs;
      if (delta < -PASS_ACTIVE_AFTER_MS) return null;
      const active = delta <= PASS_ACTIVE_BEFORE_MS && delta >= -PASS_ACTIVE_AFTER_MS;
      return { visit: v, key: `${v.id}:pass`, type: 'pass', typeLabel: '通過', target: new Date(stationMs), status: active ? 'active' : delta <= 180_000 ? 'soon' : 'future', deltaMs: delta, approximate: true, activeUntil: new Date(stationMs + PASS_ACTIVE_AFTER_MS) };
    }
    if (isOrigin(v)) {
      const delta = stationMs - nowMs;
      if (delta < -DEPARTURE_WINDOW_MS) return null;
      return { visit: v, key: `${v.id}:departure`, type: 'departure', typeLabel: '発車', target: new Date(stationMs), status: delta <= 0 ? 'active' : delta <= 180_000 ? 'soon' : 'future', deltaMs: delta, approximate: !v.verified, activeUntil: new Date(stationMs + DEPARTURE_WINDOW_MS) };
    }
    if (isTerminal(v)) {
      const delta = stationMs - nowMs;
      if (delta < -30_000) return null;
      return { visit: v, key: `${v.id}:arrival-terminal`, type: 'arrival', typeLabel: '到着', target: new Date(stationMs), status: delta <= 10_000 ? 'active' : delta <= 180_000 ? 'soon' : 'future', deltaMs: delta, approximate: !v.verified || v.approx, activeUntil: new Date(stationMs + 30_000) };
    }
    const arrivalMs = stationMs - ARRIVAL_LEAD_MS;
    if (nowMs < stationMs) {
      const delta = arrivalMs - nowMs;
      return { visit: v, key: `${v.id}:arrival`, type: 'arrival', typeLabel: '到着', target: new Date(arrivalMs), status: delta <= 0 ? 'active' : delta <= 180_000 ? 'soon' : 'future', deltaMs: delta, approximate: true, activeUntil: new Date(stationMs) };
    }
    if (nowMs < stationMs + DEPARTURE_WINDOW_MS) {
      return { visit: v, key: `${v.id}:departure`, type: 'departure', typeLabel: '発車', target: new Date(stationMs), status: 'active', deltaMs: stationMs - nowMs, approximate: !v.verified, activeUntil: new Date(stationMs + DEPARTURE_WINDOW_MS) };
    }
    return null;
  };

  return {
    id: 'tx', lineName: 'つくばエクスプレス', shortName: 'TX', defaultStation: 'TX19', stations,
    capabilities: { passPrediction: true, realtime: false, vehicleCatalog: true },
    serviceLabel: kind => data.services[kind] || '電車',
    stationById,
    dirText: v => v.dir === 'down' ? 'つくば方面' : '秋葉原方面',
    buildVisits,
    getFocuses: (now, stationId, filters) => sortFocuses(filterVisits(buildVisits(now, stationId), filters).map(v => focusForVisit(v, now)).filter((x): x is TrainFocus => Boolean(x))),
    focusTitle, focusMessage, focusCountdown
  };
}

function buildKeiseiProvider(raw: unknown): RailProvider {
  const data = keiseiSchema.parse(raw);
  const stations: Station[] = data.stations;
  const stationById = (id: string) => stations.find(s => s.id === id) || stations.find(s => s.id === 'KS22') || stations[0];
  const dayType = (now: Date) => isHoliday(now) ? 'holiday' : 'weekday';
  const serviceDayAt = (day: Date, h: number, m: number) => {
    const d = new Date(day); d.setHours(0, 0, 0, 0); if (h < SERVICE_DAY_BOUNDARY_HOUR) d.setDate(d.getDate() + 1); d.setHours(h, m, 0, 0); return d;
  };
  const visitsForDay = (day: Date, stationId: string): TrainVisit[] => {
    const noon = new Date(day); noon.setHours(12, 0, 0, 0);
    const list = data.timetable[dayType(noon)][stationId] || [];
    return list.map((entry, index) => {
      const [h, m] = entry.time.split(':').map(Number);
      const at = serviceDayAt(day, h, m);
      const origin = (stationId === 'KS01' && entry.dir === 'down') || (stationId === 'KS42' && entry.dir === 'up') || entry.origin;
      return { id: `keisei-${dateKey(noon)}-${stationId}-${entry.dir}-${entry.time}-${entry.service}-${index}`, kind: entry.service, dir: entry.dir, stationId, stop: true, approx: false, verified: true, origin, destination: entry.destination, stationAt: at, time: formatTime(at) };
    });
  };
  const buildVisits = (now: Date, stationId: string) => {
    const service = serviceDateForMoment(now); service.setHours(0, 0, 0, 0);
    const prev = new Date(service); prev.setDate(prev.getDate() - 1);
    const next = new Date(service); next.setDate(next.getDate() + 1);
    return [...visitsForDay(prev, stationId), ...visitsForDay(service, stationId), ...visitsForDay(next, stationId)].filter(v => +v.stationAt - +now > -90_000).sort((a, b) => +a.stationAt - +b.stationAt);
  };
  const focusForVisit = (v: TrainVisit, now: Date): TrainFocus | null => {
    const nowMs = +now, stationMs = +v.stationAt;
    if (v.origin) {
      const delta = stationMs - nowMs;
      if (delta < -DEPARTURE_WINDOW_MS) return null;
      return { visit: v, key: `${v.id}:departure`, type: 'departure', typeLabel: '発車', target: new Date(stationMs), status: delta <= 0 ? 'active' : delta <= 180_000 ? 'soon' : 'future', deltaMs: delta, approximate: false, activeUntil: new Date(stationMs + DEPARTURE_WINDOW_MS) };
    }
    const arrivalMs = stationMs - ARRIVAL_LEAD_MS;
    if (nowMs < stationMs) {
      const delta = arrivalMs - nowMs;
      return { visit: v, key: `${v.id}:arrival`, type: 'arrival', typeLabel: '到着', target: new Date(arrivalMs), status: delta <= 0 ? 'active' : delta <= 180_000 ? 'soon' : 'future', deltaMs: delta, approximate: true, activeUntil: new Date(stationMs) };
    }
    if (nowMs < stationMs + DEPARTURE_WINDOW_MS) return { visit: v, key: `${v.id}:departure`, type: 'departure', typeLabel: '発車', target: new Date(stationMs), status: 'active', deltaMs: stationMs - nowMs, approximate: false, activeUntil: new Date(stationMs + DEPARTURE_WINDOW_MS) };
    return null;
  };
  return {
    id: 'keisei', lineName: '京成本線', shortName: '京成', defaultStation: 'KS22', stations,
    capabilities: { passPrediction: false, realtime: false, vehicleCatalog: true },
    serviceLabel: kind => data.services[kind] || '電車',
    stationById,
    dirText: v => v.dir === 'up' ? '上野・押上方面' : '成田・空港方面',
    buildVisits,
    getFocuses: (now, stationId, filters) => sortFocuses(filterVisits(buildVisits(now, stationId), { ...filters, includePass: false }).map(v => focusForVisit(v, now)).filter((x): x is TrainFocus => Boolean(x))),
    focusTitle, focusMessage: f => f.type === 'arrival' ? (f.status === 'active' ? '停まる瞬間を見よう' : '電車が入ってくるよ') : (f.status === 'active' ? '動く瞬間を見よう' : '発車を見逃さないで'), focusCountdown
  };
}

export async function loadProvider(rail: RailId): Promise<RailProvider> {
  const path = rail === 'tx' ? 'timetable.json' : 'keisei-main.json';
  const response = await fetch(`${import.meta.env.BASE_URL}data/${path}`, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${rail} data load failed: ${response.status}`);
  const raw = await response.json();
  return rail === 'tx' ? buildTxProvider(raw) : buildKeiseiProvider(raw);
}

export async function loadCatalogs(): Promise<Record<RailId, Station[]>> {
  const [tx, ks] = await Promise.all([
    fetch(`${import.meta.env.BASE_URL}data/timetable.json`).then(r => r.json()).then(raw => txSchema.parse(raw).stations.map(([id, name, en], i) => ({ id, name, en, i }))),
    fetch(`${import.meta.env.BASE_URL}data/keisei-main-stations.json`).then(r => r.json()).then(raw => z.object({ stations: z.array(z.tuple([z.string(), z.string(), z.string(), z.number()])) }).parse(raw).stations.map(([id, name, en, i]) => ({ id, name, en, i })))
  ]);
  return { tx, keisei: ks };
}

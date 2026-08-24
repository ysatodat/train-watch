import { assign, setup } from 'xstate';

export type RailId = 'tx' | 'keisei';
export type Direction = 'up' | 'down';
export type FocusType = 'arrival' | 'departure' | 'pass';
export type FocusStatus = 'future' | 'soon' | 'active';

export type Station = { id: string; name: string; en: string; i: number };
export type TrainVisit = {
  id: string;
  kind: string;
  dir: Direction;
  stationId: string;
  stop: boolean;
  approx: boolean;
  verified: boolean;
  origin?: boolean;
  destination?: string;
  stationAt: Date;
  time: string;
};

export type TrainFocus = {
  visit: TrainVisit;
  key: string;
  type: FocusType;
  typeLabel: string;
  target: Date;
  status: FocusStatus;
  deltaMs: number;
  approximate: boolean;
  activeUntil: Date;
};

export type RailCapabilities = {
  passPrediction: boolean;
  realtime: boolean;
  vehicleCatalog: boolean;
};

export type RailFilters = {
  includePass: boolean;
  dir: 'both' | Direction;
};

export type RailProvider = {
  id: RailId;
  lineName: string;
  shortName: string;
  defaultStation: string;
  stations: Station[];
  capabilities: RailCapabilities;
  serviceLabel(kind: string): string;
  stationById(id: string): Station;
  dirText(visit: Pick<TrainVisit, 'dir'>): string;
  buildVisits(now: Date, stationId: string): TrainVisit[];
  getFocuses(now: Date, stationId: string, filters: RailFilters): TrainFocus[];
  focusTitle(focus: TrainFocus): string;
  focusMessage(focus: TrainFocus): string;
  focusCountdown(focus: TrainFocus, now: Date): string;
};

export type ObservationContext = {
  visitId: string | null;
  expiresAt: number | null;
};

export type ObservationEvent =
  | { type: 'ARRIVED'; visitId: string; now: number }
  | { type: 'NOT_HERE'; visitId: string; now: number }
  | { type: 'DEPARTED'; visitId: string; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'CLEAR' };

export const observationMachine = setup({
  types: {
    context: {} as ObservationContext,
    events: {} as ObservationEvent
  },
  guards: {
    expired: ({ context, event }) => event.type === 'TICK' && context.expiresAt !== null && event.now >= context.expiresAt
  },
  actions: {
    clearObservation: assign(() => ({ visitId: null, expiresAt: null })),
    rememberTenMinutes: assign(({ event }) => ({
      visitId: 'visitId' in event ? event.visitId : null,
      expiresAt: 'now' in event ? event.now + 10 * 60_000 : null
    })),
    rememberFarewell: assign(({ event }) => ({
      visitId: 'visitId' in event ? event.visitId : null,
      expiresAt: 'now' in event ? event.now + 3_000 : null
    }))
  }
}).createMachine({
  id: 'observation',
  initial: 'idle',
  context: { visitId: null, expiresAt: null },
  states: {
    idle: {
      on: {
        ARRIVED: { target: 'stopped', actions: 'rememberTenMinutes' },
        NOT_HERE: { target: 'waiting', actions: 'rememberTenMinutes' },
        CLEAR: { actions: 'clearObservation' }
      }
    },
    waiting: {
      on: {
        ARRIVED: { target: 'stopped', actions: 'rememberTenMinutes' },
        TICK: { guard: 'expired', target: 'idle', actions: 'clearObservation' },
        CLEAR: { target: 'idle', actions: 'clearObservation' }
      }
    },
    stopped: {
      on: {
        DEPARTED: { target: 'farewell', actions: 'rememberFarewell' },
        TICK: { guard: 'expired', target: 'idle', actions: 'clearObservation' },
        CLEAR: { target: 'idle', actions: 'clearObservation' }
      }
    },
    farewell: {
      on: {
        TICK: { guard: 'expired', target: 'idle', actions: 'clearObservation' },
        CLEAR: { target: 'idle', actions: 'clearObservation' }
      }
    }
  }
});

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

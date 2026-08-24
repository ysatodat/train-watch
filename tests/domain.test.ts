import { createActor } from 'xstate';
import { describe, expect, it } from 'vitest';
import { observationMachine, formatClock } from '../src/domain';

describe('observationMachine', () => {
  it('keeps an observed train stopped until departure is observed', () => {
    const actor = createActor(observationMachine).start();
    actor.send({ type: 'ARRIVED', visitId: 'v1', now: 1_000 });
    expect(actor.getSnapshot().matches('stopped')).toBe(true);
    actor.send({ type: 'TICK', now: 200_000 });
    expect(actor.getSnapshot().matches('stopped')).toBe(true);
    actor.send({ type: 'DEPARTED', visitId: 'v1', now: 200_000 });
    expect(actor.getSnapshot().matches('farewell')).toBe(true);
    actor.send({ type: 'TICK', now: 203_100 });
    expect(actor.getSnapshot().matches('idle')).toBe(true);
  });

  it('keeps a delayed train for up to ten minutes', () => {
    const actor = createActor(observationMachine).start();
    actor.send({ type: 'NOT_HERE', visitId: 'v2', now: 10_000 });
    expect(actor.getSnapshot().matches('waiting')).toBe(true);
    actor.send({ type: 'TICK', now: 9 * 60_000 });
    expect(actor.getSnapshot().matches('waiting')).toBe(true);
    actor.send({ type: 'TICK', now: 611_000 });
    expect(actor.getSnapshot().matches('idle')).toBe(true);
  });
});

describe('formatClock', () => {
  it('formats countdown seconds', () => expect(formatClock(84_000)).toBe('01:24'));
});

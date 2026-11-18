import { TestBed } from '@angular/core/testing';

import { ChartScheduler } from './chart-scheduler';

describe('ChartScheduler', () => {
  let idle: (() => void)[];

  beforeEach(() => {
    idle = [];
    vi.stubGlobal('requestIdleCallback', (callback: () => void) => {
      idle.push(callback);
      return idle.length;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function nextSlot(): void {
    const slot = idle.shift();
    if (!slot) {
      throw new Error('no idle slot requested');
    }
    slot();
  }

  it('runs one job per idle slot, in the order they came', () => {
    const scheduler = TestBed.inject(ChartScheduler);
    const runs: string[] = [];
    scheduler.schedule(() => runs.push('first'));
    scheduler.schedule(() => runs.push('second'));
    expect(idle).toHaveLength(1);

    nextSlot();
    expect(runs).toEqual(['first']);
    nextSlot();
    expect(runs).toEqual(['first', 'second']);
    expect(idle).toHaveLength(0);
  });

  it('drops a cancelled job', () => {
    const scheduler = TestBed.inject(ChartScheduler);
    const runs: string[] = [];
    const cancel = scheduler.schedule(() => runs.push('dropped'));
    scheduler.schedule(() => runs.push('kept'));
    cancel();

    nextSlot();
    expect(runs).toEqual(['kept']);
  });

  it('runs the next job after a job that throws', () => {
    const scheduler = TestBed.inject(ChartScheduler);
    const runs: string[] = [];
    scheduler.schedule(() => {
      throw new Error('broken chart');
    });
    scheduler.schedule(() => runs.push('next'));

    expect(() => {
      nextSlot();
    }).toThrow('broken chart');
    nextSlot();
    expect(runs).toEqual(['next']);
  });
});

import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Chart } from './chart';
import { ChartTheme } from './chart-theme';
import { CHART_LOADER, loadECharts } from './chart-loader';
import { ChartScheduler } from './chart-scheduler';
import type { ChartClickEvent, ChartModule, ChartOption } from './chart.types';

class FakeChart {
  /** The theme the chart draws with. */
  applied: Record<string, unknown>;
  readonly setOption = vi.fn<(option: ChartOption, settings?: unknown) => void>();
  // As in ECharts 6.1: `setTheme` before the first `setOption` has no model and drops the theme.
  readonly setTheme = vi.fn((theme: Record<string, unknown>) => {
    if (this.setOption.mock.calls.length > 0) {
      this.applied = theme;
    }
  });
  readonly resize = vi.fn();
  readonly dispose = vi.fn();
  readonly handlers = new Map<string, (params: unknown) => void>();
  readonly on = vi.fn((event: string, handler: (params: unknown) => void) => {
    this.handlers.set(event, handler);
  });
  constructor(
    readonly element: HTMLElement,
    readonly theme: Record<string, unknown>,
  ) {
    this.applied = theme;
  }
}

const instances: FakeChart[] = [];
/** Runs inside `createChart`, before `lib-chart` sees the instance. */
let onCreate: (() => void) | null = null;
const fakeModule = {
  createChart: (element: HTMLElement, theme: Record<string, unknown>) => {
    const chart = new FakeChart(element, theme);
    instances.push(chart);
    onCreate?.();
    return chart;
  },
} as unknown as ChartModule;
const loader = vi.fn(() => Promise.resolve(fakeModule));

// jsdom has no ResizeObserver. The stub keeps each callback so a test can fire it.
const observers: ResizeObserverStub[] = [];
class ResizeObserverStub {
  readonly targets: Element[] = [];
  disconnected = false;
  constructor(readonly callback: ResizeObserverCallback) {
    observers.push(this);
  }
  observe(target: Element): void {
    this.targets.push(target);
  }
  unobserve(): void {
    // noop
  }
  disconnect(): void {
    this.disconnected = true;
  }
  fire(): void {
    this.callback([], this);
  }
}

// jsdom has no layout. A host reports this size.
let hostSize = { width: 640, height: 288 };

beforeAll(() => {
  globalThis.ResizeObserver = ResizeObserverStub;
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.tagName === 'LIB-CHART' ? hostSize.width : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.tagName === 'LIB-CHART' ? hostSize.height : 0;
    },
  });
});

beforeEach(() => {
  instances.length = 0;
  onCreate = null;
  loader.mockClear();
  TestBed.configureTestingModule({ providers: [{ provide: CHART_LOADER, useValue: loader }] });
  observers.length = 0;
  hostSize = { width: 640, height: 288 };
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('style');
});

const LINE: ChartOption = { xAxis: { type: 'category' }, series: [{ type: 'line', data: [1] }] };
const BAR: ChartOption = { xAxis: { type: 'category' }, series: [{ type: 'bar', data: [2] }] };

@Component({
  imports: [Chart],
  template: `
    <lib-chart
      [option]="option()"
      [ariaLabel]="label()"
      [height]="height()"
      (chartClick)="clicks.push($event)"
      (ready)="readies = readies + 1"
    />
    @if (second()) {
      <lib-chart [option]="option()" ariaLabel="Second" (ready)="readies = readies + 1" />
    }
  `,
})
class Host {
  readonly option = signal<ChartOption>(LINE);
  readonly label = signal('Revenue per barber');
  readonly height = signal('18rem');
  readonly second = signal(false);
  readonly clicks: ChartClickEvent[] = [];
  readies = 0;
}

async function settle(fixture: ComponentFixture<Host>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  // The dynamic import resolves after the render. Wait for the instance it creates.
  await vi.waitFor(() => {
    if ((fixture.nativeElement as HTMLElement).querySelector('lib-chart:not([data-ready])')) {
      throw new Error('chart not ready');
    }
  });
  fixture.detectChanges();
  await fixture.whenStable();
}

function render(): ComponentFixture<Host> {
  return TestBed.createComponent(Host);
}

function host(fixture: ComponentFixture<Host>): HTMLElement {
  const element = (fixture.nativeElement as HTMLElement).querySelector('lib-chart');
  if (!(element instanceof HTMLElement)) {
    throw new Error('lib-chart not rendered');
  }
  return element;
}

function chart(index = 0): FakeChart {
  const instance = instances.at(index);
  if (!instance) {
    throw new Error(`chart ${String(index)} not created`);
  }
  return instance;
}

function lastOption(instance: FakeChart): Record<string, unknown> {
  const call = instance.setOption.mock.lastCall;
  if (!call) {
    throw new Error('setOption not called');
  }
  return call[0];
}

describe('Chart', () => {
  it('imports ECharts once for the whole app', async () => {
    const first = loadECharts();

    expect(loadECharts()).toBe(first);
    const module = await first;
    expect(typeof module.createChart).toBe('function');
  });

  it('loads ECharts only after the first render, and draws every chart', async () => {
    const fixture = render();
    fixture.componentInstance.second.set(true);
    expect(loader).not.toHaveBeenCalled();

    await settle(fixture);

    expect(instances).toHaveLength(2);
  });

  it('draws one chart per scheduler slot, its first option once, and reports ready', async () => {
    const slots: (() => void)[] = [];
    TestBed.overrideProvider(ChartScheduler, {
      useValue: {
        schedule: (job: () => void) => {
          slots.push(job);
          return () => undefined;
        },
      },
    });
    const fixture = render();
    fixture.componentInstance.second.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => {
      expect(slots).toHaveLength(2);
    });
    expect(instances).toHaveLength(0);

    slots[0]?.();
    expect(instances).toHaveLength(1);
    expect(chart().setOption).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.readies).toBe(1);

    fixture.detectChanges();
    await fixture.whenStable();
    // The effect sees the option already drawn and does not draw it again.
    expect(chart().setOption).toHaveBeenCalledTimes(1);

    slots[1]?.();
    expect(instances).toHaveLength(2);
  });

  it('reserves its height before ECharts loads', () => {
    const fixture = render();
    fixture.componentInstance.height.set('12rem');
    fixture.detectChanges();

    expect(host(fixture).style.height).toBe('12rem');
    expect(host(fixture).hasAttribute('data-ready')).toBe(false);
  });

  it('draws into the inner canvas with the SVG theme built from the tokens', async () => {
    document.documentElement.style.setProperty('--accent', 'rgb(1, 2, 3)');
    TestBed.inject(ChartTheme).refresh();
    const fixture = render();
    await settle(fixture);

    const instance = chart();
    expect(instance.element.classList.contains('chart-canvas')).toBe(true);
    const visualMap = instance.theme['visualMap'] as { inRange: { color: string[] } };
    expect(visualMap.inRange.color).toContain('rgb(1, 2, 3)');
  });

  it('names the chart for assistive technology', async () => {
    const fixture = render();
    await settle(fixture);

    const canvas = host(fixture).querySelector('.chart-canvas');
    expect(canvas?.getAttribute('role')).toBe('img');
    expect(canvas?.getAttribute('aria-label')).toBe('Revenue per barber');
    expect(lastOption(chart())['aria']).toEqual({
      enabled: true,
      label: { description: 'Revenue per barber' },
    });

    fixture.componentInstance.label.set('Bookings per service');
    await settle(fixture);
    expect(canvas?.getAttribute('aria-label')).toBe('Bookings per service');
    expect(lastOption(chart())['aria']).toEqual({
      enabled: true,
      label: { description: 'Bookings per service' },
    });
  });

  it('replaces the option whole when a new one arrives', async () => {
    const fixture = render();
    await settle(fixture);
    expect(lastOption(chart())['series']).toBe(LINE['series']);

    fixture.componentInstance.option.set(BAR);
    await settle(fixture);

    expect(lastOption(chart())['series']).toBe(BAR['series']);
    expect(chart().setOption.mock.lastCall?.[1]).toEqual({ notMerge: true });
  });

  it('resizes when the host resizes', async () => {
    const fixture = render();
    await settle(fixture);
    const observer = observers.find((item) => item.targets.includes(host(fixture)));
    if (!observer) {
      throw new Error('host not observed');
    }

    observer.fire();

    expect(chart().resize).toHaveBeenCalledTimes(1);
  });

  it('waits for a size before it creates the chart', async () => {
    hostSize = { width: 0, height: 0 };
    const fixture = render();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => {
      if (observers.length === 0) {
        throw new Error('not observed yet');
      }
    });
    expect(instances).toHaveLength(0);

    hostSize = { width: 640, height: 288 };
    observers.at(0)?.fire();
    await settle(fixture);

    expect(instances).toHaveLength(1);
    expect(chart().resize).not.toHaveBeenCalled();
  });

  it('re-themes when the theme changes', async () => {
    document.documentElement.style.setProperty('--accent', 'rgb(1, 2, 3)');
    TestBed.inject(ChartTheme).refresh();
    const fixture = render();
    await settle(fixture);
    const optionCalls = chart().setOption.mock.calls.length;

    document.documentElement.style.setProperty('--accent', 'rgb(4, 5, 6)');
    document.documentElement.setAttribute('data-theme', 'dark');
    await vi.waitFor(() => {
      expect(chart().setTheme).toHaveBeenCalledTimes(1);
    });
    await settle(fixture);

    const theme = chart().setTheme.mock.lastCall?.[0] as
      | { visualMap: { inRange: { color: string[] } } }
      | undefined;
    expect(theme?.visualMap.inRange.color).toContain('rgb(4, 5, 6)');
    // The theme re-applies the option. Setting it again would replay the entrance.
    expect(chart().setOption.mock.calls.length).toBe(optionCalls);
  });

  it('keeps a theme change that lands before the first option', async () => {
    document.documentElement.style.setProperty('--accent', 'rgb(1, 2, 3)');
    const theme = TestBed.inject(ChartTheme);
    theme.refresh();
    onCreate = () => {
      document.documentElement.style.setProperty('--accent', 'rgb(4, 5, 6)');
      theme.refresh();
    };
    const fixture = render();
    await settle(fixture);

    const visualMap = chart().applied['visualMap'] as { inRange: { color: string[] } };
    expect(visualMap.inRange.color).toContain('rgb(4, 5, 6)');
  });

  it('does not re-theme when the theme changes no token', async () => {
    const fixture = render();
    await settle(fixture);

    TestBed.inject(ChartTheme).refresh();
    await settle(fixture);

    expect(chart().setTheme).not.toHaveBeenCalled();
  });

  it('emits chartClick with the ECharts params', async () => {
    const fixture = render();
    await settle(fixture);
    const params = { seriesIndex: 0, dataIndex: 2, name: 'Nikos', value: 120 };

    chart().handlers.get('click')?.(params);

    expect(fixture.componentInstance.clicks).toEqual([params]);
  });

  it('disposes the chart and stops observing on destroy', async () => {
    const fixture = render();
    await settle(fixture);
    const instance = chart();
    const observer = observers.at(0);

    fixture.destroy();

    expect(instance.dispose).toHaveBeenCalledTimes(1);
    expect(observer?.disconnected).toBe(true);
  });

  it('creates nothing and observes nothing when destroyed while ECharts loads', async () => {
    let resolve: (module: ChartModule) => void = () => undefined;
    loader.mockImplementationOnce(
      () =>
        new Promise<ChartModule>((done) => {
          resolve = done;
        }),
    );
    const fixture = render();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => {
      expect(loader).toHaveBeenCalled();
    });

    fixture.destroy();
    resolve(fakeModule);
    await Promise.resolve();

    expect(instances).toHaveLength(0);
    expect(observers).toHaveLength(0);
  });

  describe('motion', () => {
    afterEach(() => {
      Reflect.deleteProperty(window, 'matchMedia');
    });

    it('enters over --dur-base with cubicOut', async () => {
      document.documentElement.style.setProperty('--dur-base', '180ms');
      TestBed.inject(ChartTheme).refresh();
      const fixture = render();
      await settle(fixture);

      const option = lastOption(chart());
      expect(option['animationDuration']).toBe(180);
      expect(option['animationEasing']).toBe('cubicOut');
      expect(option['animation']).toBeUndefined();
    });

    it('turns the animation off under reduced motion', async () => {
      window.matchMedia = ((query: string) => ({
        matches: query.includes('reduce'),
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      })) as unknown as typeof window.matchMedia;
      const fixture = render();
      await settle(fixture);

      expect(lastOption(chart())['animation']).toBe(false);
    });
  });
});

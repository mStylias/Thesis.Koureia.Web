import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormField, form, type ValidationError } from '@angular/forms/signals';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { provideUiCopy } from '@util/ui-copy';
import { RangePicker } from './range-picker';
import type { NumberRange, RangePickerUpdateOn } from './range-picker.types';
import {
  normalizeDomain,
  normalizeRange,
  normalizeStep,
  rangeRatio,
  snapRangeValue,
} from './range-picker.utils';
import { validateNumberRange } from './validate-number-range';

@Component({
  imports: [RangePicker],
  template: `
    <lib-range-picker
      [(value)]="value"
      [domainMin]="domainMin()"
      [domainMax]="domainMax()"
      [step]="step()"
      [updateOn]="updateOn()"
      [mode]="mode()"
      [currency]="currency()"
      [locale]="locale()"
      [prefix]="prefix()"
      [suffix]="suffix()"
      [valueFormatter]="valueFormatter()"
      [disabled]="disabled()"
      [readonly]="readonly()"
      [invalid]="invalid()"
      [touched]="touched()"
      [required]="requiredField()"
      [errors]="errors()"
      [ariaLabel]="ariaLabel()"
      [ariaDescribedby]="ariaDescribedby()"
      (touch)="touchCount = touchCount + 1"
      (valueCommitted)="committed.push($event)"
    />
  `,
})
class RangePickerHost {
  readonly value = signal<NumberRange>({ start: 20, end: 80 });
  readonly domainMin = signal(0);
  readonly domainMax = signal(100);
  readonly step = signal(5);
  readonly updateOn = signal<RangePickerUpdateOn>('change');
  readonly mode = signal<'decimal' | 'currency'>('decimal');
  readonly currency = signal('EUR');
  readonly locale = signal('en-US');
  readonly prefix = signal('');
  readonly suffix = signal('');
  readonly valueFormatter = signal<((value: number) => string) | undefined>(undefined);
  readonly disabled = signal(false);
  readonly readonly = signal(false);
  readonly invalid = signal(false);
  readonly touched = signal(false);
  readonly requiredField = signal(false);
  readonly errors = signal<readonly ValidationError.WithOptionalFieldTree[]>([]);
  readonly ariaLabel = signal('');
  readonly ariaDescribedby = signal('');

  touchCount = 0;
  readonly committed: NumberRange[] = [];
}

@Component({
  imports: [RangePicker, FormField],
  template: `<lib-range-picker
    [formField]="searchForm.price"
    [domainMin]="0"
    [domainMax]="100"
    updateOn="input"
  />`,
})
class SignalFormsHost {
  readonly model = signal({ price: { start: 10, end: 60 } });
  readonly searchForm = form(this.model, (path) => {
    validateNumberRange(path.price, { domainMin: 0, domainMax: 100 });
  });
}

describe('RangePicker', () => {
  let fixture: ComponentFixture<RangePickerHost>;
  let host: RangePickerHost;

  function root(): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector('lib-range-picker');
    if (!element) {
      throw new Error('lib-range-picker not rendered');
    }
    return element as HTMLElement;
  }

  function group(): HTMLElement {
    const element = root().querySelector<HTMLElement>('[role="group"]');
    if (!element) {
      throw new Error('range group not rendered');
    }
    return element;
  }

  function sliders(): readonly [HTMLInputElement, HTMLInputElement] {
    const elements = root().querySelectorAll<HTMLInputElement>('input[type="range"]');
    if (elements.length !== 2) {
      throw new Error('range sliders not rendered');
    }
    return [elements[0], elements[1]];
  }

  function numberInputs(): readonly [HTMLInputElement, HTMLInputElement] {
    const elements = root().querySelectorAll<HTMLInputElement>('lib-input-number input');
    if (elements.length !== 2) {
      throw new Error('number inputs not rendered');
    }
    return [elements[0], elements[1]];
  }

  function error(): HTMLElement | null {
    return root().querySelector<HTMLElement>('.range-error');
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function slide(index: 0 | 1, value: number, commit = false): Promise<void> {
    const slider = sliders()[index];
    slider.value = String(value);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    if (commit) {
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await settle();
  }

  async function enter(index: 0 | 1, text: string): Promise<void> {
    const field = numberInputs()[index];
    field.dispatchEvent(new FocusEvent('focus'));
    await settle();
    field.value = text;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new FocusEvent('blur'));
    field.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    await settle();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['el', 'en'],
            defaultLang: 'en',
            fallbackLang: 'en',
            missingHandler: { useFallbackTranslation: true },
          },
        }),
      ],
    });
    fixture = TestBed.createComponent(RangePickerHost);
    host = fixture.componentInstance;
    await settle();
    await firstValueFrom(TestBed.inject(TranslocoService).load('rangePicker/en'));
    await firstValueFrom(TestBed.inject(TranslocoService).load('inputNumber/en'));
    await settle();
  });

  it('keeps deferred slider input in a draft until change', async () => {
    await slide(0, 35);
    expect(host.value()).toEqual({ start: 20, end: 80 });
    expect(sliders()[0].value).toBe('35');

    sliders()[0].dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(host.value()).toEqual({ start: 35, end: 80 });
    expect(host.committed).toEqual([{ start: 35, end: 80 }]);
  });

  it('updates continuously in input mode and commits once on change', async () => {
    host.updateOn.set('input');
    await settle();

    await slide(1, 65);
    expect(host.value()).toEqual({ start: 20, end: 65 });
    expect(host.committed).toEqual([]);

    sliders()[1].dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(host.committed).toEqual([{ start: 20, end: 65 }]);
  });

  it('keeps stable thumb roles and clamps crossing values', async () => {
    host.updateOn.set('input');
    await settle();

    await slide(0, 95);
    expect(host.value()).toEqual({ start: 80, end: 80 });
    // The clamp lives in the model, so the native value follows it back.
    expect(sliders()[0].value).toBe('80');
  });

  it('spans the complete domain on both sliders so thumbs track the fill', () => {
    const [start, end] = sliders();
    expect([start.min, start.max]).toEqual(['0', '100']);
    expect([end.min, end.max]).toEqual(['0', '100']);

    const track = root().querySelector<HTMLElement>('.range-track');
    expect(track?.style.getPropertyValue('--range-start')).toBe('0.2');
    expect(track?.style.getPropertyValue('--range-end')).toBe('0.8');

    // A native thumb sits at min + ratio * (max - min) of its own span. Equal
    // spans are what keep that position and the fill ratio in agreement.
    expect(rangeRatio(20, { start: 0, end: 100 })).toBe(0.2);
  });

  it('commits exact numeric entry on field blur', async () => {
    await enter(0, '45');
    expect(host.value()).toEqual({ start: 45, end: 80 });
    expect(host.committed).toEqual([{ start: 45, end: 80 }]);
  });

  it('restores a required endpoint after an empty edit', async () => {
    await enter(0, '');
    expect(host.value()).toEqual({ start: 20, end: 80 });
    expect(numberInputs()[0].value).toBe('20');
    expect(host.committed).toEqual([]);
  });

  it('moves the nearest thumb when the track is dragged', async () => {
    const track = root().querySelector<HTMLElement>('.range-track');
    if (!track) {
      throw new Error('range track not rendered');
    }
    track.getBoundingClientRect = () => ({
      left: 0,
      width: 200,
      right: 200,
      top: 0,
      bottom: 44,
      height: 44,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    track.setPointerCapture = () => undefined;
    track.hasPointerCapture = () => true;
    track.releasePointerCapture = () => undefined;

    const pointer = (type: string, clientX: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        clientX: { value: clientX },
        pointerId: { value: 7 },
      });
      track.dispatchEvent(event);
    };

    pointer('pointerdown', 100);
    await settle();
    expect(host.value()).toEqual({ start: 20, end: 80 });
    expect(sliders()[0].value).toBe('50');

    pointer('pointermove', 140);
    pointer('pointerup', 140);
    await settle();
    expect(host.value()).toEqual({ start: 70, end: 80 });
    expect(host.committed).toEqual([{ start: 70, end: 80 }]);

    // A collapsed range opens by direction: distance alone ties on both bounds.
    host.value.set({ start: 0, end: 0 });
    await settle();
    pointer('pointerdown', 100);
    pointer('pointerup', 100);
    await settle();
    expect(host.value()).toEqual({ start: 0, end: 50 });
  });

  it('uses one custom formatter for fields and slider value text', async () => {
    host.prefix.set('~');
    host.suffix.set(' away');
    host.valueFormatter.set((value) => `${String(value / 10)} km`);
    await settle();

    expect(numberInputs()[0].value).toBe('~2 km away');
    expect(numberInputs()[1].value).toBe('~8 km away');
    expect(sliders()[0].getAttribute('aria-valuetext')).toBe('~2 km away');
    expect(sliders()[1].getAttribute('aria-valuetext')).toBe('~8 km away');
  });

  it('renders translated names and formatted value text', () => {
    const [start, end] = sliders();
    expect(group().getAttribute('aria-label')).toBe('Range');
    expect(start.getAttribute('aria-label')).toBe('Minimum');
    expect(end.getAttribute('aria-label')).toBe('Maximum');
    expect(start.getAttribute('aria-valuetext')).toBe('20');
    expect(end.getAttribute('aria-valuetext')).toBe('80');
  });

  it('steps an endpoint from the keyboard through the native slider', async () => {
    const [start] = sliders();
    start.focus();
    start.value = '25';
    start.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    start.dispatchEvent(new Event('input', { bubbles: true }));
    start.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();

    expect(host.value()).toEqual({ start: 25, end: 80 });
    expect(host.committed).toEqual([{ start: 25, end: 80 }]);
  });

  it('formats both endpoints with the built-in currency mode', async () => {
    host.mode.set('currency');
    host.currency.set('EUR');
    await settle();

    expect(numberInputs()[0].value).toBe('€20.00');
    expect(sliders()[1].getAttribute('aria-valuetext')).toBe('€80.00');
  });

  it('renormalizes when the model or the domain changes outside', async () => {
    // Off-grid and out of order: the view snaps and orders it without writing back.
    host.value.set({ start: 73, end: 12 });
    await settle();
    expect(numberInputs()[0].value).toBe('10');
    expect(numberInputs()[1].value).toBe('75');
    expect(sliders()[0].value).toBe('10');
    expect(host.value()).toEqual({ start: 73, end: 12 });
    expect(host.committed).toEqual([]);

    host.domainMax.set(50);
    await settle();
    expect(sliders()[0].max).toBe('50');
    expect(numberInputs()[1].value).toBe('50');
  });

  it('keeps the track and thumbs visible under forced colors', () => {
    // Vitest builds the component without its styles, so the guard reads the
    // stylesheet source: the forced-colors block must keep system colors.
    // Vitest roots this project at the library directory.
    const stylesheet = readFileSync(join(process.cwd(), 'src/range-picker.scss'), 'utf8');
    const forced = stylesheet.slice(stylesheet.indexOf('forced-colors'));

    expect(stylesheet).toContain('@media (forced-colors: active)');
    expect(forced).toContain('CanvasText');
    expect(forced).toContain('Highlight');
    expect(forced).toContain('ButtonText');
    expect(forced).toContain('ButtonFace');
  });

  it('composes descriptions and renders one group error', async () => {
    host.ariaDescribedby.set('price-hint');
    host.invalid.set(true);
    host.touched.set(true);
    host.errors.set([{ kind: 'numberRange.order' }]);
    await settle();

    expect(error()?.textContent.trim()).toBe('The minimum must not exceed the maximum.');
    const describedBy = group().getAttribute('aria-describedby');
    expect(describedBy).toContain('price-hint');
    expect(describedBy).toContain(error()?.id ?? 'missing');
    expect(root().querySelectorAll('[role="alert"]')).toHaveLength(1);
  });

  it('blocks disabled and read-only edits through every rendered control', async () => {
    host.disabled.set(true);
    await settle();
    expect(sliders().every((slider) => slider.disabled)).toBe(true);
    expect(numberInputs().every((field) => field.disabled)).toBe(true);
    await slide(0, 40, true);
    expect(host.value()).toEqual({ start: 20, end: 80 });

    host.disabled.set(false);
    host.readonly.set(true);
    await settle();
    expect(sliders()[0].getAttribute('aria-readonly')).toBe('true');
    expect(numberInputs().every((field) => field.readOnly)).toBe(true);
    await slide(1, 60, true);
    expect(host.value()).toEqual({ start: 20, end: 80 });
  });

  it('emits touch only when focus leaves the composite', async () => {
    root().dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: numberInputs()[1] }),
    );
    await settle();
    expect(host.touchCount).toBe(0);

    root().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    await settle();
    expect(host.touchCount).toBe(1);
  });

  it('round-trips an object value through Signal Forms', async () => {
    const formsFixture = TestBed.createComponent(SignalFormsHost);
    await formsFixture.whenStable();
    const formsHost = formsFixture.componentInstance;
    const end = (formsFixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '.range-slider-end',
    );
    if (!end) {
      throw new Error('Signal Forms end slider not rendered');
    }

    end.value = '75';
    end.dispatchEvent(new Event('input', { bubbles: true }));
    await formsFixture.whenStable();
    expect(formsHost.model().price).toEqual({ start: 10, end: 75 });

    formsHost.model.set({ price: { start: 90, end: 20 } });
    await formsFixture.whenStable();
    expect(formsHost.searchForm.price().valid()).toBe(false);
  });
});

describe('range picker normalization', () => {
  it('orders domains and ranges and normalizes unusable steps', () => {
    expect(normalizeDomain(100, 0)).toEqual({ start: 0, end: 100 });
    expect(normalizeRange({ start: 120, end: -5 }, { start: 0, end: 100 })).toEqual({
      start: 0,
      end: 100,
    });
    expect(normalizeStep(0)).toBe(1);
    expect(snapRangeValue(0.29, { start: 0, end: 1 }, 0.1)).toBe(0.3);
  });

  it('snaps an external range onto the step grid', () => {
    expect(normalizeRange({ start: 3, end: 88 }, { start: 0, end: 100 }, 5)).toEqual({
      start: 5,
      end: 90,
    });
    expect(normalizeRange({ start: NaN, end: NaN }, { start: 0, end: 100 }, 5)).toEqual({
      start: 0,
      end: 100,
    });
  });

  it('keeps the domain end reachable on an off-grid span', () => {
    const domain = { start: 0, end: 100 };
    expect(snapRangeValue(100, domain, 3)).toBe(100);
    expect(snapRangeValue(99.6, domain, 3)).toBe(100);
    expect(snapRangeValue(99.2, domain, 3)).toBe(99);
    expect(snapRangeValue(50, domain, 3)).toBe(51);
  });

  it('reports positions as unitless ratios', () => {
    expect(rangeRatio(25, { start: 0, end: 100 })).toBe(0.25);
    expect(rangeRatio(150, { start: 0, end: 100 })).toBe(1);
    expect(rangeRatio(5, { start: 5, end: 5 })).toBe(0);
  });
});

describe('RangePicker copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({ 'rangePicker.from': 'customer.from' }),
      ],
    });
    const fixture = TestBed.createComponent(RangePickerHost);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { from: 'Starting at' } }, 'en', { merge: true });
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('rangePicker/en'));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Starting at');
  });
});

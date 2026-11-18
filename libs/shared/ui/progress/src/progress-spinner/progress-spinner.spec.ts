import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ProgressSpinner } from './progress-spinner';
import { ProgressMode, ProgressSize, ProgressSpin, ProgressTone } from '../progress.types';

@Component({
  imports: [ProgressSpinner],
  template: `
    <lib-progress-spinner
      [value]="value()"
      [mode]="mode()"
      [tone]="tone()"
      [size]="size()"
      [spin]="spin()"
      [showValue]="showValue()"
      ariaLabel="Loading"
    />
  `,
})
class SpinnerHost {
  readonly value = signal(75);
  readonly mode = signal<ProgressMode>('indeterminate');
  readonly tone = signal<ProgressTone>('accent');
  readonly size = signal<ProgressSize>('md');
  readonly spin = signal<ProgressSpin>('linear');
  readonly showValue = signal(false);
}

describe('ProgressSpinner', () => {
  let fixture: ComponentFixture<SpinnerHost>;
  let host: SpinnerHost;

  function root(): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector('lib-progress-spinner');
    if (!element) {
      throw new Error('lib-progress-spinner not rendered');
    }
    return element as HTMLElement;
  }

  function indicator(): SVGCircleElement {
    const element = root().querySelector<SVGCircleElement>('.progress-spinner-indicator');
    if (!element) {
      throw new Error('indicator not rendered');
    }
    return element;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    fixture = TestBed.createComponent(SpinnerHost);
    host = fixture.componentInstance;
    await settle();
  });

  it('is a named progressbar with no value while indeterminate', () => {
    expect(root().getAttribute('role')).toBe('progressbar');
    expect(root().getAttribute('aria-label')).toBe('Loading');
    expect(root().hasAttribute('aria-valuenow')).toBe(false);
  });

  it('draws a fixed arc while indeterminate (normalized to pathLength 100)', () => {
    expect(indicator().getAttribute('pathLength')).toBe('100');
    expect(indicator().getAttribute('stroke-dasharray')).toBe('25 100');
    expect(indicator().getAttribute('stroke-dashoffset')).toBe('0');
  });

  it('fills the ring to the value while determinate', async () => {
    host.mode.set('determinate');
    await settle();

    expect(root().getAttribute('aria-valuenow')).toBe('75');
    expect(indicator().getAttribute('stroke-dasharray')).toBe('100');
    // 75% filled → a quarter of the (normalized) ring remains hidden.
    expect(indicator().getAttribute('stroke-dashoffset')).toBe('25');
  });

  it('shows a centred value only when determinate and showValue', async () => {
    host.showValue.set(true);
    await settle();
    // Still indeterminate — no label.
    expect(root().querySelector('.progress-spinner-label')).toBeNull();

    host.mode.set('determinate');
    await settle();
    expect(root().querySelector('.progress-spinner-label')?.textContent).toContain('75%');

    host.showValue.set(false);
    await settle();
    expect(root().querySelector('.progress-spinner-label')?.textContent.trim()).toBe('');
  });

  it('reflects tone and size as data attributes', async () => {
    host.tone.set('info');
    host.size.set('sm');
    await settle();

    expect(root().getAttribute('data-tone')).toBe('info');
    expect(root().getAttribute('data-size')).toBe('sm');
  });

  it('reflects the spin style as data-spin', async () => {
    expect(root().getAttribute('data-spin')).toBe('linear');

    host.spin.set('ease');
    await settle();
    expect(root().getAttribute('data-spin')).toBe('ease');
  });
});

@Component({
  imports: [ProgressSpinner],
  template: `
    <lib-progress-spinner mode="determinate" [value]="60" ariaLabel="Steps">
      3/5
    </lib-progress-spinner>
  `,
})
class ProjectedLabelHost {}

describe('ProgressSpinner (projected label)', () => {
  // Regression: the slot used to sit inside `@if (showValue() && …)`, and
  // `showValue` defaults to false — so a projected label was never created.
  it('renders projected content without showValue', async () => {
    const fixture = TestBed.createComponent(ProjectedLabelHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const label = (fixture.nativeElement as HTMLElement).querySelector('.progress-spinner-label');
    expect(label?.textContent).toContain('3/5');
    expect(label?.textContent).not.toContain('60%');
  });
});

@Component({
  imports: [ProgressSpinner],
  template: `<lib-progress-spinner [mode]="mode()" />`,
})
class UnnamedHost {
  readonly mode = signal<ProgressMode>('indeterminate');
}

describe('ProgressSpinner (fallback name)', () => {
  let fixture: ComponentFixture<UnnamedHost>;
  let host: UnnamedHost;

  function root(): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector('lib-progress-spinner');
    if (!element) {
      throw new Error('lib-progress-spinner not rendered');
    }
    return element as HTMLElement;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
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
    fixture = TestBed.createComponent(UnnamedHost);
    host = fixture.componentInstance;
    await settle();
    // A pipe must transform before the scope's inline loader is registered.
    await firstValueFrom(TestBed.inject(TranslocoService).load('progress/en'));
    await settle();
  });

  it('names an unnamed spinner from the lib scope', () => {
    const nameId = root().getAttribute('aria-labelledby');
    expect(nameId).toMatch(/^lib-progress-spinner-name-\d+$/);
    expect(
      root()
        .querySelector(`[id="${nameId ?? ''}"]`)
        ?.textContent.trim(),
    ).toBe('Loading');
    expect(root().hasAttribute('aria-label')).toBe(false);
  });

  it('words the fallback as progress while determinate', async () => {
    host.mode.set('determinate');
    await settle();

    const nameId = root().getAttribute('aria-labelledby');
    expect(
      root()
        .querySelector(`[id="${nameId ?? ''}"]`)
        ?.textContent.trim(),
    ).toBe('Progress');
  });
});

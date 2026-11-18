import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';
import { firstValueFrom } from 'rxjs';
import { ProgressBar } from './progress-bar';
import { ProgressMode, ProgressSize, ProgressTone } from '../progress.types';

@Component({
  imports: [ProgressBar],
  template: `
    <lib-progress-bar
      [value]="value()"
      [mode]="mode()"
      [tone]="tone()"
      [size]="size()"
      [showValue]="showValue()"
      ariaLabel="Upload progress"
    />
  `,
})
class ProgressBarHost {
  readonly value = signal(40);
  readonly mode = signal<ProgressMode>('determinate');
  readonly tone = signal<ProgressTone>('accent');
  readonly size = signal<ProgressSize>('md');
  readonly showValue = signal(true);
}

describe('ProgressBar', () => {
  let fixture: ComponentFixture<ProgressBarHost>;
  let host: ProgressBarHost;

  function root(): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector('lib-progress-bar');
    if (!element) {
      throw new Error('lib-progress-bar not rendered');
    }
    return element as HTMLElement;
  }

  function fill(): HTMLElement {
    const element = root().querySelector<HTMLElement>('.progress-bar-fill');
    if (!element) {
      throw new Error('fill not rendered');
    }
    return element;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    fixture = TestBed.createComponent(ProgressBarHost);
    host = fixture.componentInstance;
    await settle();
  });

  it('exposes the progressbar role and ARIA value range', () => {
    expect(root().getAttribute('role')).toBe('progressbar');
    expect(root().getAttribute('aria-valuemin')).toBe('0');
    expect(root().getAttribute('aria-valuemax')).toBe('100');
    expect(root().getAttribute('aria-valuenow')).toBe('40');
    expect(root().getAttribute('aria-label')).toBe('Upload progress');
  });

  it('renders no fallback name once the consumer supplied one', () => {
    expect(root().querySelector('.progress-bar-a11y-text')).toBeNull();
    expect(root().hasAttribute('aria-labelledby')).toBe(false);
  });

  it('fills the track to the value and shows the rounded label', async () => {
    host.value.set(72.4);
    await settle();

    expect(fill().style.getPropertyValue('--_scale')).toBe('0.72');
    expect(root().textContent).toContain('72%');
    expect(root().getAttribute('aria-valuenow')).toBe('72');
  });

  it('clamps out-of-range values into [0, 100]', async () => {
    host.value.set(150);
    await settle();
    expect(root().getAttribute('aria-valuenow')).toBe('100');

    host.value.set(-20);
    await settle();
    expect(root().getAttribute('aria-valuenow')).toBe('0');
  });

  it('drops aria-valuenow and the label while indeterminate', async () => {
    host.mode.set('indeterminate');
    await settle();

    expect(root().hasAttribute('aria-valuenow')).toBe(false);
    expect(root().querySelector('.progress-bar-label')).toBeNull();
    expect(fill().style.getPropertyValue('--_scale')).toBe('');
  });

  it('hides the label when showValue is false', async () => {
    host.showValue.set(false);
    await settle();

    expect(root().querySelector('.progress-bar-label')).toBeNull();
    expect(root().getAttribute('aria-valuenow')).toBe('40');
  });

  it('reflects tone and size as data attributes', async () => {
    host.tone.set('error');
    host.size.set('lg');
    await settle();

    expect(root().getAttribute('data-tone')).toBe('error');
    expect(root().getAttribute('data-size')).toBe('lg');
  });
});

@Component({
  imports: [ProgressBar],
  template: ` <lib-progress-bar [value]="30" ariaLabel="Sync">3 of 10 files</lib-progress-bar> `,
})
class ProjectedLabelHost {}

@Component({
  imports: [ProgressBar],
  template: `
    <span id="report-label">Report generation</span>
    <lib-progress-bar
      [value]="20"
      [mode]="mode()"
      [ariaLabel]="ariaLabel()"
      [ariaLabelledby]="ariaLabelledby()"
    />
  `,
})
class UnnamedHost {
  readonly mode = signal<ProgressMode>('determinate');
  readonly ariaLabel = signal('');
  readonly ariaLabelledby = signal('');
}

describe('ProgressBar (projected label)', () => {
  it('replaces the built-in percentage with projected content', async () => {
    const fixture = TestBed.createComponent(ProjectedLabelHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const label = (fixture.nativeElement as HTMLElement).querySelector('.progress-bar-label');
    expect(label?.textContent).toContain('3 of 10 files');
    expect(label?.textContent).not.toContain('30%');
  });
});

describe('ProgressBar (fallback name)', () => {
  let fixture: ComponentFixture<UnnamedHost>;
  let host: UnnamedHost;

  function root(): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector('lib-progress-bar');
    if (!element) {
      throw new Error('lib-progress-bar not rendered');
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
    // The `progress` scope loads through a dynamic import, and only a
    // transformed pipe registers its inline loader — hence the settle()
    // above before the load, never the other way round.
    await firstValueFrom(TestBed.inject(TranslocoService).load('progress/en'));
    await settle();
  });

  it('names an unnamed bar from the lib scope', () => {
    const nameId = root().getAttribute('aria-labelledby');
    expect(nameId).toMatch(/^lib-progress-bar-name-\d+$/);

    const name = root().querySelector(`[id="${nameId ?? ''}"]`);
    expect(name?.textContent.trim()).toBe('Progress');
    // The name lives inside the progressbar, so it is hidden from the
    // subtree and only reachable through the id reference.
    expect(name?.getAttribute('aria-hidden')).toBe('true');
    expect(root().hasAttribute('aria-label')).toBe(false);
  });

  it('words the fallback as loading while indeterminate', async () => {
    host.mode.set('indeterminate');
    await settle();

    const nameId = root().getAttribute('aria-labelledby');
    const name = root().querySelector(`[id="${nameId ?? ''}"]`);
    expect(name?.textContent.trim()).toBe('Loading');
  });

  it('drops the fallback once the consumer names the bar', async () => {
    host.ariaLabel.set('Upload progress');
    await settle();

    expect(root().getAttribute('aria-label')).toBe('Upload progress');
    expect(root().hasAttribute('aria-labelledby')).toBe(false);
    expect(root().querySelector('.progress-bar-a11y-text')).toBeNull();
  });

  it('never emits a label that competes with aria-labelledby', async () => {
    host.ariaLabel.set('Upload progress');
    host.ariaLabelledby.set('report-label');
    await settle();

    expect(root().getAttribute('aria-labelledby')).toBe('report-label');
    expect(root().hasAttribute('aria-label')).toBe(false);
  });
});

describe('ProgressBar copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({ 'progress.progressLabel': 'customer.progressLabel' }),
      ],
    });
    const fixture = TestBed.createComponent(UnnamedHost);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { progressLabel: 'Almost there' } }, 'en', {
      merge: true,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('progress/en'));
    fixture.detectChanges();

    const bar = (fixture.nativeElement as HTMLElement).querySelector('lib-progress-bar');
    const name = bar?.querySelector(`[id="${bar.getAttribute('aria-labelledby') ?? ''}"]`);
    expect(name?.textContent.trim()).toBe('Almost there');
  });
});

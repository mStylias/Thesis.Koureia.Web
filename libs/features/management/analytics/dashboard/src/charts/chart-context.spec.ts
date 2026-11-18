import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { TEST_PERIOD } from '../testing/dashboard.fixtures';
import { injectChartContext } from './chart-context';

// The pipe comes first: its load finishes while the template renders.
@Component({
  imports: [TranslocoPipe],
  template: `<span>{{ 'managementDashboard.title' | transloco }}</span>
    <b>{{ context()?.locale }}</b>`,
})
class Host {
  readonly context = injectChartContext(() => TEST_PERIOD);
}

describe('injectChartContext', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['el', 'en'],
            defaultLang: 'el',
            missingHandler: { logMissingKey: false },
          },
        }),
      ],
    });
  });

  it('renders while the language loads, and builds the context again after the load', async () => {
    const fixture = TestBed.createComponent(Host);
    const before = fixture.componentInstance.context();

    fixture.detectChanges();
    await fixture.whenStable();

    const after = fixture.componentInstance.context();
    expect(after).not.toBeNull();
    expect(after).not.toBe(before);
    expect((fixture.nativeElement as HTMLElement).querySelector('b')?.textContent).toBe('el');
  });

  it('follows a language change', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    TestBed.inject(TranslocoService).setActiveLang('en');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.context()?.locale).toBe('en');
    expect((fixture.nativeElement as HTMLElement).querySelector('b')?.textContent).toBe('en');
  });
});

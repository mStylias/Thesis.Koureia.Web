import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LoadingScreen } from './loading-screen';

@Component({
  imports: [LoadingScreen],
  template: `
    <lib-loading-screen
      [loading]="loading()"
      [logo]="logo()"
      [minDuration]="minDuration()"
      [ariaLabel]="ariaLabel()"
    />
  `,
})
class Host {
  readonly loading = signal(false);
  readonly logo = signal('/brand/icon.png');
  readonly minDuration = signal(500);
  readonly ariaLabel = signal('');
}

describe('LoadingScreen', () => {
  let fixture: ComponentFixture<Host>;

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };

  const query = (selector: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(selector);

  const overlay = () => query('.loading-screen');

  const logoImage = (): HTMLImageElement => {
    const image = query('.loading-screen-logo');
    if (image === null) throw new Error('logo not rendered');
    return image as HTMLImageElement;
  };

  const announcedName = (): string => {
    const text = query('.loading-screen-a11y-text');
    if (text === null) throw new Error('accessible name not rendered');
    return text.textContent.trim();
  };

  beforeEach(async () => {
    vi.useFakeTimers();

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

    fixture = TestBed.createComponent(Host);
    await settle();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing until it is loading', () => {
    expect(overlay()).toBeNull();
  });

  it('covers the screen while loading, naming itself in a live region', async () => {
    fixture.componentInstance.loading.set(true);
    await settle();

    expect(overlay()?.getAttribute('role')).toBe('status');
    expect(logoImage().getAttribute('src')).toBe('/brand/icon.png');
  });

  it('draws the indicator alone when no logo is given', async () => {
    fixture.componentInstance.logo.set('');
    fixture.componentInstance.loading.set(true);
    await settle();

    expect(query('.loading-screen-logo')).toBeNull();
    expect(query('.loading-screen-bar-fill')).not.toBeNull();
  });

  it('holds for the rest of the floor when loading finishes early', async () => {
    fixture.componentInstance.loading.set(true);
    await settle();

    vi.advanceTimersByTime(60);
    fixture.componentInstance.loading.set(false);
    await settle();

    expect(overlay()).not.toBeNull();

    vi.advanceTimersByTime(440);
    await settle();

    expect(overlay()).toBeNull();
  });

  it('adds nothing to a load that already outlasts the floor', async () => {
    fixture.componentInstance.loading.set(true);
    await settle();

    vi.advanceTimersByTime(900);
    await settle();

    // The floor elapsed long ago, so lowering the flag hides it in the same pass.
    expect(overlay()).not.toBeNull();

    fixture.componentInstance.loading.set(false);
    await settle();

    expect(overlay()).toBeNull();
  });

  it('treats a floor of zero as no floor at all', async () => {
    fixture.componentInstance.minDuration.set(-1);
    fixture.componentInstance.loading.set(true);
    await settle();

    fixture.componentInstance.loading.set(false);
    vi.advanceTimersByTime(0);
    await settle();

    expect(overlay()).toBeNull();
  });

  it('shows again for a later entry', async () => {
    fixture.componentInstance.loading.set(true);
    await settle();
    vi.advanceTimersByTime(500);
    fixture.componentInstance.loading.set(false);
    await settle();
    expect(overlay()).toBeNull();

    fixture.componentInstance.loading.set(true);
    await settle();

    expect(overlay()).not.toBeNull();
  });

  it('falls back to the translated name and lets a consumer override it', async () => {
    fixture.componentInstance.loading.set(true);
    await settle();
    await vi.advanceTimersByTimeAsync(0);
    await firstValueFrom(TestBed.inject(TranslocoService).load('loadingScreen/en'));
    await settle();

    expect(announcedName()).toBe('Loading');

    fixture.componentInstance.ariaLabel.set('Opening the workspace');
    await settle();

    expect(announcedName()).toBe('Opening the workspace');
  });
});

describe('LoadingScreen copy', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads a key the consumer overrides in place of its own', async () => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({ 'loadingScreen.label': 'customer.loadingLabel' }),
      ],
    });
    const fixture = TestBed.createComponent(Host);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { loadingLabel: 'Getting ready' } }, 'en', {
      merge: true,
    });
    fixture.componentInstance.loading.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.advanceTimersByTimeAsync(0);
    await firstValueFrom(transloco.load('loadingScreen/en'));
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).querySelector('.loading-screen-a11y-text');
    expect(text?.textContent.trim()).toBe('Getting ready');
  });
});

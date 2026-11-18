import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injectable, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  TranslocoService,
  provideTransloco,
  type Translation,
  type TranslocoLoader,
} from '@jsverse/transloco';
import { provideSynaxApi } from '@synax/client';
import { ToasterService } from '@ui/toaster';
import { BRAND } from '@util/brand';
import { firstValueFrom, of, type Observable } from 'rxjs';

import type { PushState } from '../core/push-state.types';
import el from '../i18n/el';
import { PushReminders } from '../push-reminders';
import type { PushEnableOutcome } from '../push-reminders.types';
import { remindersInlineLoader } from '../reminders.i18n';
import { ReminderCard } from './reminder-card';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

const PROFILE_URL = 'https://api.test/api/v1/users/me';

/** The Greek text of a `reminders` key. */
function t(path: string): string {
  const value = path.split('.').reduce<unknown>((node, key) => (node as Translation)[key], el);
  if (typeof value !== 'string') throw new Error(`${path} is not a string`);
  return value;
}

describe('ReminderCard', () => {
  let fixture: ComponentFixture<ReminderCard>;
  let http: HttpTestingController;
  const state = signal<PushState>('unknown');
  const push = {
    state,
    platform: signal(null),
    check: vi.fn(() => Promise.resolve()),
    enable: vi.fn((): Promise<PushEnableOutcome> => Promise.resolve('on')),
  };

  beforeEach(async () => {
    localStorage.clear();
    state.set('unknown');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'https://api.test', defaultVersion: 1 }),
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'el' },
          loader: EmptyLoader,
        }),
        { provide: PushReminders, useValue: push },
        { provide: BRAND, useValue: { logo: '/brand/test.png' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    // Loaded before the render, as the route resolvers do.
    await firstValueFrom(
      TestBed.inject(TranslocoService).load('reminders/el', {
        inlineLoader: remindersInlineLoader,
      }),
    );
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  async function render(
    pushState: PushState,
    emailReminders: boolean | null = true,
    options: { cue?: boolean } = {},
  ) {
    state.set('unknown');
    fixture = TestBed.createComponent(ReminderCard);
    if (options.cue) fixture.componentRef.setInput('cue', true);
    await settle();
    state.set(pushState);
    // The profile read is pending until flushed, so `whenStable` would wait for it.
    fixture.detectChanges();
    TestBed.tick();
    if (emailReminders !== null) {
      http.expectOne(PROFILE_URL).flush({ email: 'a@b.gr', emailRemindersEnabled: emailReminders });
    }
    await settle();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent;
  }

  function button(label: string): HTMLButtonElement {
    const found = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ).find((candidate) => candidate.textContent.includes(label));
    if (found === undefined) throw new Error(`${label} not rendered`);
    return found;
  }

  it('offers push, with the email sentence', async () => {
    await render('available');

    expect(text()).toContain(t('card.title'));
    expect(text()).toContain(t('card.lineWithEmail'));
    expect(button(t('card.enable'))).toBeTruthy();
    expect(button(t('card.notNow'))).toBeTruthy();
  });

  it('leaves the email sentence out when the reminder emails are off', async () => {
    await render('off', false);

    expect(text()).toContain(t('card.line'));
    expect(text()).not.toContain(t('card.lineWithEmail'));
  });

  it('sends an iPhone to the guide', async () => {
    await render('needs-home-screen');

    expect(text()).toContain('brand.reminders.iphoneLine');
    expect(button(t('card.howTo'))).toBeTruthy();
    expect(text()).not.toContain(t('card.enable'));
  });

  it('offers only "Not now" in an in-app browser', async () => {
    await render('in-app-browser');

    expect(text()).toContain(t('card.inApp'));
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('button')).toHaveLength(1);
  });

  it('is one line, with no buttons, once push is on', async () => {
    await render('on', null);

    expect(text()).toContain(t('card.on'));
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('button')).toHaveLength(0);
  });

  it.each<PushState>(['unsupported', 'blocked', 'unknown'])(
    'renders nothing when %s',
    async (s) => {
      await render(s, null);

      expect((fixture.nativeElement as HTMLElement).querySelector('section')).toBeNull();
    },
  );

  it('turns push on, with a toast', async () => {
    const success = vi.spyOn(TestBed.inject(ToasterService), 'success');
    await render('available');

    button(t('card.enable')).click();
    state.set('on');
    await settle();

    expect(push.enable).toHaveBeenCalledOnce();
    expect(success).toHaveBeenCalledOnce();
    expect(text()).toContain(t('card.on'));
  });

  it('hides for 30 days after "Not now"', async () => {
    await render('available');

    button(t('card.notNow')).click();
    await settle();
    expect((fixture.nativeElement as HTMLElement).querySelector('section')).toBeNull();

    // The next booking on this browser.
    fixture.destroy();
    await render('available', null);
    expect((fixture.nativeElement as HTMLElement).querySelector('section')).toBeNull();
  });

  it('shows again after "Not now" when the browser has no storage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    await render('available');

    button(t('card.notNow')).click();
    await settle();
    fixture.destroy();
    await render('available');

    expect((fixture.nativeElement as HTMLElement).querySelector('section')).not.toBeNull();
  });

  describe('cue', () => {
    let report: (entry: Partial<IntersectionObserverEntry>) => void;
    const scrollIntoView = vi.fn();

    beforeEach(() => {
      // jsdom has no layout. The test reports where the card is, as the browser would.
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          constructor(callback: IntersectionObserverCallback) {
            report = (entry) => {
              callback(
                [entry as IntersectionObserverEntry],
                this as unknown as IntersectionObserver,
              );
            };
          }
          observe(): void {
            return;
          }
          disconnect(): void {
            return;
          }
        },
      );
      vi.stubGlobal('matchMedia', () => ({ matches: false }));
      scrollIntoView.mockClear();
      HTMLElement.prototype.scrollIntoView = scrollIntoView;
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    function cue(): HTMLButtonElement | null {
      return (fixture.nativeElement as HTMLElement).querySelector('.reminder-cue button');
    }

    async function cardAt(top: number, ratio: number): Promise<void> {
      report({ intersectionRatio: ratio, boundingClientRect: { top } as DOMRectReadOnly });
      await settle();
    }

    it('points at the card while it is below the fold', async () => {
      await render('available', true, { cue: true });
      await cardAt(900, 0);

      expect(cue()?.textContent).toContain(t('card.cue'));
    });

    it('scrolls to the card, focuses it and goes for good', async () => {
      await render('available', true, { cue: true });
      await cardAt(900, 0);

      cue()?.click();
      await settle();

      const card = (fixture.nativeElement as HTMLElement).querySelector('section');
      expect(scrollIntoView).toHaveBeenCalledOnce();
      expect(document.activeElement).toBe(card);
      expect(card?.hasAttribute('data-highlighted')).toBe(true);
      expect(cue()).toBeNull();

      await cardAt(900, 0);
      expect(cue()).toBeNull();
    });

    it('does not come back once the card has been seen', async () => {
      await render('available', true, { cue: true });
      await cardAt(300, 1);
      await cardAt(900, 0);

      expect(cue()).toBeNull();
    });

    it('stays away from a card above the fold', async () => {
      await render('available', true, { cue: true });
      await cardAt(-400, 0);

      expect(cue()).toBeNull();
    });

    it('has nothing to point at in an in-app browser', async () => {
      await render('in-app-browser', true, { cue: true });
      await cardAt(900, 0);

      expect(cue()).toBeNull();
    });

    it('is off unless the host asks for it', async () => {
      await render('available');

      expect(cue()).toBeNull();
    });
  });
});

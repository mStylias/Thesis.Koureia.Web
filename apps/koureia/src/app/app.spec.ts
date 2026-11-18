import { Component, computed, signal } from '@angular/core';
import { provideRouter, RouterOutlet } from '@angular/router';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { provideTransloco, Translation, TranslocoLoader } from '@jsverse/transloco';
import { Observable, of } from 'rxjs';
import { SessionStore } from '@auth/data-access';
import { provideBrand } from '@util/brand';
import { App } from './app';

@Component({ template: 'routed' })
class Routed {}

/** The copy is not what these tests are about; only which surfaces render at all. */
class SilentTranslocoLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

const status = signal<'signed-out' | 'signed-in' | 'expired'>('signed-out');

describe('App', () => {
  beforeEach(async () => {
    status.set('signed-out');
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        // RouterOutlet injects ChildrenOutletContexts and ActivatedRoute on init.
        provideRouter([{ path: '', component: Routed }]),
        {
          provide: SessionStore,
          useValue: {
            status,
            isReady: computed(() => true),
            isSignedIn: computed(() => status() === 'signed-in'),
            isEmailVerified: computed(() => false),
          },
        },
        provideTransloco({
          config: { availableLangs: ['el'], defaultLang: 'el' },
          loader: SilentTranslocoLoader,
        }),
        // The splash draws the brand mark, so the shell now reads `BRAND`.
        provideBrand({
          id: 'test',
          name: 'Test',
          wordmark: 'test',
          logo: '/brand/icon.svg',
          heroImage: '/images/hero.webp',
          defaultTheme: 'system',
        }),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the routed outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect(fixture.debugElement.query(By.directive(RouterOutlet))).toBeTruthy();
  });

  it('costs an anonymous visitor nothing for the unverified-address reminder', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('auth-email-unverified'),
    ).toBeNull();
  });

  it('mounts the unverified-address reminder once somebody is signed in', async () => {
    status.set('signed-in');
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const host = element.querySelector('auth-email-unverified');
    const outlet = element.querySelector('router-outlet');
    expect(host).not.toBeNull();
    // After the outlet: the bar is fixed to the bottom of the viewport, and focus order follows
    // what is on the screen.
    expect(host?.compareDocumentPosition(outlet as Node)).toBe(Node.DOCUMENT_POSITION_PRECEDING);
  });
});

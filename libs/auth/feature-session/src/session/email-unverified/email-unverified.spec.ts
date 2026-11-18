import { Component, PLATFORM_ID, computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTransloco, Translation, TranslocoLoader } from '@jsverse/transloco';
import { SessionStatus, SessionStore } from '@auth/data-access';
import { ActiveLanguage } from '@util/language';
import { Observable, of } from 'rxjs';

import { EmailUnverified } from './email-unverified';

class SilentTranslocoLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

@Component({ template: '' })
class Blank {}

const status = signal<SessionStatus>('deciding');
const emailVerified = signal(false);

interface Options {
  readonly status?: SessionStatus;
  readonly emailVerified?: boolean;
  readonly url?: string;
  readonly language?: 'el' | 'en';
  readonly platform?: 'browser' | 'server';
}

async function render(options: Options = {}): Promise<ComponentFixture<EmailUnverified>> {
  status.set(options.status ?? 'signed-in');
  emailVerified.set(options.emailVerified ?? false);

  // Deliberately not clearing storage: a second `render()` inside one test is a reload, and the
  // fresh injector reading what the first one wrote is the whole point of that test.
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [EmailUnverified],
    providers: [
      provideRouter([
        { path: 'el/verify-email', component: Blank },
        { path: '**', component: Blank },
      ]),
      provideTransloco({
        config: { availableLangs: ['el'], defaultLang: 'el' },
        loader: SilentTranslocoLoader,
      }),
      {
        provide: SessionStore,
        useValue: {
          status,
          isReady: computed(() => status() !== 'deciding'),
          isSignedIn: computed(() => status() === 'signed-in'),
          isEmailVerified: emailVerified.asReadonly(),
        },
      },
      ...(options.platform === 'server' ? [{ provide: PLATFORM_ID, useValue: 'server' }] : []),
    ],
  });

  TestBed.inject(ActiveLanguage).set(options.language ?? 'el');
  await TestBed.inject(Router).navigateByUrl(options.url ?? '/el/barbershops');

  const fixture = TestBed.createComponent(EmailUnverified);
  await fixture.whenStable();
  return fixture;
}

function banner(fixture: ComponentFixture<EmailUnverified>): HTMLElement | null {
  return (fixture.nativeElement as HTMLElement).querySelector('.email-unverified lib-banner');
}

function verifyLink(fixture: ComponentFixture<EmailUnverified>): HTMLAnchorElement | null {
  return (fixture.nativeElement as HTMLElement).querySelector('a[libButton]');
}

function dismissButton(fixture: ComponentFixture<EmailUnverified>): HTMLButtonElement | null {
  return (fixture.nativeElement as HTMLElement).querySelector('button[libButton]');
}

describe('EmailUnverified', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('is a live region that exists before it has anything to say', async () => {
    // The reason the reminder is not gated at the host: a screen reader announces a change inside
    // an existing region, not a region that arrives with its message already in it.
    const fixture = await render({ status: 'deciding' });

    expect((fixture.nativeElement as HTMLElement).getAttribute('role')).toBe('status');
    expect(banner(fixture)).toBeNull();
  });

  it('says nothing until the session has answered', async () => {
    const fixture = await render({ status: 'deciding' });

    status.set('signed-in');
    await fixture.whenStable();

    expect(banner(fixture)).not.toBeNull();
  });

  it('renders nothing on the server, which cannot know this tab put it away', async () => {
    expect(banner(await render({ platform: 'server' }))).toBeNull();
  });

  it('says nothing to somebody signed out', async () => {
    expect(banner(await render({ status: 'signed-out' }))).toBeNull();
  });

  it('says nothing to somebody signed out by expiry', async () => {
    expect(banner(await render({ status: 'expired' }))).toBeNull();
  });

  it('says nothing once the address is proven', async () => {
    expect(banner(await render({ emailVerified: true }))).toBeNull();
  });

  it('disappears the moment another tab proves the address', async () => {
    const fixture = await render();
    expect(banner(fixture)).not.toBeNull();

    emailVerified.set(true);
    await fixture.whenStable();

    expect(banner(fixture)).toBeNull();
  });

  it('says nothing on the verification screen itself', async () => {
    expect(banner(await render({ url: '/el/verify-email' }))).toBeNull();
  });

  it('says nothing on the verification screen carrying a return address', async () => {
    expect(banner(await render({ url: '/el/verify-email?returnUrl=%2Fel' }))).toBeNull();
  });

  it('leads to the verification screen and back to the current page', async () => {
    const fixture = await render({ url: '/el/barbershops' });

    expect(verifyLink(fixture)?.getAttribute('href')).toBe(
      '/el/verify-email?returnUrl=%2Fel%2Fbarbershops',
    );
  });

  it('follows the active language rather than hardcoding the default', async () => {
    const fixture = await render({ language: 'en', url: '/en/barbershops' });

    expect(verifyLink(fixture)?.getAttribute('href')).toBe(
      '/en/verify-email?returnUrl=%2Fen%2Fbarbershops',
    );
  });

  it('goes away when put away', async () => {
    const fixture = await render();

    dismissButton(fixture)?.click();
    await fixture.whenStable();

    expect(banner(fixture)).toBeNull();
  });

  it('stays away for the rest of the tab session', async () => {
    const first = await render();
    dismissButton(first)?.click();
    await first.whenStable();

    // A fresh injector against the storage the dismissal wrote, which is what a reload is.
    expect(banner(await render())).toBeNull();
  });

  it('forgets the dismissal once the address is proven, so a second account is told', async () => {
    const fixture = await render();
    dismissButton(fixture)?.click();
    await fixture.whenStable();

    emailVerified.set(true);
    await fixture.whenStable();
    // Signing out and back in as an unverified account, in the same tab.
    emailVerified.set(false);
    await fixture.whenStable();

    expect(banner(fixture)).not.toBeNull();
  });
});

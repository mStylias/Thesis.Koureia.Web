import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco, Translation, TranslocoLoader } from '@jsverse/transloco';
import { SessionClaims, SessionStore } from '@auth/data-access';
import { Observable, of } from 'rxjs';

import { ManagementAccountMenu } from './management-account-menu';

class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

const claims = signal<SessionClaims | null>(null);
const signOut = vi.fn(() => Promise.resolve());

async function render(given?: string, family?: string): Promise<ComponentFixture<unknown>> {
  claims.set({ givenName: given, familyName: family, email: 'p@example.com', emailVerified: true });
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTransloco({
        config: { availableLangs: ['el', 'en'], defaultLang: 'el' },
        loader: EmptyLoader,
      }),
      { provide: SessionStore, useValue: { claims, signOut } },
    ],
  });
  const fixture = TestBed.createComponent(ManagementAccountMenu);
  await fixture.whenStable();
  return fixture;
}

async function open(fixture: ComponentFixture<unknown>): Promise<void> {
  const trigger = (fixture.nativeElement as HTMLElement).querySelector('button');
  if (trigger === null) throw new Error('trigger not rendered');
  trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  trigger.click();
  await fixture.whenStable();
}

describe('ManagementAccountMenu', () => {
  beforeEach(() => {
    signOut.mockClear();
  });

  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((node) => {
      node.remove();
    });
  });

  it('is an icon button that opens a menu', async () => {
    const fixture = await render('Θανάσης', 'Μαυρίδης');
    const trigger = (fixture.nativeElement as HTMLElement).querySelector('button');

    expect(trigger?.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger?.querySelector('[lucidecircleuserround]')).not.toBeNull();
  });

  it('heads the menu with the full name', async () => {
    const fixture = await render('Θανάσης', 'Μαυρίδης');
    await open(fixture);

    expect(document.querySelector('.menu-heading')?.textContent.trim()).toBe('Θανάσης Μαυρίδης');
  });

  it('leaves the heading out when the claims carry no name', async () => {
    const fixture = await render();
    await open(fixture);

    expect(document.querySelector('.menu-heading')).toBeNull();
  });

  it('links to the profile page, then the company page', async () => {
    const fixture = await render('Θανάσης', 'Μαυρίδης');
    await open(fixture);

    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[role="menuitem"]'));
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/management/profile',
      '/management/company',
    ]);
  });

  it('signs out from the last item', async () => {
    const fixture = await render('Θανάσης', 'Μαυρίδης');
    await open(fixture);

    const items = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    items.at(-1)?.click();
    await fixture.whenStable();

    expect(signOut).toHaveBeenCalledOnce();
  });
});

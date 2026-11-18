import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  RouterOutlet,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
} from '@angular/router';
import { provideTransloco, Translation, TranslocoLoader } from '@jsverse/transloco';
import { StaffApi, type CurrentStaffMemberResponse } from '@api/staff';
import { UserProfileApi, type UserResponse } from '@api/users';
import { SessionStore, StaffAccessStore } from '@auth/data-access';
import { Result } from '@synax/client/core';
import { ToasterService } from '@ui/toaster';
import { ThemeService } from '@util/brand';
import { Observable, of, Subject } from 'rxjs';

import { ThemePreferenceSync } from '../preferences/theme-preference-sync';
import { profileRoute } from '../profile.routes';
import { ManagementProfile } from './management-profile';
import { leaveManagementProfile } from './management-profile.guard';

const USER: UserResponse = {
  id: 'u1',
  keycloakId: null,
  firstName: 'Άρης',
  lastName: 'Δημάκης',
  email: 'aris.dimakis@koureia.local',
  phoneNumber: null,
  language: { id: 'l1', code: 'el', name: 'Ελληνικά' },
  emailRemindersEnabled: true,
};

const MEMBER: CurrentStaffMemberResponse = {
  staffMemberId: 'm1',
  companyId: 'c1',
  displayName: 'Άρης Δ.',
  jobTitleCode: 'barber',
  isBookable: true,
  workHours: [{ dayOfWeek: 2, startTime: '09:00', endTime: '17:00' }],
  timezone: 'Europe/Athens',
  slotIntervalMinutes: 15,
  businessHours: [{ dayOfWeek: 2, openTime: '09:00', closeTime: '21:00' }],
};

class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

@Component({ imports: [RouterOutlet], template: '<router-outlet />' })
class Shell {}

@Component({ template: '' })
class Elsewhere {}

describe('ManagementProfile', () => {
  let scrolled: string[];

  // jsdom has no layout, so it has no `scrollIntoView` to spy on.
  beforeAll(() => {
    HTMLElement.prototype.scrollIntoView = function (): void {
      // Replaced per test.
    };
  });

  function configure(member$: Observable<Result<CurrentStaffMemberResponse>>): void {
    scrolled = [];
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(function (
      this: HTMLElement,
    ) {
      scrolled.push(this.id);
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'management/profile', ...profileRoute },
          { path: 'elsewhere', component: Elsewhere },
        ]),
        provideTransloco({
          config: {
            availableLangs: ['el', 'en'],
            defaultLang: 'el',
            missingHandler: { logMissingKey: false },
          },
          loader: EmptyLoader,
        }),
        // A pending read keeps the app unstable, so `whenStable` would never settle.
        { provide: UserProfileApi, useValue: { current: () => of(USER) } },
        { provide: SessionStore, useValue: {} },
        { provide: StaffApi, useValue: { currentMember: () => member$ } },
        {
          provide: StaffAccessStore,
          useValue: {
            has: () => false,
            company: () => ({ id: 'c1', name: 'Shop', timezone: null }),
          },
        },
        { provide: ToasterService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: ThemeService, useValue: { preference: signal('system'), set: vi.fn() } },
        { provide: ThemePreferenceSync, useValue: { save: vi.fn() } },
      ],
    });
  }

  async function open(url: string): Promise<HTMLElement> {
    configure(of(Result.Ok(MEMBER)));
    const fixture = TestBed.createComponent(Shell);
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the cards in order, each under its own fragment', async () => {
    const page = await open('/management/profile');

    expect(page.querySelector('lib-management-profile')).not.toBeNull();
    expect(
      Array.from(page.querySelectorAll('lib-page-section')).map((section) => section.id),
    ).toEqual(['profile', 'work-hours', 'preferences', 'notifications']);
  });

  it('gives each card a heading that names its section', async () => {
    const page = await open('/management/profile');

    for (const section of Array.from(page.querySelectorAll('lib-page-section > section'))) {
      const heading = page.querySelector(`[id="${section.getAttribute('aria-labelledby') ?? ''}"]`);
      expect(heading?.tagName).toBe('H2');
    }
  });

  it('brings the fragment into view inside the scroll area', async () => {
    await open('/management/profile#preferences');

    expect(scrolled).toEqual(['preferences']);
  });

  describe('while a card above the fragment still loads', () => {
    let member$: Subject<Result<CurrentStaffMemberResponse>>;
    let fixture: ReturnType<typeof TestBed.createComponent<Shell>>;

    // The pending read keeps the app unstable, so these tests render by hand.
    async function render(): Promise<void> {
      fixture.detectChanges();
      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    function page(): HTMLElement {
      return fixture.nativeElement as HTMLElement;
    }

    beforeEach(async () => {
      member$ = new Subject();
      configure(member$);
      fixture = TestBed.createComponent(Shell);
      await TestBed.inject(Router).navigateByUrl('/management/profile#preferences');
      await render();
    });

    it('waits for the card to load before it scrolls', async () => {
      expect(page().querySelector('#work-hours section')?.getAttribute('aria-busy')).toBe('true');
      expect(scrolled).toEqual([]);

      member$.next(Result.Ok(MEMBER));
      member$.complete();
      await render();

      expect(scrolled).toEqual(['preferences']);
    });

    it('scrolls once the card goes away', async () => {
      member$.next(
        Result.Fail({ errorCode: 'USER_NOT_STAFF_MEMBER', httpCode: 404, validationErrors: [] }),
      );
      member$.complete();
      await render();

      expect(page().querySelector('#work-hours')).toBeNull();
      expect(scrolled).toEqual(['preferences']);
    });
  });

  it('scrolls nothing without a fragment', async () => {
    await open('/management/profile');

    expect(scrolled).toEqual([]);
  });

  it('lets a navigation go when no card has changes', async () => {
    await open('/management/profile');
    const router = TestBed.inject(Router);

    expect(await router.navigateByUrl('/elsewhere')).toBe(true);
  });

  it('asks the page whether it can close', () => {
    const page = { canLeave: vi.fn(() => Promise.resolve(false)) };

    expect(profileRoute.canDeactivate).toEqual([leaveManagementProfile]);
    // The guard reads none of the snapshots.
    const none = {} as ActivatedRouteSnapshot & RouterStateSnapshot;
    void leaveManagementProfile(page as unknown as ManagementProfile, none, none, none);
    expect(page.canLeave).toHaveBeenCalledOnce();
  });
});

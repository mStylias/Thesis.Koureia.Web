import { Injectable } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import {
  provideTransloco,
  type Translation,
  type TranslocoLoader,
  TranslocoService,
} from '@jsverse/transloco';
import type { StaffMemberResponse, StaffOptionsResponse } from '@api/staff';
import { StaffAccessStore } from '@auth/data-access';
import {
  STAFF_SCHEDULE_CONTEXT,
  StaffHours,
  WeekHoursGrid,
  staffScheduleInlineLoader,
} from '@features/management-shared-staff-schedule';
import { provideSynaxApi, SYNAX_ERROR_MESSAGES } from '@synax/client';
import { ConfirmationService } from '@ui/confirmation-dialog';
import { ToasterService } from '@ui/toaster';
import { BehaviorSubject, firstValueFrom, of, type Observable } from 'rxjs';

import { staffErrorMessages } from '../staff.errors';
import { staffInlineLoader } from '../staff.i18n';
import { StaffStore } from '../staff.store';
import { StaffMemberDetails } from './staff-member-details';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

beforeAll(() => {
  HTMLDialogElement.prototype.show = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
  };
  // The tab strip measures itself.
  // jsdom has none.
  globalThis.ResizeObserver = class {
    observe(): void {
      /* jsdom lays nothing out */
    }
    unobserve(): void {
      /* nothing to stop */
    }
    disconnect(): void {
      /* nothing to stop */
    }
  };
});

const API = 'http://api.test/api/v1/staff';

const OPTIONS: StaffOptionsResponse = {
  timezone: 'Europe/Athens',
  slotIntervalMinutes: 15,
  currency: 'EUR',
  businessHours: [{ dayOfWeek: 1, openTime: '10:00', closeTime: '20:00' }],
  jobTitles: ['barber'],
  roles: [{ id: 'r-staff', name: 'staff', isSystem: true }],
  services: [],
};

const MEMBER: StaffMemberResponse = {
  id: 'm1',
  userId: 'u1',
  firstName: 'Μαρία',
  lastName: 'Καραγιάννη',
  displayName: 'Μαρία Κ.',
  initials: 'ΜΚ',
  email: 'maria@example.com',
  phoneNumber: null,
  avatarUrl: null,
  jobTitleCode: 'barber',
  isBookable: true,
  isActive: true,
  joinedAt: '2026-08-29',
  roles: [{ id: 'r-staff', name: 'staff' }],
  services: [],
  workHours: [{ dayOfWeek: 1, startTime: '10:00', endTime: '20:00' }],
  stats: { completedCount: 1, upcomingCount: 0, rating: null, reviewCount: 0 },
  bookingBlockers: [],
  isSelf: false,
  canManage: true,
  canDelete: false,
  createdAt: '2026-08-29T10:00:00Z',
  updatedAt: null,
};

const OWNER_CODES = [
  'members:read',
  'members:update',
  'members:remove',
  'roles:assign',
  'staff:manage_schedule',
  'staff:manage_services',
  'staff:manage_timeoff',
];

describe('StaffMemberDetails', () => {
  beforeEach(() => {
    // The headless tabs warn in dev mode that the panels are eager, which they are on purpose, and
    // pass the element along. Node cannot print a jsdom element, so the warning itself throws.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  let fixture: ComponentFixture<StaffMemberDetails>;
  let http: HttpTestingController;
  let confirm: ReturnType<typeof vi.fn>;
  let toaster: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  /** The buttons on the toolbar's line, by name: the group, then the end slot. */
  const LINE = '.drawer-actions-start button, .drawer-actions-end button';

  function actions(): string[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll(LINE)].map(
      (button) => button.getAttribute('aria-label') ?? button.textContent.trim(),
    );
  }

  function button(label: string): HTMLButtonElement {
    const found = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(LINE),
    ].find((candidate) => candidate.textContent.trim() === label);
    if (found === undefined) throw new Error(`${label} not rendered`);
    return found;
  }

  async function open(
    member: StaffMemberResponse,
    codes: readonly string[] = OWNER_CODES,
    timeOff: 'empty' | 'failed' = 'empty',
  ): Promise<void> {
    confirm = vi.fn(() => Promise.resolve('confirmed'));
    toaster = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'http://api.test', defaultVersion: 1 }),
        provideTransloco({
          config: { availableLangs: ['en'], defaultLang: 'en' },
          loader: EmptyLoader,
        }),
        StaffStore,
        { provide: STAFF_SCHEDULE_CONTEXT, useExisting: StaffStore },
        { provide: SYNAX_ERROR_MESSAGES, useFactory: staffErrorMessages },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: new BehaviorSubject(convertToParamMap({ staffMemberId: member.id })),
            queryParamMap: new BehaviorSubject(convertToParamMap({})),
          },
        },
        { provide: StaffAccessStore, useValue: { has: (code: string) => codes.includes(code) } },
        { provide: ConfirmationService, useValue: { open: confirm } },
        { provide: ToasterService, useValue: toaster },
      ],
    });
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('field/en'));
    await firstValueFrom(transloco.load('managementStaff/en', { inlineLoader: staffInlineLoader }));
    await firstValueFrom(
      transloco.load('managementStaffSchedule/en', { inlineLoader: staffScheduleInlineLoader }),
    );
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    TestBed.inject(StaffStore).options.set(OPTIONS);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StaffMemberDetails);
    await settle();
    http.expectOne(`${API}/${member.id}`).flush(member);
    await settle();
    for (const request of http.match((candidate) => candidate.url.includes('/time-off'))) {
      if (timeOff === 'failed') {
        request.flush(null, { status: 500, statusText: 'Server Error' });
      } else {
        request.flush([]);
      }
    }
    await settle();
  }

  afterEach(() => {
    fixture.destroy();
  });

  it('offers Deactivate on a member the caller outranks, and withholds Delete once they have history', async () => {
    await open(MEMBER);
    expect(actions()).toEqual(['Deactivate', 'Edit']);
  });

  it('offers Delete for a member added by mistake', async () => {
    await open({ ...MEMBER, canDelete: true });
    expect(actions()).toContain('Delete');
  });

  it('never offers to deactivate or delete your own membership', async () => {
    await open({ ...MEMBER, isSelf: true, canDelete: true });
    expect(actions()).toEqual(['Edit']);
  });

  it('protects a member who holds a permission the caller lacks, profile included', async () => {
    await open({ ...MEMBER, canManage: false, canDelete: true });
    expect(actions()).toEqual([]);
  });

  it('brings an inactive member back, whatever the rank', async () => {
    await open({ ...MEMBER, isActive: false, canManage: false });
    expect(actions()).toContain('Activate');
  });

  it('names how many bookings a refused deactivation still has ahead', async () => {
    await open(MEMBER);

    button('Deactivate').click();
    await settle();
    http
      .expectOne(`${API}/m1/deactivate`)
      .flush(
        { title: 'STAFF_HAS_UPCOMING_APPOINTMENTS', status: 409, count: 4 },
        { status: 409, statusText: 'Conflict' },
      );
    await settle();

    expect(toaster.error).toHaveBeenCalledWith(expect.stringContaining('upcoming appointments: 4'));
  });

  it('says the time off is empty only once it has loaded', async () => {
    await open(MEMBER);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.time-off-empty')).toHaveLength(2);
    expect(root.querySelector('.time-off-notice')).toBeNull();
  });

  it('does not call failed time off empty', async () => {
    await open(MEMBER, OWNER_CODES, 'failed');
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.time-off-notice')?.getAttribute('role')).toBe('alert');
    expect(root.querySelector('.time-off-empty')).toBeNull();
  });

  it('asks before leaving with unsaved hours, though another tab shows', async () => {
    await open(MEMBER);
    const hours = fixture.debugElement.query(By.directive(StaffHours))
      .componentInstance as StaffHours;
    hours.edit();
    await settle();
    const grid = fixture.debugElement.query(By.directive(WeekHoursGrid))
      .componentInstance as WeekHoursGrid;
    (grid as unknown as { addRange(day: number): void }).addRange(0);
    await settle();

    confirm.mockResolvedValueOnce('cancelled');
    expect(await fixture.componentInstance.canLeave()).toBe(false);
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Discard changes?' }));
    expect(hours.editing()).toBe(true);

    expect(await fixture.componentInstance.canLeave()).toBe(true);
    expect(hours.editing()).toBe(false);
  });
});

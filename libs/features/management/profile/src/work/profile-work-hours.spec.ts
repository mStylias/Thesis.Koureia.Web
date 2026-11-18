import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  provideTransloco,
  type Translation,
  type TranslocoLoader,
  TranslocoService,
} from '@jsverse/transloco';
import {
  StaffApi,
  type CurrentStaffMemberResponse,
  type StaffScheduleChangeResponse,
  type StaffTimeOffResponse,
} from '@api/staff';
import { StaffAccessStore } from '@auth/data-access';
import { staffScheduleInlineLoader } from '@features/management-shared-staff-schedule';
import { Result, type HttpError } from '@synax/client/core';
import { ConfirmationService } from '@ui/confirmation-dialog';
import { ToasterService } from '@ui/toaster';
import { readFileSync } from 'node:fs';
import { firstValueFrom, of, type Observable } from 'rxjs';
import type { Mock } from 'vitest';
import {
  PageEditors,
  pageSectionsInlineLoader,
  providePageSections,
} from '@features/management-shared-page-sections';

import { profileInlineLoader } from '../profile.i18n';
import { ProfileWorkHours } from './profile-work-hours';

class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

const MEMBER: CurrentStaffMemberResponse = {
  staffMemberId: 'm1',
  companyId: 'c1',
  displayName: 'Άρης Δ.',
  jobTitleCode: null,
  isBookable: true,
  workHours: [{ dayOfWeek: 2, startTime: '09:00', endTime: '17:00' }],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  slotIntervalMinutes: 15,
  businessHours: [{ dayOfWeek: 2, openTime: '09:00', closeTime: '21:00' }],
};

function failure(errorCode: string, httpCode: number): Result<CurrentStaffMemberResponse> {
  const error: HttpError = { errorCode, httpCode, validationErrors: [] };
  return Result.Fail(error);
}

const api = {
  currentMember: vi.fn<() => Observable<Result<CurrentStaffMemberResponse>>>(),
  timeOff: vi.fn<() => Observable<Result<StaffTimeOffResponse[]>>>(() => of(Result.Ok([]))),
  updateWorkHours: vi.fn<() => Observable<Result<StaffScheduleChangeResponse>>>(),
};

describe('ProfileWorkHours', () => {
  let fixture: ComponentFixture<ProfileWorkHours>;
  let codes: ReadonlySet<string>;
  let scrolled: Mock<Element['scrollIntoView']>;

  async function render(
    answers: readonly Result<CurrentStaffMemberResponse>[],
    held: readonly string[] = [],
    openShopId = 'c1',
  ): Promise<void> {
    answers.forEach((answer) => api.currentMember.mockReturnValueOnce(of(answer)));
    codes = new Set(held);
    const company = { id: openShopId, name: 'Shop', timezone: null };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTransloco({
          config: {
            availableLangs: ['en'],
            defaultLang: 'en',
            missingHandler: { logMissingKey: false },
          },
          loader: EmptyLoader,
        }),
        providePageSections({ discardMessage: 'managementProfile.discard.message' }),
        { provide: StaffApi, useValue: api },
        {
          provide: StaffAccessStore,
          useValue: { has: (code: string) => codes.has(code), company: () => company },
        },
        { provide: ToasterService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: ConfirmationService, useValue: { open: vi.fn() } },
      ],
    });
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('field/en'));
    await firstValueFrom(
      transloco.load('managementProfile/en', { inlineLoader: profileInlineLoader }),
    );
    await firstValueFrom(
      transloco.load('managementStaffSchedule/en', { inlineLoader: staffScheduleInlineLoader }),
    );
    await firstValueFrom(
      transloco.load('managementPageSections/en', { inlineLoader: pageSectionsInlineLoader }),
    );
    fixture = TestBed.createComponent(ProfileWorkHours);
    await settle();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(): string {
    return host().textContent.replace(/\s+/g, ' ');
  }

  function button(label: string): HTMLButtonElement | undefined {
    return Array.from(host().querySelectorAll('button')).find(
      (candidate) => candidate.textContent.trim() === label,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom has no layout, so it has no `scrollIntoView`.
    scrolled = vi.fn<Element['scrollIntoView']>();
    Element.prototype.scrollIntoView = scrolled;
  });

  afterEach(() => {
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  it('shows the week under its own fragment', async () => {
    await render([Result.Ok(MEMBER)]);

    expect(host().querySelector('lib-page-section')?.id).toBe('work-hours');
    expect(text()).toContain('Work hours');
    expect(text()).toContain('Tuesday');
    expect(text()).toContain('09:00–17:00');
    expect(text()).toContain('Shop 09:00–21:00');
  });

  it('hides the card for a person with no staff membership', async () => {
    await render([failure('USER_NOT_STAFF_MEMBER', 404)]);

    expect(host().hasAttribute('hidden')).toBe(true);
    expect(host().querySelector('lib-page-section')).toBeNull();
  });

  it('hides the card, time off included, for a member who takes no online bookings', async () => {
    await render(
      [Result.Ok({ ...MEMBER, isBookable: false, workHours: [] })],
      ['staff:manage_own_schedule', 'staff:manage_own_timeoff'],
    );

    expect(host().hasAttribute('hidden')).toBe(true);
    expect(host().querySelector('lib-staff-hours')).toBeNull();
    expect(host().querySelector('lib-staff-time-off')).toBeNull();
    expect(api.timeOff).not.toHaveBeenCalled();
  });

  it('shows the failure with a retry for any other refusal', async () => {
    await render([failure('HTTP_500', 500), Result.Ok(MEMBER)]);

    expect(host().hasAttribute('hidden')).toBe(false);
    expect(text()).toContain('Could not load.');
    const retry = button('Try again');
    if (retry === undefined) throw new Error('retry not rendered');

    retry.click();
    await settle();

    expect(api.currentMember).toHaveBeenCalledTimes(2);
    expect(text()).toContain('09:00–17:00');
  });

  it('offers no Edit without a schedule code, and says who sets the hours', async () => {
    await render([Result.Ok(MEMBER)]);

    expect(button('Edit')).toBeUndefined();
    expect(text()).toContain('The shop manager sets your work hours.');
  });

  it('offers Edit with only the own schedule code', async () => {
    await render([Result.Ok(MEMBER)], ['staff:manage_own_schedule']);

    expect(button('Edit')).toBeDefined();
    expect(text()).not.toContain('The shop manager sets your work hours.');
  });

  it('says so when no hours are set', async () => {
    await render([Result.Ok({ ...MEMBER, workHours: [] })], ['staff:manage_schedule']);

    expect(text()).toContain('No work hours are set.');
    expect(button('Edit')).toBeDefined();
  });

  it("names the shop's zone only when it is not the browser's", async () => {
    await render([Result.Ok(MEMBER)]);
    expect(text()).not.toContain('Shop hours (');

    TestBed.resetTestingModule();
    const zone = MEMBER.timezone === 'Pacific/Kiritimati' ? 'Asia/Tokyo' : 'Pacific/Kiritimati';
    await render([Result.Ok({ ...MEMBER, timezone: zone })]);
    expect(text()).toContain(`Shop hours (${zone}).`);
  });

  function tuesdaySwitch(): HTMLInputElement {
    const found = host().querySelector<HTMLInputElement>('#staff-hours-day-1');
    if (found === null) throw new Error('Tuesday switch not rendered');
    return found;
  }

  async function editAndSave(change: () => void): Promise<void> {
    button('Edit')?.click();
    await settle();
    expect(button('Edit')).toBeUndefined();
    change();
    await settle();
    const save = button('Save');
    if (save === undefined) throw new Error('save not rendered');
    save.click();
    await settle();
  }

  it('saves the edited week, then reads the record again', async () => {
    const saved = [{ dayOfWeek: 2, startTime: '10:00', endTime: '17:00' }];
    api.updateWorkHours.mockReturnValue(
      of(Result.Ok({ workHours: [], timeOff: null, conflicts: [] })),
    );
    await render(
      [Result.Ok(MEMBER), Result.Ok({ ...MEMBER, workHours: saved })],
      ['staff:manage_own_schedule'],
    );

    // Tuesday is the only working day. Turning it off empties the week.
    await editAndSave(() => {
      tuesdaySwitch().click();
    });

    expect(api.updateWorkHours).toHaveBeenCalledWith('m1', { workHours: [] });
    expect(api.currentMember).toHaveBeenCalledTimes(2);
    expect(text()).toContain('10:00–17:00');
    expect(button('Save')).toBeUndefined();
  });

  it('keeps the conflicts of a save on screen after the record is read again', async () => {
    api.updateWorkHours.mockReturnValue(
      of(
        Result.Ok({
          workHours: [],
          timeOff: null,
          conflicts: [
            {
              appointmentId: 'a1',
              localDate: '2026-10-13',
              localStartTime: '14:00',
              localEndTime: '14:30',
              customerDisplayName: 'Νίκος Π.',
            },
          ],
        }),
      ),
    );
    await render(
      [Result.Ok(MEMBER), Result.Ok({ ...MEMBER, workHours: [] })],
      ['staff:manage_own_schedule'],
    );

    await editAndSave(() => {
      tuesdaySwitch().click();
    });
    await settle();

    expect(api.currentMember).toHaveBeenCalledTimes(2);
    const conflicts = host().querySelector('lib-staff-conflicts');
    expect(conflicts).not.toBeNull();
    expect(conflicts?.textContent).toContain('Νίκος Π.');
    expect(conflicts?.textContent).toContain('14:00');
  });

  it("takes away the schedule's inset instead of pulling it past the card's padding", () => {
    const styles = readFileSync('src/work/profile-work-hours.scss', 'utf8');
    // A negative margin of one step more than the card's padding pushed the week past the card.
    expect(styles).toContain('--staff-schedule-inset: 0');
    expect(styles).not.toMatch(/margin-inline:\s*calc\(-1/);
  });

  it('reads the record once', async () => {
    await render([Result.Ok(MEMBER)]);

    expect(api.currentMember).toHaveBeenCalledOnce();
  });

  it('gives focus back to Edit after a save with no conflicts', async () => {
    api.updateWorkHours.mockReturnValue(
      of(Result.Ok({ workHours: [], timeOff: null, conflicts: [] })),
    );
    await render([Result.Ok(MEMBER), Result.Ok(MEMBER)], ['staff:manage_own_schedule']);

    await editAndSave(() => {
      tuesdaySwitch().click();
    });
    await settle();

    expect(document.activeElement).toBe(button('Edit'));
  });

  it('gives focus back to Edit after Cancel', async () => {
    await render([Result.Ok(MEMBER)], ['staff:manage_own_schedule']);

    button('Edit')?.click();
    await settle();
    button('Cancel')?.click();
    await settle();

    expect(document.activeElement).toBe(button('Edit'));
  });

  it('brings the conflicts of a save into view and moves focus to them', async () => {
    api.updateWorkHours.mockReturnValue(
      of(
        Result.Ok({
          workHours: [],
          timeOff: null,
          conflicts: [
            {
              appointmentId: 'a1',
              localDate: '2026-10-13',
              localStartTime: '14:00',
              localEndTime: '14:30',
              customerDisplayName: 'Νίκος Π.',
            },
          ],
        }),
      ),
    );
    await render([Result.Ok(MEMBER), Result.Ok(MEMBER)], ['staff:manage_own_schedule']);

    await editAndSave(() => {
      tuesdaySwitch().click();
    });
    await settle();

    const banner = host().querySelector('lib-staff-conflicts lib-banner');
    expect(banner).not.toBeNull();
    expect(document.activeElement).toBe(banner);
    expect(scrolled.mock.contexts).toContain(banner);
  });

  it('offers no edits for a record in a shop other than the open one', async () => {
    await render(
      [Result.Ok({ ...MEMBER, companyId: 'c2' })],
      ['staff:manage_schedule', 'staff:manage_timeoff'],
      'c1',
    );

    expect(text()).toContain('09:00–17:00');
    expect(button('Edit')).toBeUndefined();
    expect(host().querySelector('lib-staff-time-off')).toBeNull();
    expect(api.timeOff).not.toHaveBeenCalled();
  });

  it('tells the page about unsaved changes and drops them on discard', async () => {
    await render([Result.Ok(MEMBER)], ['staff:manage_own_schedule']);
    const editors = TestBed.inject(PageEditors);

    button('Edit')?.click();
    await settle();
    expect(editors.hasChanges()).toBe(false);

    // Tuesday is on. Turning it off empties the week.
    const tuesday = host().querySelector<HTMLInputElement>('#staff-hours-day-1');
    if (tuesday === null) throw new Error('Tuesday switch not rendered');
    tuesday.click();
    await settle();
    expect(editors.hasChanges()).toBe(true);

    fixture.componentInstance.discard();
    await settle();
    expect(editors.hasChanges()).toBe(false);
    expect(button('Edit')).toBeDefined();
  });

  it('shows no time off without a time-off code', async () => {
    await render([Result.Ok(MEMBER)], ['staff:manage_own_schedule']);

    expect(host().querySelector('lib-staff-time-off')).toBeNull();
    expect(text()).not.toContain('Time off');
    expect(api.timeOff).not.toHaveBeenCalled();
  });

  it('shows the own time off with only the own time-off code', async () => {
    await render([Result.Ok(MEMBER)], ['staff:manage_own_timeoff']);

    expect(host().querySelector('lib-staff-time-off')).not.toBeNull();
    expect(text()).toContain('Time off');
    expect(button('Add time off')).toBeDefined();
    expect(api.timeOff).toHaveBeenCalledWith('m1', false);
    expect(api.timeOff).toHaveBeenCalledWith('m1', true);
  });

  it('puts the two time-off lists under the Time off heading', async () => {
    await render([Result.Ok(MEMBER)], ['staff:manage_own_timeoff']);

    const headings = Array.from(host().querySelectorAll('h2, h3, h4')).map(
      (heading) => `${heading.tagName} ${heading.textContent.trim()}`,
    );
    const timeOff = headings.indexOf('H3 Time off');
    expect(timeOff).toBeGreaterThan(-1);
    expect(headings.slice(timeOff + 1).every((heading) => heading.startsWith('H4'))).toBe(true);
    expect(headings.slice(timeOff + 1)).toHaveLength(2);
  });
});

import { Component, Injectable, signal, viewChild } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  provideTransloco,
  type Translation,
  type TranslocoLoader,
  TranslocoService,
} from '@jsverse/transloco';
import type { StaffWorkHourViewDto } from '@api/staff';
import { StaffAccessStore } from '@auth/data-access';
import { provideSynaxApi } from '@synax/client';
import { ToasterService } from '@ui/toaster';
import { readFileSync } from 'node:fs';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { STAFF_SCHEDULE_CONTEXT } from '../context/staff-schedule-context';
import { staffScheduleInlineLoader } from '../staff-schedule.i18n';
import { StaffHours } from './staff-hours';

const styles = readFileSync('src/hours/staff-hours.scss', 'utf8');

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

const MONDAY_ONLY: readonly StaffWorkHourViewDto[] = [
  { dayOfWeek: 1, startTime: '10:00', endTime: '14:00' },
];

@Component({
  imports: [StaffHours],
  template: `
    <lib-staff-hours
      [staffMemberId]="staffMemberId()"
      [workHours]="workHours()"
      [editable]="true"
      language="en"
      [emptyText]="emptyText()"
      (changed)="changes.set(changes() + 1)"
    />
  `,
})
class Host {
  readonly staffMemberId = signal('m1');
  readonly workHours = signal<readonly StaffWorkHourViewDto[]>(MONDAY_ONLY);
  readonly changes = signal(0);
  readonly emptyText = signal('');
  readonly hours = viewChild.required(StaffHours);
}

describe('StaffHours', () => {
  let fixture: ComponentFixture<Host>;
  let http: HttpTestingController;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent.replace(/\s+/g, ' ');
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'http://api.test', defaultVersion: 1 }),
        provideTransloco({
          config: { availableLangs: ['en'], defaultLang: 'en' },
          loader: EmptyLoader,
        }),
        {
          provide: STAFF_SCHEDULE_CONTEXT,
          useValue: {
            businessHours: signal([{ dayOfWeek: 1, openTime: '10:00', closeTime: '20:00' }]),
            slotIntervalMinutes: signal(15),
            timezone: signal('Europe/Athens'),
          },
        },
        { provide: StaffAccessStore, useValue: { has: () => false } },
        { provide: ToasterService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('field/en'));
    await firstValueFrom(
      transloco.load('managementStaffSchedule/en', { inlineLoader: staffScheduleInlineLoader }),
    );
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Host);
    await settle();
  });

  afterEach(() => {
    http.verify();
  });

  it('shows the week beside the shop hours from the context', () => {
    expect(text()).toContain('Monday');
    expect(text()).toContain('10:00–14:00');
    expect(text()).toContain('Shop 10:00–20:00');
    expect(text()).toContain('Shop closed');
  });

  it('saves the week for the member it was given', async () => {
    const hours = fixture.componentInstance.hours();
    hours.edit();
    await settle();
    (hours as unknown as { fromShop(): void }).fromShop();
    expect(hours.hasChanges()).toBe(true);

    hours.save();
    await settle();
    const request = http.expectOne('http://api.test/api/v1/staff/m1/work-hours');
    expect(request.request.body).toEqual({
      workHours: [{ dayOfWeek: 1, startTime: '10:00', endTime: '20:00' }],
    });
    request.flush({
      workHours: [{ dayOfWeek: 1, startTime: '10:00', endTime: '20:00' }],
      timeOff: null,
      conflicts: [],
    });
    await settle();

    expect(hours.editing()).toBe(false);
    expect(fixture.componentInstance.changes()).toBe(1);
  });

  it('brings the conflicts of a save into view and moves focus to them', async () => {
    // jsdom has no layout, so it has no `scrollIntoView`.
    const scrolled = vi.fn<Element['scrollIntoView']>();
    Element.prototype.scrollIntoView = scrolled;
    try {
      const hours = fixture.componentInstance.hours();
      hours.edit();
      await settle();
      hours.save();
      await settle();
      http.expectOne('http://api.test/api/v1/staff/m1/work-hours').flush({
        workHours: MONDAY_ONLY,
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
      });
      await settle();

      const banner = (fixture.nativeElement as HTMLElement).querySelector(
        'lib-staff-conflicts lib-banner',
      );
      expect(banner).not.toBeNull();
      expect(document.activeElement).toBe(banner);
      expect(scrolled.mock.contexts).toContain(banner);
    } finally {
      delete (Element.prototype as Partial<Element>).scrollIntoView;
    }
  });

  it('lets the host take away the inset beside the content', () => {
    expect(styles).toContain('var(--staff-schedule-inset, ');
    expect(styles).not.toMatch(/var\(--space-6\)/);
  });

  it('drops the edit when another member opens', async () => {
    const hours = fixture.componentInstance.hours();
    hours.edit();
    await settle();
    expect(hours.editing()).toBe(true);

    fixture.componentInstance.staffMemberId.set('m2');
    fixture.componentInstance.workHours.set([]);
    await settle();

    expect(hours.editing()).toBe(false);
    expect(text()).toContain('No hours set.');
  });

  it("shows the host's line for a week with no hours", async () => {
    fixture.componentInstance.workHours.set([]);
    fixture.componentInstance.emptyText.set('No work hours are set.');
    await settle();

    expect(text()).toContain('No work hours are set.');
    expect(text()).not.toContain('No hours set.');
  });
});

import { Injectable } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import {
  provideTransloco,
  type Translation,
  type TranslocoLoader,
  TranslocoService,
} from '@jsverse/transloco';
import type { StaffMemberCardResponse } from '@api/staff';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { staffInlineLoader } from '../staff.i18n';
import { StaffCard } from './staff-card';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

const CARD: StaffMemberCardResponse = {
  id: 'm1',
  fullName: 'Μαρία Καραγιάννη',
  displayName: 'Μαρία Κ.',
  initials: 'ΜΚ',
  avatarUrl: null,
  jobTitleCode: 'barber',
  isActive: true,
  isBookable: true,
  roleNames: ['staff'],
  serviceCount: 3,
  today: {
    windows: [
      { startTime: '10:00', endTime: '14:00' },
      { startTime: '15:00', endTime: '20:00' },
    ],
  },
  currentTimeOff: null,
  nextAppointmentAt: null,
  rating: 4.75,
  reviewCount: 12,
  bookingBlockers: [],
};

describe('StaffCard', () => {
  let fixture: ComponentFixture<StaffCard>;

  async function render(card: StaffMemberCardResponse, url = '/'): Promise<string> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTransloco({
          config: { availableLangs: ['en'], defaultLang: 'en' },
          loader: EmptyLoader,
        }),
      ],
    });
    await firstValueFrom(
      TestBed.inject(TranslocoService).load('managementStaff/en', {
        inlineLoader: staffInlineLoader,
      }),
    );
    await TestBed.inject(Router).navigateByUrl(url);
    fixture = TestBed.createComponent(StaffCard);
    fixture.componentRef.setInput('member', card);
    fixture.componentRef.setInput('timezone', 'Europe/Athens');
    fixture.componentRef.setInput('language', 'en');
    fixture.componentRef.setInput('now', new Date('2026-10-05T07:00:00Z'));
    fixture.detectChanges();
    await fixture.whenStable();
    return (fixture.nativeElement as HTMLElement).textContent.replace(/\s+/g, ' ');
  }

  it("shows today's ranges, the role in words and the rating with one decimal", async () => {
    const text = await render(CARD);
    expect(text).toContain('Today 10:00–14:00, 15:00–20:00');
    expect(text).toContain('Barber · Staff member');
    expect(text).toContain('★ 4.8 (12)');
  });

  it('says why customers cannot book the member online', async () => {
    const text = await render({ ...CARD, bookingBlockers: ['NO_SERVICES', 'NO_WORK_HOURS'] });
    expect(text).toContain('Not shown in online booking: No services, No work hours');
  });

  it('shows the time off that runs now in place of the hours', async () => {
    const text = await render({
      ...CARD,
      currentTimeOff: { startsOn: '2026-10-04', endsOn: '2026-10-12' },
    });
    expect(text).toContain('On time off until Oct 12');
    expect(text).not.toContain('Today 10:00');
  });

  it('marks an inactive member in words, without hours or a warning', async () => {
    const text = await render({ ...CARD, isActive: false });
    expect(text).toContain('Inactive');
    expect(text).not.toContain('Today');
    expect(text).not.toContain('Not shown in online booking');
    const link = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(link?.getAttribute('href')).toBe('/m1');
  });

  // Regression: switching member dropped `?tab=` and reopened the profile tab.
  it('keeps the open tab in the link to another member', async () => {
    await render(CARD, '/?tab=hours');
    const link = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(link?.getAttribute('href')).toBe('/m1?tab=hours');
  });
});

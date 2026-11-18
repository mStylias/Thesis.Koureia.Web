import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideSynaxApi } from '@synax/client';
import { firstValueFrom } from 'rxjs';

import { StaffApi } from './staff.api';
import { alreadyMemberOf, StaffErrorCodes, upcomingCountOf } from './staff-errors';

const API = 'https://api.test/api/v1';

describe('StaffApi', () => {
  let api: StaffApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'https://api.test', defaultVersion: 1 }),
      ],
    });
    api = TestBed.inject(StaffApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('reads the list without a language, and the options with one', () => {
    api.list().subscribe();
    api.options('en').subscribe();

    http.expectOne(`${API}/staff`).flush([]);
    http.expectOne(`${API}/staff/options?languageCode=en`).flush({});
  });

  it('sends the address in the body, never in the URL', () => {
    api.findCandidate({ email: 'maria@example.com' }).subscribe();

    const request = http.expectOne(`${API}/staff/candidates`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'maria@example.com' });
    request.flush({});
  });

  it('activates and deactivates through their own routes', () => {
    api.setActive('m 1', false).subscribe();
    api.setActive('m 1', true).subscribe();

    expect(http.expectOne(`${API}/staff/m%201/deactivate`).request.method).toBe('POST');
    expect(http.expectOne(`${API}/staff/m%201/activate`).request.method).toBe('POST');
  });

  it('uploads the photo as the multipart part `file`', () => {
    const blob = new Blob(['x'], { type: 'image/webp' });
    api.uploadPhoto('m1', blob).subscribe();

    const request = http.expectOne(`${API}/staff/m1/photo`);
    expect(request.request.method).toBe('PUT');
    const body = request.request.body as FormData;
    expect((body.get('file') as File).type).toBe('image/webp');
    request.flush({ avatarUrl: 'https://cdn.test/a.webp' });
  });

  it('reads the past time off on request', () => {
    api.timeOff('m1', true).subscribe();
    http.expectOne(`${API}/staff/m1/time-off?past=true`).flush([]);
  });

  it("reads the caller's own membership from the user's own route", async () => {
    const result = firstValueFrom(api.currentMember());

    const request = http.expectOne(`${API}/users/me/staff-member`);
    expect(request.request.method).toBe('GET');
    request.flush(CURRENT);

    const answered = await result;
    expect(answered.isSuccess ? answered.data : null).toEqual(CURRENT);
  });

  it('reports a caller with no membership as USER_NOT_STAFF_MEMBER', async () => {
    const result = firstValueFrom(api.currentMember());

    http
      .expectOne(`${API}/users/me/staff-member`)
      .flush(
        { status: 404, title: 'USER_NOT_STAFF_MEMBER' },
        { status: 404, statusText: 'Not Found' },
      );

    const answered = await result;
    expect(answered.isSuccess ? null : answered.error.errorCode).toBe(
      StaffErrorCodes.NotStaffMember,
    );
  });

  it('reads the member a refused add found, from the problem extensions', async () => {
    const result = firstValueFrom(api.createMember(CREATE));

    http
      .expectOne(`${API}/staff`)
      .flush(
        { status: 409, title: 'STAFF_ALREADY_MEMBER', staffMemberId: 'm9', isActive: false },
        { status: 409, statusText: 'Conflict' },
      );

    const answered = await result;
    expect(answered.isSuccess).toBe(false);
    expect(answered.isSuccess ? null : alreadyMemberOf(answered.error)).toEqual({
      staffMemberId: 'm9',
      isActive: false,
    });
  });

  it('reads the count of a refused deactivation', async () => {
    const result = firstValueFrom(api.setActive('m1', false));

    http
      .expectOne(`${API}/staff/m1/deactivate`)
      .flush(
        { status: 409, title: 'STAFF_HAS_UPCOMING_APPOINTMENTS', count: 4 },
        { status: 409, statusText: 'Conflict' },
      );

    const answered = await result;
    expect(answered.isSuccess ? null : upcomingCountOf(answered.error)).toBe(4);
  });
});

const CREATE = {
  email: 'maria@example.com',
  jobTitleCode: 'barber',
  isBookable: true,
  joinedAt: null,
  roleIds: [],
  services: [],
  workHours: [],
};

const CURRENT = {
  staffMemberId: 'm1',
  companyId: 'c1',
  displayName: 'Άρης Δ.',
  jobTitleCode: null,
  isBookable: true,
  workHours: [{ dayOfWeek: 2, startTime: '09:00', endTime: '17:00' }],
  timezone: 'Europe/Athens',
  slotIntervalMinutes: 15,
  businessHours: [{ dayOfWeek: 2, openTime: '09:00', closeTime: '21:00' }],
};

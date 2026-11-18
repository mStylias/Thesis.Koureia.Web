import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideSynaxApi } from '@synax/client';
import { firstValueFrom } from 'rxjs';

import { CompanyApi } from './company.api';

const API = 'https://api.test/api/v1';

describe('CompanyApi', () => {
  let api: CompanyApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'https://api.test', defaultVersion: 1 }),
      ],
    });
    api = TestBed.inject(CompanyApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('reads the settings in a language, and the holidays current or past', () => {
    api.settings('en').subscribe();
    api.holidays(false).subscribe();
    api.holidays(true).subscribe();

    http.expectOne(`${API}/company?languageCode=en`).flush({});
    http.expectOne(`${API}/company/holidays?past=false`).flush([]);
    http.expectOne(`${API}/company/holidays?past=true`).flush([]);
  });

  it('writes the week, the rules and the order with PUT', () => {
    api.updateHours({ businessHours: [] }).subscribe();
    api
      .updateBookingRules({
        slotIntervalMinutes: 15,
        minLeadTimeMinutes: 0,
        maxAdvanceDays: 60,
        cancellationCutoffMinutes: 60,
      })
      .subscribe();
    api.reorderPhotos({ photoIds: ['p2', 'p1'] }).subscribe();

    const hours = http.expectOne(`${API}/company/business-hours`);
    expect(hours.request.method).toBe('PUT');
    expect(hours.request.body).toEqual({ businessHours: [] });
    expect(http.expectOne(`${API}/company/booking-rules`).request.method).toBe('PUT');
    const order = http.expectOne(`${API}/company/photos/order`);
    expect(order.request.method).toBe('PUT');
    expect(order.request.body).toEqual({ photoIds: ['p2', 'p1'] });
  });

  it('puts the holiday and the photo id in the path', () => {
    api
      .updateHoliday('h 1', {
        startsOn: '2026-12-24',
        endsOn: '2026-12-24',
        isClosed: true,
        openTime: null,
        closeTime: null,
        name: null,
      })
      .subscribe();
    api.deleteHoliday('h 1').subscribe();
    api.updatePhoto('p 1', { altTexts: [] }).subscribe();
    api.deletePhoto('p 1').subscribe();

    for (const [method, url] of [
      ['PUT', `${API}/company/holidays/h%201`],
      ['DELETE', `${API}/company/holidays/h%201`],
      ['PUT', `${API}/company/photos/p%201`],
      ['DELETE', `${API}/company/photos/p%201`],
    ]) {
      http.expectOne({ method, url }).flush(null);
    }
  });

  it('uploads the logo with PUT and a photo with POST, both as the multipart part `file`', () => {
    const blob = new Blob(['x'], { type: 'image/webp' });
    api.uploadLogo(new File([blob], 'logo.webp', { type: 'image/webp' })).subscribe();
    api.uploadPhoto(blob).subscribe();

    const logo = http.expectOne(`${API}/company/logo`);
    expect(logo.request.method).toBe('PUT');
    const logoFile = (logo.request.body as FormData).get('file') as File;
    expect(logoFile.name).toBe('logo.webp');
    expect(logoFile.type).toBe('image/webp');

    const photo = http.expectOne(`${API}/company/photos`);
    expect(photo.request.method).toBe('POST');
    expect(((photo.request.body as FormData).get('file') as File).type).toBe('image/webp');
  });

  it('answers a refusal as a failed result', async () => {
    const result = firstValueFrom(api.deleteLogo());

    http
      .expectOne(`${API}/company/logo`)
      .flush(
        { title: 'AUTH_PERMISSION_DENIED', status: 403 },
        { status: 403, statusText: 'Forbidden' },
      );

    expect((await result).isSuccess).toBe(false);
  });
});

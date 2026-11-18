import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { injectSynaxUrl, toResult } from '@synax/client';
import type { Result } from '@synax/client/core';

import type {
  CompanyBookingRulesResponse,
  CompanyHolidayResponse,
  CompanyLogoResponse,
  CompanyPhotoResponse,
  CompanyScheduleChangeResponse,
  CompanySettingsResponse,
  CreateCompanyHolidayRequest,
  ReorderCompanyPhotosRequest,
  UpdateCompanyBookingRulesRequest,
  UpdateCompanyBusinessHoursRequest,
  UpdateCompanyHolidayRequest,
  UpdateCompanyPhotoRequest,
} from './company.types';

/**
 * The shop's own settings, as the management "My company" page reads and writes them.
 *
 * ```ts
 * const saved = await firstValueFrom(api.updateHours({ businessHours }));
 * ```
 *
 * The API resolves the shop from the signed-in user, or from `X-Company-Id` for a platform admin.
 * A read needs membership only. Every write needs `company:update`. Failures arrive as a failed
 * `Result`, never as a thrown error.
 */
@Service()
export class CompanyApi {
  private readonly http = inject(HttpClient);
  private readonly url = injectSynaxUrl();

  /** Name and address in `languageCode`, else Greek. */
  settings(languageCode: string): Observable<Result<CompanySettingsResponse>> {
    return this.http
      .get<CompanySettingsResponse>(
        this.url('company') + `?languageCode=${encodeURIComponent(languageCode)}`,
      )
      .pipe(toResult<CompanySettingsResponse>());
  }

  /** A full replace of the week. The barbers' hours do not change. */
  updateHours(
    request: UpdateCompanyBusinessHoursRequest,
  ): Observable<Result<CompanyScheduleChangeResponse>> {
    return this.http
      .put<CompanyScheduleChangeResponse>(this.url('company/business-hours'), request)
      .pipe(toResult<CompanyScheduleChangeResponse>());
  }

  /**
   * Current and upcoming, soonest first. With `past`, what has ended, latest first, at most 100.
   */
  holidays(past: boolean): Observable<Result<CompanyHolidayResponse[]>> {
    return this.http
      .get<CompanyHolidayResponse[]>(this.url('company/holidays') + `?past=${past}`)
      .pipe(toResult<CompanyHolidayResponse[]>());
  }

  /** 201. */
  createHoliday(
    request: CreateCompanyHolidayRequest,
  ): Observable<Result<CompanyScheduleChangeResponse>> {
    return this.http
      .post<CompanyScheduleChangeResponse>(this.url('company/holidays'), request)
      .pipe(toResult<CompanyScheduleChangeResponse>());
  }

  /** A running holiday keeps its `startsOn`. An ended one is `COMPANY_HOLIDAY_ENDED`. */
  updateHoliday(
    holidayId: string,
    request: UpdateCompanyHolidayRequest,
  ): Observable<Result<CompanyScheduleChangeResponse>> {
    return this.http
      .put<CompanyScheduleChangeResponse>(this.holidayUrl(holidayId), request)
      .pipe(toResult<CompanyScheduleChangeResponse>());
  }

  /** 204. A running holiday ends yesterday instead, so its past days stay. */
  deleteHoliday(holidayId: string): Observable<Result<null>> {
    return this.http.delete<null>(this.holidayUrl(holidayId)).pipe(toResult<null>());
  }

  updateBookingRules(
    request: UpdateCompanyBookingRulesRequest,
  ): Observable<Result<CompanyBookingRulesResponse>> {
    return this.http
      .put<CompanyBookingRulesResponse>(this.url('company/booking-rules'), request)
      .pipe(toResult<CompanyBookingRulesResponse>());
  }

  /** The `file` part must keep its image type: the API checks it. */
  uploadLogo(file: Blob): Observable<Result<CompanyLogoResponse>> {
    return this.http
      .put<CompanyLogoResponse>(this.url('company/logo'), fileBody(file, 'logo'))
      .pipe(toResult<CompanyLogoResponse>());
  }

  /** 204, also when there is no logo. */
  deleteLogo(): Observable<Result<null>> {
    return this.http.delete<null>(this.url('company/logo')).pipe(toResult<null>());
  }

  /** In display order. The first is the main photo of the public page. */
  photos(): Observable<Result<CompanyPhotoResponse[]>> {
    return this.http
      .get<CompanyPhotoResponse[]>(this.url('company/photos'))
      .pipe(toResult<CompanyPhotoResponse[]>());
  }

  /** 201. The new photo goes last. The `file` part must keep its image type. */
  uploadPhoto(file: Blob): Observable<Result<CompanyPhotoResponse>> {
    return this.http
      .post<CompanyPhotoResponse>(this.url('company/photos'), fileBody(file, 'photo'))
      .pipe(toResult<CompanyPhotoResponse>());
  }

  updatePhoto(
    photoId: string,
    request: UpdateCompanyPhotoRequest,
  ): Observable<Result<CompanyPhotoResponse>> {
    return this.http
      .put<CompanyPhotoResponse>(this.photoUrl(photoId), request)
      .pipe(toResult<CompanyPhotoResponse>());
  }

  /**
   * Any id missing or extra is `COMPANY_PHOTO_ORDER_MISMATCH`. Answers the list in its new
   * order.
   */
  reorderPhotos(request: ReorderCompanyPhotosRequest): Observable<Result<CompanyPhotoResponse[]>> {
    return this.http
      .put<CompanyPhotoResponse[]>(this.url('company/photos/order'), request)
      .pipe(toResult<CompanyPhotoResponse[]>());
  }

  /** 204. */
  deletePhoto(photoId: string): Observable<Result<null>> {
    return this.http.delete<null>(this.photoUrl(photoId)).pipe(toResult<null>());
  }

  private holidayUrl(holidayId: string): string {
    return this.url(`company/holidays/${encodeURIComponent(holidayId)}`);
  }

  private photoUrl(photoId: string): string {
    return this.url(`company/photos/${encodeURIComponent(photoId)}`);
  }
}

function fileBody(file: Blob, fallbackName: string): FormData {
  const body = new FormData();
  body.append('file', file, file instanceof File ? file.name : fallbackName);
  return body;
}

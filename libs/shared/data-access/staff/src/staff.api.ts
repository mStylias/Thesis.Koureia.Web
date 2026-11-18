import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { injectSynaxUrl, toResult } from '@synax/client';
import type { Result } from '@synax/client/core';

import type {
  CreateStaffMemberRequest,
  CreateStaffTimeOffRequest,
  CurrentStaffMemberResponse,
  FindStaffCandidateRequest,
  StaffCandidateResponse,
  StaffMemberCardResponse,
  StaffMemberResponse,
  StaffOptionsResponse,
  StaffPhotoResponse,
  StaffScheduleChangeResponse,
  StaffTimeOffResponse,
  UpdateStaffMemberRequest,
  UpdateStaffServicesRequest,
  UpdateStaffTimeOffRequest,
  UpdateStaffWorkHoursRequest,
} from './staff.types';

/**
 * The shop's people, as the management staff page reads and writes them.
 *
 * ```ts
 * const saved = await firstValueFrom(api.updateWorkHours(id, { workHours }));
 * ```
 *
 * The API resolves the shop from the signed-in user. Reads need `members:read`, and each write
 * names its own code. Failures arrive as a failed `Result`, never as a thrown error.
 */
@Service()
export class StaffApi {
  private readonly http = inject(HttpClient);
  private readonly url = injectSynaxUrl();

  /** Every member, inactive ones included, by name. */
  list(): Observable<Result<StaffMemberCardResponse[]>> {
    return this.http
      .get<StaffMemberCardResponse[]>(this.url('staff'))
      .pipe(toResult<StaffMemberCardResponse[]>());
  }

  /** The shop's hours, the roles and the services. `languageCode` names the services. */
  options(languageCode: string): Observable<Result<StaffOptionsResponse>> {
    return this.http
      .get<StaffOptionsResponse>(
        this.url('staff/options') + `?languageCode=${encodeURIComponent(languageCode)}`,
      )
      .pipe(toResult<StaffOptionsResponse>());
  }

  /**
   * The caller's own active membership, in any shop. Needs no permission code. A caller with none
   * gets `USER_NOT_STAFF_MEMBER` (`StaffErrorCodes.NotStaffMember`), a `404`.
   */
  currentMember(): Observable<Result<CurrentStaffMemberResponse>> {
    return this.http
      .get<CurrentStaffMemberResponse>(this.url('users/me/staff-member'))
      .pipe(toResult<CurrentStaffMemberResponse>());
  }

  member(staffMemberId: string): Observable<Result<StaffMemberResponse>> {
    return this.http
      .get<StaffMemberResponse>(this.memberUrl(staffMemberId))
      .pipe(toResult<StaffMemberResponse>());
  }

  /**
   * The person with exactly this address, or `STAFF_CANDIDATE_NOT_FOUND`. Runs every check of
   * the add. Ten lookups a minute per caller. `members:invite`.
   */
  findCandidate(request: FindStaffCandidateRequest): Observable<Result<StaffCandidateResponse>> {
    return this.http
      .post<StaffCandidateResponse>(this.url('staff/candidates'), request)
      .pipe(toResult<StaffCandidateResponse>());
  }

  /** `members:invite`, and `roles:assign` when `roleIds` is not empty. 201. */
  createMember(request: CreateStaffMemberRequest): Observable<Result<StaffMemberResponse>> {
    return this.http
      .post<StaffMemberResponse>(this.url('staff'), request)
      .pipe(toResult<StaffMemberResponse>());
  }

  /** A full replace. `members:update`, and `roles:assign` when the roles change. */
  updateMember(
    staffMemberId: string,
    request: UpdateStaffMemberRequest,
  ): Observable<Result<StaffMemberResponse>> {
    return this.http
      .put<StaffMemberResponse>(this.memberUrl(staffMemberId), request)
      .pipe(toResult<StaffMemberResponse>());
  }

  /** `members:remove`. A member already in that state comes back unchanged. */
  setActive(staffMemberId: string, isActive: boolean): Observable<Result<StaffMemberResponse>> {
    const action = isActive ? 'activate' : 'deactivate';
    return this.http
      .post<StaffMemberResponse>(`${this.memberUrl(staffMemberId)}/${action}`, null)
      .pipe(toResult<StaffMemberResponse>());
  }

  /** Refused with `STAFF_IN_USE` once the member is on any appointment or review. */
  deleteMember(staffMemberId: string): Observable<Result<null>> {
    return this.http.delete<null>(this.memberUrl(staffMemberId)).pipe(toResult<null>());
  }

  /** The `file` part must keep its image type: the API checks it. `members:update`. */
  uploadPhoto(staffMemberId: string, file: Blob): Observable<Result<StaffPhotoResponse>> {
    const body = new FormData();
    body.append('file', file, file instanceof File ? file.name : 'photo');
    return this.http
      .put<StaffPhotoResponse>(`${this.memberUrl(staffMemberId)}/photo`, body)
      .pipe(toResult<StaffPhotoResponse>());
  }

  deletePhoto(staffMemberId: string): Observable<Result<null>> {
    return this.http.delete<null>(`${this.memberUrl(staffMemberId)}/photo`).pipe(toResult<null>());
  }

  /** A full replace of the member's services. `staff:manage_services`. */
  updateServices(
    staffMemberId: string,
    request: UpdateStaffServicesRequest,
  ): Observable<Result<StaffMemberResponse>> {
    return this.http
      .put<StaffMemberResponse>(`${this.memberUrl(staffMemberId)}/services`, request)
      .pipe(toResult<StaffMemberResponse>());
  }

  /** A full replace of the week. `staff:manage_schedule`, or the own code on the own row. */
  updateWorkHours(
    staffMemberId: string,
    request: UpdateStaffWorkHoursRequest,
  ): Observable<Result<StaffScheduleChangeResponse>> {
    return this.http
      .put<StaffScheduleChangeResponse>(`${this.memberUrl(staffMemberId)}/work-hours`, request)
      .pipe(toResult<StaffScheduleChangeResponse>());
  }

  /**
   * Current and upcoming, soonest first. With `past`, what has ended, latest first. Needs
   * `members:read`, except on the caller's own record.
   */
  timeOff(staffMemberId: string, past: boolean): Observable<Result<StaffTimeOffResponse[]>> {
    return this.http
      .get<StaffTimeOffResponse[]>(`${this.memberUrl(staffMemberId)}/time-off?past=${past}`)
      .pipe(toResult<StaffTimeOffResponse[]>());
  }

  /** `staff:manage_timeoff`, or the own code on the own row. 201. */
  createTimeOff(
    staffMemberId: string,
    request: CreateStaffTimeOffRequest,
  ): Observable<Result<StaffScheduleChangeResponse>> {
    return this.http
      .post<StaffScheduleChangeResponse>(`${this.memberUrl(staffMemberId)}/time-off`, request)
      .pipe(toResult<StaffScheduleChangeResponse>());
  }

  updateTimeOff(
    staffMemberId: string,
    timeOffId: string,
    request: UpdateStaffTimeOffRequest,
  ): Observable<Result<StaffScheduleChangeResponse>> {
    return this.http
      .put<StaffScheduleChangeResponse>(this.timeOffUrl(staffMemberId, timeOffId), request)
      .pipe(toResult<StaffScheduleChangeResponse>());
  }

  deleteTimeOff(staffMemberId: string, timeOffId: string): Observable<Result<null>> {
    return this.http.delete<null>(this.timeOffUrl(staffMemberId, timeOffId)).pipe(toResult<null>());
  }

  private memberUrl(staffMemberId: string): string {
    return this.url(`staff/${encodeURIComponent(staffMemberId)}`);
  }

  private timeOffUrl(staffMemberId: string, timeOffId: string): string {
    return `${this.memberUrl(staffMemberId)}/time-off/${encodeURIComponent(timeOffId)}`;
  }
}

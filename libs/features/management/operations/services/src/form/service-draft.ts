import type {
  CreateServiceRequest,
  ServiceOptionsResponse,
  ServiceStaffAddEditDto,
  ServiceResponse,
} from '@api/services';
import type { FormFailure } from '@util/forms';

import type {
  ServiceFormValue,
  ServiceStaffFormValue,
  ServiceStaffRow,
} from './service.form.types';

/** A new service's starting length, a common haircut. */
const DEFAULT_DURATION = 30;

/**
 * A new service: one empty block per language, every active, bookable barber selected, and no
 * buffers.
 */
export function emptyServiceForm(options: ServiceOptionsResponse | null): ServiceFormValue {
  return {
    translations: (options?.languages ?? []).map((languageCode) => ({
      languageCode,
      name: '',
      description: '',
    })),
    categoryId: '',
    price: null,
    durationMinutes: DEFAULT_DURATION,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    isActive: true,
    staff: staffRows(options, [], true),
  };
}

/** A saved service, in the options' language order and with the options' barbers. */
export function formFromService(
  service: ServiceResponse,
  options: ServiceOptionsResponse | null,
): ServiceFormValue {
  const languages = options?.languages ?? service.translations.map((item) => item.languageCode);
  return {
    translations: languages.map((languageCode) => {
      const translation = service.translations.find((item) => item.languageCode === languageCode);
      return {
        languageCode,
        name: translation?.name ?? '',
        description: translation?.description ?? '',
      };
    }),
    categoryId: service.categoryId ?? '',
    price: service.price,
    durationMinutes: service.durationMinutes,
    bufferBeforeMinutes: service.bufferBeforeMinutes,
    bufferAfterMinutes: service.bufferAfterMinutes,
    isActive: service.isActive,
    staff: staffRows(options, service.staff, false),
  };
}

/**
 * The barbers the form offers: every active, bookable one, and any other one already assigned.
 * An update is a full replace, so a row left out would unassign that barber.
 */
function staffRows(
  options: ServiceOptionsResponse | null,
  assigned: ServiceResponse['staff'],
  selectAll: boolean,
): ServiceStaffFormValue[] {
  const byId = new Map(assigned.map((item) => [item.staffMemberId, item]));
  return (options?.staffMembers ?? [])
    .filter((member) => (member.isActive && member.isBookable) || byId.has(member.id))
    .map((member) => {
      const own = byId.get(member.id);
      return {
        staffMemberId: member.id,
        selected: selectAll || own !== undefined,
        customPrice: own?.customPrice ?? null,
        customDurationMinutes: own?.customDurationMinutes ?? null,
      };
    });
}

/** Who each form row is. A row whose staff member the options lack keeps its id as its name. */
export function describeStaffRows(
  staff: readonly ServiceStaffFormValue[],
  options: ServiceOptionsResponse | null,
): readonly ServiceStaffRow[] {
  const members = new Map((options?.staffMembers ?? []).map((member) => [member.id, member]));
  return staff.map((row, index) => {
    const member = members.get(row.staffMemberId);
    return {
      index,
      staffMemberId: row.staffMemberId,
      displayName: member?.displayName ?? row.staffMemberId,
      isActive: member?.isActive ?? false,
      isBookable: member?.isBookable ?? false,
    };
  });
}

/**
 * The write body, and for each `staff[i]` it sends, the form row it came from. Only selected
 * barbers are sent, so the indexes differ.
 */
export function serviceRequest(value: ServiceFormValue): {
  readonly request: CreateServiceRequest;
  readonly staffRows: readonly number[];
} {
  const staffRows: number[] = [];
  const staff: ServiceStaffAddEditDto[] = [];
  value.staff.forEach((row, index) => {
    if (!row.selected) return;
    staffRows.push(index);
    staff.push({
      staffMemberId: row.staffMemberId,
      customPrice: row.customPrice ?? null,
      customDurationMinutes: row.customDurationMinutes ?? null,
    });
  });
  return {
    request: {
      categoryId: value.categoryId === '' ? null : value.categoryId,
      price: value.price ?? 0,
      durationMinutes: value.durationMinutes ?? 0,
      bufferBeforeMinutes: value.bufferBeforeMinutes ?? 0,
      bufferAfterMinutes: value.bufferAfterMinutes ?? 0,
      isActive: value.isActive,
      translations: value.translations.map((translation) => ({
        languageCode: translation.languageCode,
        name: translation.name.trim(),
        description: translation.description.trim() === '' ? null : translation.description.trim(),
      })),
      staff,
    },
    staffRows,
  };
}

/** Moves a refusal on `staff[i]` of the request to the form row it came from. */
export function toFormStaffRows(failure: FormFailure, staffRows: readonly number[]): FormFailure {
  return {
    errors: failure.errors.map((error) => {
      const path = error.path;
      const sent = path?.[1];
      if (path?.[0] !== 'staff' || typeof sent !== 'number') return error;
      const row = staffRows.at(sent);
      return row === undefined
        ? { ...error, path: undefined }
        : { ...error, path: ['staff', row, ...path.slice(2)] };
    }),
  };
}

/** The saved service as a write body with only `isActive` changed: Activate and Deactivate. */
export function activeRequest(service: ServiceResponse, isActive: boolean): CreateServiceRequest {
  return {
    categoryId: service.categoryId,
    price: service.price,
    durationMinutes: service.durationMinutes,
    bufferBeforeMinutes: service.bufferBeforeMinutes,
    bufferAfterMinutes: service.bufferAfterMinutes,
    isActive,
    translations: service.translations.map((translation) => ({
      languageCode: translation.languageCode,
      name: translation.name,
      description: translation.description,
    })),
    staff: service.staff.map((member) => ({
      staffMemberId: member.staffMemberId,
      customPrice: member.customPrice,
      customDurationMinutes: member.customDurationMinutes,
    })),
  };
}

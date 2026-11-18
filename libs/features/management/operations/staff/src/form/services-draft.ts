import type {
  StaffMemberServiceViewDto,
  StaffOptionsResponse,
  StaffServiceAddEditDto,
  UpdateStaffServicesRequest,
} from '@api/staff';
import type { FormFailure } from '@util/forms';

import type { ServiceGroupView, ServiceRowView, ServicesFormValue } from './services.form.types';

/** The group key of the services with no category. */
const UNCATEGORIZED = '';

/**
 * The rows the form offers: every active service, and any other one the member already has. The
 * write is a full replace, so a row left out would drop that service.
 */
export function servicesForm(
  assigned: readonly StaffMemberServiceViewDto[],
  options: StaffOptionsResponse | null,
): ServicesFormValue {
  const byId = new Map(assigned.map((item) => [item.serviceId, item]));
  return {
    rows: (options?.services ?? [])
      .filter((service) => service.isActive || byId.has(service.id))
      .map((service) => {
        const own = byId.get(service.id);
        return {
          serviceId: service.id,
          selected: own !== undefined,
          customPrice: own?.customPrice ?? null,
          customDurationMinutes: own?.customDurationMinutes ?? null,
        };
      }),
  };
}

/**
 * The rows grouped by category, in the options' order. A row whose service the options lack
 * keeps its id as its name, so it still reaches the screen.
 */
export function serviceGroups(
  value: ServicesFormValue,
  options: StaffOptionsResponse | null,
  uncategorized: string,
): readonly ServiceGroupView[] {
  const services = new Map((options?.services ?? []).map((service) => [service.id, service]));
  const groups = new Map<string, { name: string; rows: ServiceRowView[] }>();
  value.rows.forEach((row, index) => {
    const service = services.get(row.serviceId);
    const key = service?.categoryId ?? UNCATEGORIZED;
    const group = groups.get(key) ?? { name: service?.categoryName ?? uncategorized, rows: [] };
    group.rows.push({
      index,
      serviceId: row.serviceId,
      name: service?.name ?? row.serviceId,
      isActive: service?.isActive ?? false,
      price: service?.price ?? 0,
      durationMinutes: service?.durationMinutes ?? 0,
    });
    groups.set(key, group);
  });
  return [...groups].map(([key, group]) => ({ key, name: group.name, rows: group.rows }));
}

/**
 * The write body, and for each `services[i]` it sends, the form row it came from. Only selected
 * rows are sent, so the indexes differ.
 */
export function servicesRequest(value: ServicesFormValue): {
  readonly request: UpdateStaffServicesRequest;
  readonly rows: readonly number[];
} {
  const rows: number[] = [];
  const services: StaffServiceAddEditDto[] = [];
  value.rows.forEach((row, index) => {
    if (!row.selected) return;
    rows.push(index);
    services.push({
      serviceId: row.serviceId,
      customPrice: row.customPrice ?? null,
      customDurationMinutes: row.customDurationMinutes ?? null,
    });
  });
  return { request: { services }, rows };
}

/** Moves a refusal on `services[i]` of the request to the form row it came from. */
export function toFormRows(failure: FormFailure, rows: readonly number[]): FormFailure {
  return {
    errors: failure.errors.map((error) => {
      const path = error.path;
      const sent = path?.[1];
      if (path?.[0] !== 'services' || typeof sent !== 'number') return error;
      const row = rows.at(sent);
      return row === undefined
        ? { ...error, path: undefined }
        : { ...error, path: ['rows', row, ...path.slice(2)] };
    }),
  };
}

# @api/staff

The shop's people: `/api/v1/staff`. The management staff page reads and writes it. The API
resolves the shop from the signed-in user, so no call takes a company id.

```ts
const saved = await firstValueFrom(api.updateWorkHours(id, { workHours }));
```

| Call                          | Endpoint                                 | Permission                                               |
| ----------------------------- | ---------------------------------------- | -------------------------------------------------------- |
| `list`                        | `GET …` — every member, as cards         | `members:read`                                           |
| `options`                     | `GET …/options` — hours, roles, services | `members:read`                                           |
| `member`                      | `GET …/{id}`                             | `members:read`                                           |
| `findCandidate`               | `POST …/candidates` — the exact address  | `members:invite`, 10 a minute                            |
| `createMember`                | `POST …` → 201                           | `members:invite`, + `roles:assign` with roles            |
| `updateMember`                | `PUT …/{id}` — a full replace            | `members:update`, + `roles:assign` when the roles change |
| `setActive`                   | `POST …/{id}/activate`, `…/deactivate`   | `members:remove`                                         |
| `deleteMember`                | `DELETE …/{id}` → 204                    | `members:remove`                                         |
| `uploadPhoto` / `deletePhoto` | `PUT` / `DELETE …/{id}/photo`            | `members:update`                                         |
| `updateServices`              | `PUT …/{id}/services` — a full replace   | `staff:manage_services`                                  |
| `updateWorkHours`             | `PUT …/{id}/work-hours` — the whole week | `staff:manage_schedule`, or `…_own_schedule` on your row |
| `timeOff`                     | `GET …/{id}/time-off?past=`              | `members:read`                                           |
| `create/update/deleteTimeOff` | `…/{id}/time-off[/{timeOffId}]`          | `staff:manage_timeoff`, or `…_own_timeoff` on your row   |

## What is worth knowing

- **The type names are the backend's DTO names.** The public shop page's barber is
  `CompanyStaffMemberViewDto` in the barbershops lib, not `StaffMemberResponse`.
- **Three refusals carry data beside the code.** `STAFF_ALREADY_MEMBER` names the member
  (`alreadyMemberOf`), and `STAFF_HAS_UPCOMING_APPOINTMENTS` the count (`upcomingCountOf`). They
  read the problem body the `HttpError` keeps in `raw`.
- **The candidate lookup matches the whole address only.** No call searches users, by design: a
  shop must not learn other people's addresses.
- **The photo part keeps its type.** The API checks the multipart part's `Content-Type`, so a
  cropped `Blob` must be `image/webp`, `image/jpeg` or `image/png`.
- **Times are shop-local.** Dates are `YYYY-MM-DD`, times `HH:mm`, `dayOfWeek` ISO (1 is Monday).
  Every `…At` is a UTC instant.

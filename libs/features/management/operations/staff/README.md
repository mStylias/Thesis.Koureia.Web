# @features/management-operations-staff

The shop's people as cards, at `/management/staff`. `management-layout` registers `staffRoute` in
its `PAGE_ROUTES`. The page gate is `members:read`.

| Piece                                      | Holds                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `staff.routes.ts`                          | The dictionary, the store, the error copy, the drawer child route      |
| `staff.store.ts`                           | The cards and the options, read whole: a shop has a handful of people  |
| `staff.errors.ts`                          | The page's copy for every `STAFF_*` code, provided on the route        |
| `staff.format.ts`                          | Hours, shop-local dates, "today" and "tomorrow", role and title labels |
| `list/staff-list.ts`, `list/staff-card.ts` | The toolbar, the status filter, the cards                              |
| `add/add-member-dialog.ts`                 | Find a person by the whole address, then add them with defaults        |
| `details/staff-member-details.ts`          | The drawer: four tabs, the toolbar, activate, deactivate, delete       |
| `details/profile`, `services`              | One tab each, each with its own form and save                          |
| `details/photo/photo-crop-dialog.ts`       | `@ui/image-cropper` in a dialog, before the upload                     |
| `form/*`                                   | The field specs, and request and error-path conversions per tab        |

The Hours and Time off tabs come from `@features/management-shared-staff-schedule`. `StaffList`
provides `StaffStore` as its `STAFF_SCHEDULE_CONTEXT`, and `loadStaffDictionaries` loads that
lib's dictionary too.

## What is worth knowing

- **Nothing suggests an address.** The add dialog's field is `type="text"` with
  `autocomplete="off"`, and its model member is `lookup`, not `email`: Signal Forms names the input
  after the member, and a name holding "email" makes a browser offer saved addresses. The API's
  `email` errors are moved onto `lookup`.
- **Each tab saves on its own and keeps its edits.** The panels are eager, so switching tabs drops
  nothing. The drawer asks once, on close or navigation, for every tab with changes. The headless
  tabs warn about eager panels in development; a lazy panel would be destroyed when hidden.
- **The toolbar follows the active tab.** A tab implements `StaffTabEditor`; the drawer shows its
  Edit, or its Cancel and Save. Time off has a "New time off" button instead.
- **Rank rules only where the API applies them.** `canManage` gates the profile, the photo,
  deactivate and delete. Services, hours and time off follow their permission alone. Activate
  follows `members:remove` alone. On your own row the roles are read-only and sent unchanged.
- **Every write is a full replace.** Services offer every active service plus any inactive one the
  member already has, or a save would drop it. The week sends only working days.
- **Errors land on the row they name.** `services[i]` and `workHours[i]` index the request, which
  sends only selected rows and working days, so `form/*-draft.ts` maps them back.
- **Times are the shop's.** "Today", "tomorrow" and the default time-off day use
  `options.timezone`, never the browser's zone.
- **Hours and time off can leave appointments uncovered.** The response lists them; the tab shows
  them with links to the appointments page and moves nothing.

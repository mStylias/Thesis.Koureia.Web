# @features/management-operations-services

The shop's services and prices as a grid, at `/management/services`. `management-layout` registers
`servicesRoute` in its `PAGE_ROUTES`. The page gate is `services:read`.

| Piece                         | Holds                                                                 |
| ----------------------------- | --------------------------------------------------------------------- |
| `services.routes.ts`          | The dictionary, the store, the drawer child route and its leave guard |
| `services.store.ts`           | The options, the grid source, the Barbers header-filter source        |
| `services.columns.ts`         | Every column, and which filter each takes                             |
| `list/services-list.ts`       | The grid and the toolbar                                              |
| `details/service-details.ts`  | The drawer: view, edit and create, activate, deactivate, delete       |
| `details/service-view.ts`     | The drawer's read-only body                                           |
| `form/service.form.ts`        | The field specs, the API's limits, the rules for the per-item arrays  |
| `form/service-draft.ts`       | Form from a service, request from the form, error paths back to rows  |
| `category/category-dialog.ts` | Create, rename and delete a shop category, in every language          |

## What is worth knowing

- **The endpoint does every operation.** `remote: true` over `services/odata`. Category and
  Status take a fixed header list, Barbers its own source, the rest the filter row.
- **Header filters test ids.** Category filters `categoryId`, and "Uncategorized" is
  `categoryId eq null`. Barbers filters `staff/any(s: s/staffMemberId …)`.
- **The options are read beside the first load.** `services/options` names the categories, the
  languages and the staff. A failure leaves `null`: the grid still renders, and the drawer offers
  a retry before it edits.
- **The form mirrors the request.** `translations` follows `options.languages`, so a server error
  on `translations[1].name` lands on that language as it is. `staff` lists every barber the form
  offers, but the request sends only the selected ones, so `toFormStaffRows` moves a refusal on
  `staff[i]` back to its row.
- **An update is a full replace.** The barber rows include every active, bookable barber and
  every barber already assigned, inactive ones included. Leaving one out would unassign it.
- **An empty number is `null`.** Signal Forms reads a `number | undefined` member as optional,
  and `lib-input-number` writes `null` for an empty field.
- **Delete shows only when `canDelete` is true.** That is false once the service is on any
  appointment, cancelled ones included, which `timesBooked` does not count. A `409 SERVICE_IN_USE`
  from a booking that landed meanwhile offers Deactivate instead.
- **Every category write needs `services:update`**, create included, so the "+" follows that
  code, not `services:create`.

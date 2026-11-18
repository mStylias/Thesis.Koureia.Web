# @features/management-operations-customers

The shop's customers as a server-side grid, at `/management/customers`. `management-layout`
registers `customersRoute` in its `PAGE_ROUTES`. The page gate is `customers:read`.

| Piece                               | Holds                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------- |
| `customers.routes.ts`               | The dictionary, the export writers, the drawer child route             |
| `customers.store.ts`                | The OData source, the shop zone, the barbers, `revision`               |
| `customers.columns.ts`              | Every column, and which exist without `analytics:read`                 |
| `customers.format.ts`               | Shop-local days, instants in the shop zone, initials                   |
| `list/customers-list.ts`            | The toolbar, the search, the grid                                      |
| `list/not-back-filter.ts`           | The "Χωρίς επιστροφή" quick filter, read from and written to the grid  |
| `details/customer-details.ts`       | The drawer: the toolbar, view and edit, the leave guard                |
| `details/customer-view.ts`          | The read-only sections and the customer's appointments                 |
| `details/customer-details.form.ts`  | The field specs and the merge-patch                                    |
| `details/block-customer-dialog.ts`  | Block with an internal reason. Unblock is a confirmation in the drawer |
| `details/merge-customers-dialog.ts` | Pick the other walk-in, then the side of each value. Cannot be undone  |

## What is worth knowing

- **A visit is a completed appointment.** A shop that never marks appointments completed sees 0
  visits. The Visits caption's tooltip says so.
- **Spend columns do not exist without `analytics:read`.** They are left out of the column list,
  not hidden, so the chooser, the filter builder and the export never offer them, and a saved view
  that names them drops them. The API refuses a spend filter or sort with
  `CUSTOMER_SPEND_FORBIDDEN`.
- **The list always has an order.** The API applies none, so the store sends
  `$orderby=displayName` when the grid has no sort.
- **Days are `Edm.Date`.** `…Date` and `customerSince` are shop-local days. The store declares them
  as `dateFields`, so a filter sends a bare `2026-09-01`, never an instant.
- **The quick filter holds no state.** A choice writes `daysSinceLastVisit ≥ N` and
  `upcomingCount = 0` into the filter row. The select reads them back after every grid change, so a
  saved view keeps the choice, Reset clears it, and the same filters set by hand show the choice.
  A customer with no completed visit has no `daysSinceLastVisit` and never matches.
- **The save is a merge-patch.** It sends only the members that changed, so two people editing
  different members both keep their change. An account holder's contact members are never sent.
- **The shop zone comes from the workspace.** `company.timezone` of `GET /users/me/workspace`, and
  the browser's zone until the API sends it.
- **Not found closes the drawer.** A merged walk-in and a walk-in whose person signed up answer
  `404` with no id to follow.
- **Block and merge answer the customer as saved.** The drawer shows the answer and reloads the
  grid. The block's answer carries the upcoming count to trust, which the toast repeats.
- **The email clash offers a merge.** `CUSTOMER_EMAIL_USED_BY_WALK_IN` names the other walk-in
  (`emailOwnerOf`). The button drops the edit and opens the merge on that record, the open one
  kept.
- **Merge defaults pick the latest visit**, but an empty value never wins over a filled one. The
  joined note shows the kept record's first, as the API saves it.
- **The page has no appointment drawer.** An appointment in the list, Νέο ραντεβού and Όλα τα
  ραντεβού open the appointments page.

## Suggested views

`@ui/saved-views` ships no built-in views. These are worth saving per shop:

| View                      | Filters                                      |
| ------------------------- | -------------------------------------------- |
| Χωρίς επιστροφή 60 ημέρες | The quick filter on 60 ημέρες                |
| Αποκλεισμένοι             | Αποκλεισμός: Αποκλεισμένος                   |
| Με μη εμφανίσεις          | Δεν ήρθε ≥ 2, sorted by Δεν ήρθε, descending |

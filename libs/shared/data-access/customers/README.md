# @api/customers

The shop's customers: `/api/v1/customers`. The management customers page reads and writes it. The
API resolves the shop from the signed-in user, so no call takes a company id.

```ts
const saved = await firstValueFrom(api.update(id, { note: 'Short on the sides' }));
```

| Call       | Endpoint                                      | Permission                            |
| ---------- | --------------------------------------------- | ------------------------------------- |
| `list`     | `GET …/odata` — the grid, paged, `$top` ≤ 100 | `customers:read`                      |
| `customer` | `GET …/{id}`                                  | `customers:read`                      |
| `update`   | `PATCH …/{id}` — a merge-patch                | `customers:read` + `customers:update` |
| `block`    | `POST …/{id}/block`, `{ reason }`             | `customers:read` + `customers:block`  |
| `unblock`  | `POST …/{id}/unblock`                         | `customers:read` + `customers:block`  |
| `merge`    | `POST …/merge`                                | `customers:read` + `customers:merge`  |

## What is worth knowing

- **The type names are the backend's DTO names.** The booking form's customer search is a
  different shape, `CustomerOptionODataResponse` in `@api/appointments`.
- **A visit is a completed appointment.** A shop that never marks appointments completed sees 0
  visits.
- **Spend needs `analytics:read`.** Without it `totalSpend` and `averageSpend` are `null`, and a
  `$filter` or `$orderby` on them is `403 CUSTOMER_SPEND_FORBIDDEN`.
- **The update is a merge-patch.** An absent member is unchanged and `null` clears it. Contact
  members are refused for an account holder (`CUSTOMER_CONTACT_DETAILS_READ_ONLY`).
- **`CUSTOMER_EMAIL_USED_BY_WALK_IN` names the other walk-in.** `emailOwnerOf` reads its
  `customerId` from the problem body that the `HttpError` keeps in `raw`.
- **A walk-in id can stop working.** A merge or the person's sign-up makes it answer
  `CUSTOMER_NOT_FOUND`, with no replacement id.
- **Dates are shop-local.** `…Date` and `customerSince` are `YYYY-MM-DD` (`Edm.Date`). Every `…At`
  is a UTC instant.

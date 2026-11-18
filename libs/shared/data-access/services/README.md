# @api/services

The shop's service catalog: `/api/v1/services`. The management services page reads and writes it.
The API resolves the shop from the signed-in user, so no call takes a company id.

```ts
const saved = await firstValueFrom(api.updateService(id, request));
```

| Call             | Endpoint                                                   | Permission        |
| ---------------- | ---------------------------------------------------------- | ----------------- |
| `grid`           | `GET …/odata` — the fetch for the grid's OData data source | `services:read`   |
| `options`        | `GET …/options` — currency, languages, categories, staff   | `services:read`   |
| `service`        | `GET …/{id}` — one service in every language               | `services:read`   |
| `createService`  | `POST …` → 201                                             | `services:create` |
| `updateService`  | `PUT …/{id}` — a full replace                              | `services:update` |
| `deleteService`  | `DELETE …/{id}` → 204                                      | `services:delete` |
| `createCategory` | `POST …/categories` → 201                                  | `services:update` |
| `updateCategory` | `PUT …/categories/{id}`                                    | `services:update` |
| `deleteCategory` | `DELETE …/categories/{id}` → 204                           | `services:update` |

## What is worth knowing

- **The type names are the backend's DTO names.** `ServiceODataResponse` here is the grid row. The
  appointments grid's filter list is `ServiceOptionODataResponse` in `@api/appointments`.
- **An update is a full replace.** A barber the request leaves out is unassigned, and every
  language must be sent.
- **Delete is refused once the service is on any appointment**, cancelled ones included:
  `409 SERVICE_IN_USE`. `ServiceResponse.canDelete` says so in advance.
- **A refusal can carry field errors on a 409.** `SERVICE_NAME_TAKEN` names
  `translations[i].name`, so read `validationErrors` whatever the status.
- **The categories sit under `services/`.** Synax builds the route prefix from the endpoint's tag.

# @api/company

The shop's own settings: `/api/v1/company`. The management "My company" page reads and writes
it. The API resolves the shop from the signed-in user, or from `X-Company-Id` for a platform
admin, so no call takes a company id.

```ts
const saved = await firstValueFrom(api.updateHours({ businessHours }));
```

| Call                              | Endpoint                                     | Permission       |
| --------------------------------- | -------------------------------------------- | ---------------- |
| `settings`                        | `GET company?languageCode=`                  | member           |
| `updateHours`                     | `PUT …/business-hours` — the whole week      | `company:update` |
| `holidays`                        | `GET …/holidays?past=`                       | member           |
| `createHoliday`                   | `POST …/holidays` → 201                      | `company:update` |
| `updateHoliday` / `deleteHoliday` | `PUT` / `DELETE …/holidays/{id}`             | `company:update` |
| `updateBookingRules`              | `PUT …/booking-rules`                        | `company:update` |
| `uploadLogo` / `deleteLogo`       | `PUT` / `DELETE …/logo`                      | `company:update` |
| `photos`                          | `GET …/photos` — in display order            | member           |
| `uploadPhoto`                     | `POST …/photos` → 201                        | `company:update` |
| `updatePhoto` / `deletePhoto`     | `PUT` / `DELETE …/photos/{id}`               | `company:update` |
| `reorderPhotos`                   | `PUT …/photos/order` — every id exactly once | `company:update` |

## What is worth knowing

- **The type names are the backend's DTO names.** `BusinessHourViewDto` is `@api/appointments`'s.
- **The file part keeps its type.** The API checks the multipart part's `Content-Type`, so a
  cropped `Blob` must be `image/webp`, `image/jpeg` or `image/png`.
- **A schedule write never moves a booking.** `CompanyScheduleChangeResponse.conflicts` lists the
  upcoming appointments that now fall outside the open time.
- **Times are shop-local.** Dates are `YYYY-MM-DD`, times `HH:mm`, `dayOfWeek` ISO (1 is Monday).

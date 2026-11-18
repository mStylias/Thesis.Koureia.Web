# @api/user-resources

Per-user JSON storage: `/api/v1/users/me/resources`. A row is a name plus any
JSON the client wants, and the backend never reads inside `value`.

```ts
const found = await firstValueFrom(api.findByName<Layout>('bookings_grid_views'));
await firstValueFrom(api.patch(found.id, { value: nextLayout }));
```

## What is worth knowing

- **Rows belong to the signed-in user, not to a company.** The user comes from
  the token, so no `userId` is sent and none is accepted.
- **Another user's row answers `404`, not `403`.** It is indistinguishable from
  one that never existed, so nothing here treats the two apart.
- **Names are not unique.** `findByName` orders by `createdAt` and takes the
  oldest, so two sessions racing a create converge on one row instead of
  alternating between two. Everything else keys on `id`.
- **`patch` is a merge patch and `value` is replaced whole.** There is no deep
  merge into the stored JSON — read, modify and write the whole object.
- **The OData query string is appended to the URL**, never handed to
  `HttpClient` as `params`: those would encode it a second time and the server
  would search for the literal `%20`. A quote inside a name is doubled, which is
  the only thing that can end an OData literal.
- **`isShared` is stored and returned and does nothing yet.** No endpoint
  exposes another user's shared rows.

## Consumers

`@features/saved-views` keeps a grid's named views here, one resource per
grid.

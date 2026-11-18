# shared-data-access-synax-forms

Turns a Synax `HttpError` into what a form editor can place. Import from `@synax/forms`.

```ts
private readonly formErrors = injectFormErrors();

private async write(): Promise<FormFailure | undefined> {
  const result = await firstValueFrom(this.api.createRole(request));
  return result.isSuccess ? undefined : this.formErrors(result.error, { ROLE_NAME_TAKEN: 'name' });
}
```

## Why its own library

`@util/forms` must not know the wire format and `@ui/*` must never see an `HttpError` — the
module-boundary rule forbids a `type:ui` library from reaching a `type:data-access` one. This is the
one place that knows both contracts, and it is the whole of it.

## What it maps

| From                                       | To                                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| a validation error with a `propertyName`   | a failure on that field, path parsed into segments (`items[2].name` → `['items', 2, 'name']`) |
| a validation error with no `propertyName`  | a general message                                                                             |
| an `errorCode` listed in `fieldByCode`     | a failure on the property it names                                                            |
| a refusal with no validation errors at all | one general message, resolved through `SYNAX_ERROR_MESSAGES`                                  |

Nested `innerErrors` are flattened with their parent's path, exactly as `flattenValidationErrors`
does. A description the server left empty is answered by the message registry rather than shown
blank. Nothing is dropped: a property this form does not edit still reaches the user as a general
message, because a message nobody sees is worse than one in the wrong place.

## API

- `injectFormErrors(): (error, fieldByCode?) => FormFailure` — binds the app's message registry.
- `formErrors(error, resolveMessage, fieldByCode?)` — the pure half, for a caller that already has
  a resolver.

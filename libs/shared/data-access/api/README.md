# `@api/core`

The HTTP foundation every call to the Koureia API stands on.

## What it is

```ts
// app.config.ts
provideApi({ baseUrl: environment.apiUrl });
```

That single call gives you an `HttpClient` on the Fetch backend, the API-scoped
interceptor chain, and the base URL `injectSynaxUrl()` builds against.

## What it is not

It is not a client. `@synax`'s design note is explicit that wrapping `HttpClient` hides its
own surface and fights every other library built on it, so services keep calling
`HttpClient` directly and pipe through `toResult()`:

```ts
private readonly http = inject(HttpClient);
private readonly url = injectSynaxUrl();

me() {
  return this.http.get<UserResponse>(this.url('users/me')).pipe(toResult());
  //     → Observable<Result<UserResponse, HttpError>>
}
```

It also owns no wire shapes. `UserResponse` above belongs to the library that needs it.

## The three rules it enforces

1. **A failure is an `ApiError`.** The RFC 9457 problem body is parsed once, in the
   interceptor. `toResult()` still yields `Result.Fail(HttpError)` — `ApiError` keeps the
   original `HttpErrorResponse` as its `cause`, which is what `tryAsHttpError` walks.
2. **`withCredentials` is never sent.** The API's CORS policy is `DisallowCredentials`.
   The interceptor clears it and warns in dev, because the alternative is a browser-level
   rejection that reads as a network outage.
3. **All of this is scoped by `isApiUrl`.** The app also talks to Keycloak. Nothing here
   touches those requests, and Phase 2's bearer-token interceptor uses the same predicate
   for the same reason.

## Reading errors

`errorCode` is the problem `title`; `httpCode` is the status. **Decide sign-in state by
`httpCode`, never by `errorCode`** — a `401` from the authentication middleware carries no
body at all and surfaces as the synthetic `HTTP_401`.

```ts
const result = await firstValueFrom(this.users.me());
if (result.isFailure) {
  switch (result.error.errorCode) {
    case 'AUTH_EMAIL_NOT_VERIFIED': ...
    case 'AUTH_PERMISSION_DENIED': ...
  }
}
```

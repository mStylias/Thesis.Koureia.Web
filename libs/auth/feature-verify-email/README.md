# `@auth/feature-verify-email`

The routed screen that proves the email address a local registration signed up with.

```ts
{
  path: 'verify-email',
  loadChildren: () => import('@auth/feature-verify-email').then((m) => m.verifyEmailRoutes),
}
```

## How a person gets here

The BFF callback decides. When the exchanged session says `email_verified: false` it redirects to
`/{lang}/verify-email?returnUrl=<where they were going>` instead of to the return URL. An
unverified address cannot reach a single API endpoint except the two that fix it, so landing
anywhere else would only produce `403 AUTH_EMAIL_NOT_VERIFIED`.

Google identities arrive verified and never reach this route.

That redirect happens once. Somebody who leaves the screen without entering a code is signed in,
unverified, and past the only thing that was going to tell them so. `EmailUnverified` in
`@auth/feature-session` is the standing reminder the app shell renders for exactly that state, and
its action leads back here with the current page as the `returnUrl`. It knows the path segment
`verify-email` by spelling it out, so a rename has to change three places: the app route, the BFF
redirect, and that component.

## The order that matters

On a correct code the screen calls `SessionStore.refresh()` **before** navigating.

Proving the address in Keycloak cannot alter a token that is already signed. The person's current
access token still says `email_verified: false`, and the API keeps refusing it until the token set
is exchanged. Navigating first lands them back on the wall of 403s they just escaped. This is why
the API states `tokenRefreshRequired` rather than implying it.

## Nothing here is hardcoded

Cell count, attempt count, code lifetime and resend cooldown all come from the send response
(`codeLength`, `maxAttempts`, `expiresInSeconds`, `resendAvailableInSeconds`). A backend
configuration change needs no release here.

Both countdowns are anchored to the browser clock at the moment the response arrives, using the
duration rather than the absolute `expiresAt`. A clock minutes out of step with the server turns
an absolute countdown into a lie; a duration does not care what time either machine thinks it is.

## The pending intent

Left untouched. Verification is not the operation that recorded an intent, and only the flow that
owns one may consume it — see `PendingIntentStore` in `@auth/data-access`.

## Copy

Owns the `verifyEmail` Transloco scope in `src/verify-email/i18n/`. The address is
identity-provider-owned and the API has no endpoint that changes it. Copy must not suggest the
address can be edited here.

The screen offers no way out. A person who registered with the wrong address has to sign out from
elsewhere and register again — this page will not do it for them, so it must never imply otherwise.

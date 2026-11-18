# @api/reminders

The reminder emails of the person an unsubscribe link belongs to. No sign-in: the signed token
is the authorization, and a walk-in has no account.

```ts
import { EmailRemindersApi, REMINDERS_INVALID_TOKEN } from '@api/reminders';
```

| Method               | Route                         |
| -------------------- | ----------------------------- |
| `read(token)`        | `GET /reminders/unsubscribe`  |
| `unsubscribe(token)` | `POST /reminders/unsubscribe` |
| `resubscribe(token)` | `POST /reminders/resubscribe` |

`read` changes nothing. Mail scanners open links, so only a button press may turn the emails off.
Each call answers `REMINDERS_INVALID_TOKEN` for a bad or unknown token. The token does not expire.

A signed-in customer changes the same setting through `emailRemindersEnabled` on `PATCH /users/me`
(`@api/users`).

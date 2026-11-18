# @api/user-devices

The browsers that receive the caller's reminder pushes, and the VAPID key a browser subscribes
with.

```ts
import { UserDeviceErrorCodes, UserDevicesApi } from '@api/user-devices';
```

| Method                 | Route                                        |
| ---------------------- | -------------------------------------------- |
| `publicKey()`          | `GET /reminders/push/public-key`, no sign-in |
| `register(body)`       | `PUT /users/me/push-devices`                 |
| `unregister(endpoint)` | `POST /users/me/push-devices/unregister`     |
| `sendTest(endpoint)`   | `POST /users/me/push-devices/test`           |

A browser is known by its push endpoint. Registering is safe to repeat, and a browser registered
to another account moves to the caller. `REMINDERS_PUSH_NOT_CONFIGURED` means the environment has
no push keys, and push is off everywhere.

Use `PushReminders` from `@features/reminders` rather than this client: it keeps the browser and
the API in agreement.

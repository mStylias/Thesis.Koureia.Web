# @features/management-shared-appointments

The appointment drawer of the management pages: view, create and edit one appointment, change its
status, cancel it. The calendar and the appointments grid both mount it.

```ts
children: [
  {
    path: ':appointmentId',
    component: AppointmentDetails,
    canDeactivate: [leaveAppointmentDetails],
    runGuardsAndResolvers: appointmentDetailsChanged,
  },
];
// and on the page component:
providers: [{ provide: APPOINTMENT_PANEL_HOST, useFactory: myPanelHost }];
```

The page also preloads the `managementAppointments` scope (`appointmentsInlineLoader`) when it
translates status labels imperatively.

| Piece                      | Holds                                                                         |
| -------------------------- | ----------------------------------------------------------------------------- |
| `panel/`                   | The route component: the read, the modes, the toolbar, every write, the guard |
| `view/`                    | View mode and the customer's history                                          |
| `form/`                    | The fields, the pure draft rules, the request builders                        |
| `cancel/`                  | The cancel dialog                                                             |
| `host/`                    | `APPOINTMENT_PANEL_HOST`: what the drawer needs from its page                 |
| `appointment-status.ts`    | The status codes, tones, labels and allowed transitions                       |
| `data/customers-source`    | The shop's customers as a data source, for the form and the calendar filter   |
| `host/appointment-prefill` | `readPrefill` and `prefillParams`: a create's prefill in the address          |

## What is worth knowing

- **A tile opens in view mode.** The mode is not in the address, so a reload of an edit lands in
  view. `new` and an id are one route, so another tile changes the parameter and the drawer stays.
- **The page owns every move.** The drawer calls the host to open, create, close and report a
  write. It never navigates itself, so the calendar and the grid can each decide where a saved
  appointment shows.
- **Unsaved edits ask three ways.** The drawer's ×, Escape and Cancel ask through `closeGuard`. A
  navigation asks through `canDeactivate`, which `appointmentDetailsChanged` runs only when the
  appointment or the prefill changes. A reload asks through `beforeunload`. A discard resets the
  form, so the navigation it leads to does not ask again.
- **The end follows the services until the user types one.** `nextEnd` in `form/appointment-draft.ts`
  holds the rule. The end picker's `(valueChange)` marks the override, because a value the form
  writes does not emit it.
- **A past appointment is never re-priced, a future one is re-priced whole.** `draftLines` keeps
  the booked lines once the start has passed, and re-prices every line from the barber's offering
  when a future appointment's services or barber change.
- **Fields that are not on screen are `hidden`.** Signal Forms skips a hidden field's validation,
  which is what makes the walk-in fields optional for an existing customer, and every field but the
  note optional on a terminal appointment.
- **An edit is a merge patch of what changed.** Start and end travel together. The note never
  triggers an email.
- **The drawer has its own copy for the API's codes.** It provides `SYNAX_ERROR_MESSAGES` over the
  app's registry, so a refusal reads the same on its field and in a toast.
- Warnings come from `POST …/check` after a 400 ms pause. A failed check shows nothing, because the
  save still refuses a real overlap.
- **"View all" opens the appointments grid on the customer.** Both hosts link to
  `/management/appointments?customer=<id>` (`APPOINTMENTS_PAGE`, `CUSTOMER_PARAM`), which opens a
  temporary view there.
- **A create can start on a customer.** `?customerId=` (not `customer`, which the grid reads as its
  customer view) prefills the customer. The customers page's Νέο ραντεβού uses it.
- **The picked customer brings the shop's facts.** The form shows a block warning and a shop-note
  hint, and preselects the preferred barber once per customer, only into an empty barber field and
  only when that barber is active, bookable, offers every chosen service and is free at the start.
  A customer the search did not pick (a prefill, "Book again") is read by id. That read keys on
  its own `computed`: a resource whose `params` read the whole form restarts on every keystroke,
  and the request it started is cancelled.
- **A walk-in email asks whether an account holds it.** After the duplicate lookup's pause, a
  well-formed address goes to `POST …/customers/account-lookup` in the body. The shop-customer hint
  outranks it, and any refusal, the rate limit included, hides it.
- **`CUSTOMER_EMAIL_TAKEN` is a toast.** Another request gave the email to a customer at the same
  moment, and a retry books for them.
- **Every reader sees the shop's facts about the customer.** The view shows the block, the
  no-shows, a preferred barber who is not this appointment's, and the shop note apart from the
  customer's own note. No customer right is needed.

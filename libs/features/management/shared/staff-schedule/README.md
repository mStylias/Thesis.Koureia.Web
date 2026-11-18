# @features/management-shared-staff-schedule

One staff member's week and time off, for the management pages. The staff drawer mounts both,
and so does the profile page for the signed-in member.

```ts
// The host page provides the shop facts, and loads the dictionary before it renders.
const route: Route = {
  providers: [{ provide: STAFF_SCHEDULE_CONTEXT, useExisting: StaffStore }],
  resolve: { translations: () => loadStaffScheduleDictionaries(inject(TranslocoService)) },
};
```

```html
<lib-staff-hours
  [staffMemberId]="id"
  [workHours]="workHours"
  [editable]="canEditHours"
  [language]="language"
  (changed)="reload()"
/>
<lib-staff-time-off [staffMemberId]="id" [editable]="canManageTimeOff" [language]="language" />
```

| Piece                         | Holds                                                                   |
| ----------------------------- | ----------------------------------------------------------------------- |
| `hours/staff-hours.ts`        | The week in view and edit mode. It implements `StaffTabEditor`          |
| `hours/week-hours-grid.ts`    | The week in edit mode, for any host form. The company page uses it too  |
| `time-off/staff-time-off.ts`  | Current and past time off, edit and delete. `create()` opens the dialog |
| `time-off/time-off-dialog.ts` | One time off: whole days or a range of hours                            |
| `conflicts/staff-conflicts`   | The appointments a save left uncovered, with links to their drawer      |
| `context/`                    | `STAFF_SCHEDULE_CONTEXT`: shop hours, slot interval, zone               |
| `form/*`                      | The field specs, the week draft, and the request and error conversions  |
| `staff-schedule.format.ts`    | Shop-local days and spans                                               |

## What is worth knowing

- **The host owns the toolbar.** `StaffHours` has no Edit or Save button of its own. The host calls
  `edit()`, `save()` and `discard()`, and reads `editing()`, `submitting()`, `canEdit()` and
  `hasChanges()`.
- **The host can replace the empty-week line.** `emptyText` takes the host's own sentence. The
  profile page uses it, because the lib's line speaks about "the member".
- **The host can take away the inset.** Both components pad their content for a drawer edge. A
  host that pads its own content, such as a card, sets `--staff-schedule-inset: 0` on them. A
  negative margin is wrong: it must match the host's padding exactly, or the week leaves the card.
- **The week grid works without a reference.** `WeekHoursGrid` takes the host's form, so the
  company page edits the shop's own hours with it. Without a `reference` week, a day switched on
  starts from the nearest earlier open day and Copy goes to every open day. The host can limit
  the ranges a day takes and replace the words for a closed day and for Copy.
- **A save brings its conflicts into view.** The list renders above the week, so `StaffHours`
  scrolls it into view and moves focus to it after the save.
- **The host owns the permissions.** `editable` is the only gate. The API applies the same rule.
- **The dictionary must be loaded first.** Day names and labels are translated in `computed`s, which
  do not re-run when a lazy scope arrives. Each component provides the `managementStaffSchedule`
  scope for its template, but the host still preloads it.
- **The host owns the error copy.** A refusal resolves through the host's `SYNAX_ERROR_MESSAGES`.
  The staff page provides its `STAFF_*` copy on its route.
- **Times are the shop's.** "Today" and the default time-off day use the context's `timezone`,
  never the browser's zone.
- **A save can leave appointments uncovered.** The response lists them, the component shows them,
  and nothing is moved.

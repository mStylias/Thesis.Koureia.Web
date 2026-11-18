# Datetime picker

`lib-datetime-picker` combines a compact calendar with an optional wall-clock time.
It returns a local JavaScript `Date`. When time is off, the value is local midnight.

```html
<lib-datetime-picker [(value)]="startsAt" [(timeEnabled)]="includeTime" />
```

Users can type a localized date, optionally followed by `, HH:mm`, or use the panel.
The panel uses a compact calendar and the time picker's dropdown mode with its read-only clock face.
Popover edits are drafts until Apply. Cancel or dismissal leaves the value unchanged.
Use `iconPosition="end"` and `frameless` when a parent frame owns the field outline.

# Range picker

A closed numeric range control with two stable slider thumbs and two exact-value
fields. It is domain-neutral: configure currency for prices, a suffix for duration
or distance, or supply a custom formatter.

```html
<lib-range-picker
  [(value)]="priceRange"
  [domainMin]="0"
  [domainMax]="100"
  [step]="5"
  mode="currency"
  currency="EUR"
/>
```

## Update modes

`updateOn="change"` is the default for remote search. Dragging updates an internal
draft, then writes `value` and emits `valueCommitted` on release or field blur.
`updateOn="input"` writes `value` continuously and still emits `valueCommitted` at
the end of the interaction. `valueCommitted` reports the final range at the end of
every interaction, including one that lands back on the range it started from.
Focus that only passes through the control emits nothing.

## Formatting

The formatting API matches `@ui/input-number`: `mode`, `currency`, `locale`,
`useGrouping`, fraction digits, `prefix` and `suffix`. `valueFormatter` replaces
the `Intl.NumberFormat` result in the fields and slider `aria-valuetext`; prefix
and suffix still wrap it.

## Signal Forms

The component implements `FormValueControl<NumberRange>`. `[formField]` binds its
value and form state, and focus leaving the complete composite marks it touched.
Use `validateNumberRange(path, { domainMin, domainMax })` in the schema when the
model also needs ordering and domain validation.

## Normalization

The rendered range is clamped to the domain, snapped to `step` and ordered before
it reaches the thumbs and the fields. An external value outside those rules renders
through that normalized view and is never written back as a user change. `step`
falls back to `1` when it is not finite and positive. The domain end stays
reachable when the span is not a whole number of steps.

## Accessibility

The slider uses two native range inputs with stable minimum and maximum roles.
Both span the complete domain and expose formatted value text; the model clamps a
crossing so the roles never swap. The visible From and To fields
allow exact entry. Errors render once at group level, and consumer description ids
are composed with the error id.

## Running unit tests

Run `nx test shared-ui-range-picker`.

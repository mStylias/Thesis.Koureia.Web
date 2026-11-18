# shared-ui-phone-input

The international phone number input of the design system, built on
[intl-tel-input](https://intl-tel-input.com): country selector with flags and
search, as-you-type formatting, and example-number placeholders. Import from
`@ui/phone-input`.

```html
<label for="booking-phone">Mobile phone</label>
<lib-phone-input [formField]="bookingForm.phone" inputId="booking-phone" allowedTypes="mobile" />
```

```ts
const bookingForm = form(model, (booking) => {
  required(booking.phone);
  validatePhone(booking.phone, { allowedTypes: 'mobile', customRules: { gr: greekMobileRule } });
});
```

## Why everything heavy loads lazily

The intl-tel-input runtime, the libphonenumber utils (~250 kB) and the
country-selector UI translations are all pulled in through dynamic `import()` on
first render, so they never weigh on the initial bundle. The trade-off is a
window where the control is not yet live — `initialized()` gates error display
for exactly that reason, so a pre-filled invalid value cannot flash an error on
first paint.

## Why a change of language rebuilds the instance

`countryNameLocale`, `uiTranslations` and `allowedNumberTypes` are read only
when the plugin is constructed, and it offers no setter for them. They are
joined into one `initKey`, and a change rebuilds the instance; `value` and
`country` survive the swap. Several `init()` runs can be in flight at once, so
each carries a generation and abandons itself at its awaits once a newer run
starts or the component is destroyed — otherwise a slow first run could finish
last and leave the instance describing the wrong language, or attach a plugin
instance nothing will ever destroy.

## Why the styles are global

`styles/components/_phone-input.scss` (plus `styles/vendors/_intl-tel-input`)
rather than a component `styleUrl`: the rules must reach the DOM the plugin
injects at runtime, which Angular's emulated encapsulation cannot. Everything is
scoped under the `lib-phone-input` element or the plugin's `.iti` classes.

## API

- `value`: two-way `string` — the number in E.164 form (`"+306912345678"`),
  `''` while empty
- `country`: two-way `Iso2 | undefined` — follows the selector and any typed
  dial code; writing it switches the selector
- `initialCountry`: `Iso2` (default `'gr'`) — a fallback only; an explicit
  `country`, and a seeded `value`, both outrank it
- `allowedTypes`: `'any'` (default) | `'mobile'` | `'fixedLine'` — set the same
  value on `validatePhone`, which is what actually enforces it
- `placeholderNumberType`: number type of the example placeholder (default
  `MOBILE`)
- `size`: `sm` | `md` (default) | `lg`
- `disabled`, `invalid`, `touched`, `required`, `errors` — all bound
  automatically by `[formField]`
- `inputId`, `name`, `ariaLabel`, `ariaLabelledby`, `ariaDescribedby`
- `(touch)`: marks the field touched for Signal Forms once focus leaves — focus
  moving into the fullscreen country selector does not count
- `focus(options?)`: focuses the native input

Validation is a Signal Forms schema function, `validatePhone(path, config)`,
with `required()` for mandatory fields. Country-specific rules plug in via
`config.customRules` (see `greekMobileRule`). Error messages and the selector
are translated through Transloco (`el`/`en` shipped); country names localize via
`Intl.DisplayNames`.

## Accessibility

- Name the input with an associated `<label for>` (via `inputId`),
  `ariaLabelledby`, or `ariaLabel`. With none of these, a translated generic
  "Phone number" name is applied, so the field is never unlabelled.
- `required` is exposed as **`aria-required`**, never the native attribute: the
  native one blocks the submit event outright and raises an OS-locale bubble
  over the translated message this control already renders. Submit through
  Signal Forms' `submit()`, which marks the form touched so errors surface.
- The error id is **appended** to your `ariaDescribedby`, never substituted for
  it, so a hint of your own survives.
- Errors show only once the field is touched (or blurred) **and** the lazy
  plugin has initialized.
- A `forced-colors` block re-states focus, the invalid border (as a dashed
  edge — the state also carries as error text) and the highlighted country row,
  which a forced palette would otherwise drop.

## Running unit tests

Run `nx test shared-ui-phone-input` to execute the unit tests.

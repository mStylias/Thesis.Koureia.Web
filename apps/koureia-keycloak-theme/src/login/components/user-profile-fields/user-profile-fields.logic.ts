interface NamedField {
  readonly attribute: { readonly name: string };
}

interface HideableAttribute {
  readonly name: string;
  readonly annotations: { readonly inputType?: string };
}

/**
 * Fields the form submits but never shows. `password-confirm` is dropped because the password
 * component confirms in place. The register page reads this too, so that a message about a field
 * nobody can see is never treated as one the person has already been shown.
 */
export function isHiddenField(attribute: HideableAttribute): boolean {
  return attribute.annotations.inputType === 'hidden' || attribute.name === 'password-confirm';
}

interface LengthConstrainedAttribute {
  readonly annotations: { readonly inputTypeMaxlength?: string | number };
  readonly validators: { readonly length?: { readonly max?: string | number } };
}

/**
 * The `maxlength` for a field, from the user profile rather than from a constant here. The
 * `inputTypeMaxlength` annotation wins because it exists to say what the input accepts, while the
 * `length` validator says what the server stores. Null when the profile constrains neither.
 */
export function maxLengthOf(attribute: LengthConstrainedAttribute): number | null {
  return (
    toPositiveInteger(attribute.annotations.inputTypeMaxlength) ??
    toPositiveInteger(attribute.validators.length?.max)
  );
}

function toPositiveInteger(value: string | number | undefined): number | null {
  if (value === undefined) return null;

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

interface FieldWithErrorSources {
  readonly displayableErrors: readonly {
    readonly source: { readonly type: string };
  }[];
}

interface ProfileErrorVisibility {
  readonly submitAttempted: boolean;
  readonly fields: readonly FieldWithErrorSources[];
  /** An error the profile fields do not carry, such as a rejected terms checkbox. */
  readonly hasOtherServerError: boolean;
}

/**
 * Whether the profile fields may show their errors yet.
 *
 * A field validates as it is typed, so on a form nobody has submitted this would mark every
 * required field red before the first keystroke reached it. Errors the server sent back are
 * different: the person already submitted, and the page reloaded to report them.
 */
export function shouldShowProfileErrors({
  submitAttempted,
  fields,
  hasOtherServerError,
}: ProfileErrorVisibility): boolean {
  const hasServerFieldError = fields.some((field) =>
    field.displayableErrors.some((error) => error.source.type === 'server'),
  );

  return submitAttempted || hasServerFieldError || hasOtherServerError;
}

interface FieldErrorLookup {
  existsError(field: string): boolean;
}

/**
 * Whether the banner above the form says anything the fields do not.
 *
 * Keycloak joins every validation error into one summary, so two empty names arrive as "Please
 * specify this field. Please specify this field." and a taken address as "Email already exists.
 * Username already exists." — the second half meaningless in a realm that registers the email as
 * the username. Each error is also attached to its field, where these forms already render it next
 * to the input that caused it. The banner therefore earns its place only when it reports something
 * no visible field does: a reCAPTCHA refusal, an expired form, a failure with no field to blame.
 */
export function shouldShowGlobalMessage(
  visibleFieldNames: readonly string[],
  messagesPerField: FieldErrorLookup,
): boolean {
  return !visibleFieldNames.some((name) => messagesPerField.existsError(name));
}

export interface ProfileFieldGroups<TField> {
  readonly nameFields: readonly TField[];
  readonly otherFields: readonly TField[];
}

// Row order, which is not the order Keycloak sends the user profile in.
const NAME_FIELD_ORDER = ['firstName', 'lastName'];

/**
 * Splits the user profile into the first-name/last-name row and everything else. The row comes
 * first and keeps `NAME_FIELD_ORDER`, whatever order the user profile declares. A name field the
 * page renders as a hidden input stays with `otherFields` so that the row never holds an empty
 * cell, and the value is still submitted.
 */
export function groupProfileFields<TField extends NamedField>(
  fields: readonly TField[],
  isHidden: (field: TField) => boolean,
): ProfileFieldGroups<TField> {
  const nameFields = NAME_FIELD_ORDER.map((name) =>
    fields.find((field) => field.attribute.name === name && !isHidden(field)),
  ).filter((field): field is TField => field !== undefined);

  const otherFields = fields.filter((field) => !nameFields.includes(field));

  return { nameFields, otherFields };
}

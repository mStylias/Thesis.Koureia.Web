export default {
  // The message a field falls back to when its spec declares no key of its own. Keyed by the
  // error's `kind`, so a validator needs no copy to report something a user can act on.
  errors: {
    required: 'This is required',
    email: 'Enter a valid email address',
    minLength: 'Use at least {{minLength}} characters',
    maxLength: 'Use at most {{maxLength}} characters',
    min: 'Enter {{min}} or more',
    max: 'Enter {{max}} or less',
    minDate: 'Choose a later date',
    maxDate: 'Choose an earlier date',
    pattern: 'This is not in the expected format',
    // Signal Forms reports a value the input itself could not parse, such as letters in a
    // number field, under this kind.
    parse: 'This value cannot be read',
  },
  empty: '—',
};

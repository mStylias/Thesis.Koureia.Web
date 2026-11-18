import type { Translation } from '@jsverse/transloco';

/** Keys are unprefixed: Transloco puts the `themeToggle` scope in front of them. */
const el: Translation = {
  /**
   * Stable under both states, deliberately: whether dark is on rides on `aria-pressed`, so
   * a screen reader is never told the control renamed itself mid-interaction.
   */
  label: 'Σκούρο θέμα',
};

export default el;

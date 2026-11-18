import { Component, input } from '@angular/core';
import { AppLanguage } from '@util/language';

/**
 * The flag standing in for a language in the switcher.
 *
 * The colors are literals. Every other color in this workspace is a semantic token, because a
 * color that does not re-theme with the brand breaks for the second tenant. A national flag is
 * the exception: it is not a design decision, it has no light and dark variant, and a flag
 * that re-themes is no longer that flag. `check-tokens.mjs` exempts this directory by name.
 *
 * The flags are drawn and not loaded as an asset. At 20px an `<img>` costs a request and a
 * layout shift to draw four rectangles, and an inline `<svg>` takes its border radius and ring
 * from the surrounding tokens.
 *
 * The `<svg>` is `aria-hidden`. It is decoration beside a language name that is already read
 * out, and a flag names a country and not a language. Greek is spoken outside Greece and
 * English outside the United States, so announcing the flag announces the wrong noun.
 */
@Component({
  selector: 'lib-language-flag',
  template: `
    @switch (language()) {
      @case ('el') {
        <svg viewBox="0 0 27 18" aria-hidden="true" focusable="false">
          <rect width="27" height="18" fill="#0D5EAF" />
          <g fill="#FFFFFF">
            <rect y="2" width="27" height="2" />
            <rect y="6" width="27" height="2" />
            <rect y="10" width="27" height="2" />
            <rect y="14" width="27" height="2" />
          </g>
          <rect width="10" height="10" fill="#0D5EAF" />
          <g fill="#FFFFFF">
            <rect x="4" width="2" height="10" />
            <rect y="4" width="10" height="2" />
          </g>
        </svg>
      }
      @case ('en') {
        <svg viewBox="0 0 27 18" aria-hidden="true" focusable="false">
          <rect width="27" height="18" fill="#B22234" />
          <g fill="#FFFFFF">
            <rect y="1.4" width="27" height="1.4" />
            <rect y="4.2" width="27" height="1.4" />
            <rect y="7" width="27" height="1.4" />
            <rect y="9.8" width="27" height="1.4" />
            <rect y="12.6" width="27" height="1.4" />
            <rect y="15.4" width="27" height="1.4" />
          </g>
          <rect width="11" height="9.8" fill="#3C3B6E" />
          <!--
            Nine stars and not fifty. At this size fifty stars are a blue smudge. A sparse grid
            reads as stars and keeps the canton legible.
          -->
          <g fill="#FFFFFF">
            <circle cx="2.2" cy="2" r="0.7" />
            <circle cx="5.5" cy="2" r="0.7" />
            <circle cx="8.8" cy="2" r="0.7" />
            <circle cx="2.2" cy="4.9" r="0.7" />
            <circle cx="5.5" cy="4.9" r="0.7" />
            <circle cx="8.8" cy="4.9" r="0.7" />
            <circle cx="2.2" cy="7.8" r="0.7" />
            <circle cx="5.5" cy="7.8" r="0.7" />
            <circle cx="8.8" cy="7.8" r="0.7" />
          </g>
        </svg>
      }
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
    }

    svg {
      display: block;
      inline-size: var(--language-flag-size, 1.25rem);
      block-size: auto;
      /*
       * Square corners. A radius clips the canton, and the corner is where both flags carry
       * their identifying mark.
       *
       * Keep the hairline ring. Both flags have white at an edge and bleed into a light
       * surface without it.
       */
      box-shadow: inset 0 0 0 var(--border-width-hairline) var(--border);
    }
  `,
})
export class LanguageFlag {
  /** Which flag to draw. */
  readonly language = input.required<AppLanguage>();
}

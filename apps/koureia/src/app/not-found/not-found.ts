import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Button } from '@ui/button';
import { LangLink } from '@util/language';

/**
 * Where an unpublished address lands.
 *
 * It exists because of the language prefix: `canMatch` refuses an unknown first segment so `/foo`
 * cannot pass as a language, and something must answer what falls through. It sits at the root as
 * well as inside `:lang`, so a bad address is a 404 with or without a language.
 *
 * This is also where a missed `[langLink]` shows up. An unprefixed target arrives here instead of
 * bouncing through negotiation to a plausible page.
 */
@Component({
  selector: 'app-not-found',
  imports: [Button, LangLink, TranslocoPipe],
  template: `
    <main class="not-found">
      <p class="not-found__code">404</p>
      <h1>{{ 'notFound.title' | transloco }}</h1>
      <p class="not-found__lead">{{ 'notFound.lead' | transloco }}</p>
      <a libButton langLink="/">{{ 'notFound.home' | transloco }}</a>
    </main>
  `,
  styles: `
    .not-found {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-4);
      min-block-size: 100dvh;
      padding: var(--space-8);
      text-align: center;
    }

    .not-found__code {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      letter-spacing: 0.2em;
      color: var(--text-muted);
    }

    .not-found__lead {
      max-inline-size: 42ch;
      color: var(--text-muted);
    }
  `,
})
export class NotFound {}

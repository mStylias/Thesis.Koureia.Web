import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'kc-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="no-context">
      <h1>Keycloak context is not available</h1>
      <p>Run the theme through Keycloakify to preview an authentication page.</p>
    </main>
  `,
  styles: `
    :host {
      display: grid;
      min-height: 100dvh;
      place-items: center;
    }

    .no-context {
      max-width: 38rem;
      padding: var(--space-8);
      text-align: center;
    }
  `,
})
export class NoContextComponent {}

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Vitest builds the component without its styles, so the guard reads the stylesheet.
const STYLES = readFileSync(join(process.cwd(), 'src/toast.scss'), 'utf8');

describe('Toast styles', () => {
  it('draws the icon in the text tone, so it passes AA on the toast surface', () => {
    expect(STYLES).toMatch(/\.toast-icon \{[^}]*color: var\(--toast-icon\);/);
    for (const tone of ['success', 'info', 'warning', 'error']) {
      expect(STYLES).toMatch(
        new RegExp(
          `:host\\(\\[data-severity='${tone}'\\]\\) \\{[^}]*--toast-icon: var\\(--${tone}-text\\);`,
        ),
      );
    }
  });
});

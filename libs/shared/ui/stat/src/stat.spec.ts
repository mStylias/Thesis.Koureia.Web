import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { readFileSync } from 'node:fs';

import { Stat } from './stat';
import { StatGroup } from './stat-group';

@Component({
  imports: [Stat, StatGroup],
  template: `
    <lib-stat-group aria-label="Figures">
      <lib-stat [value]="completed()" label="Completed" />
      <lib-stat class="rating" value="4.0" label="1 review"><span class="star">★</span></lib-stat>
    </lib-stat-group>
    <lib-stat class="alone" [value]="7" label="Alone" />
    <lib-stat class="first" labelFirst value="4.853 €" label="Revenue" />
  `,
})
class Host {
  readonly completed = signal(12);
}

function query(root: HTMLElement, selector: string): HTMLElement {
  const found = root.querySelector(selector);
  if (!(found instanceof HTMLElement)) throw new Error(`${selector} not rendered`);
  return found;
}

async function render(): Promise<ComponentFixture<Host>> {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('Stat', () => {
  it('renders the value over the label, and follows the value', async () => {
    const fixture = await render();
    const first = query(fixture.nativeElement as HTMLElement, 'lib-stat');
    expect(query(first, '.stat-value').textContent.trim()).toBe('12');
    expect(query(first, '.stat-label').textContent.trim()).toBe('Completed');

    fixture.componentInstance.completed.set(13);
    fixture.detectChanges();
    expect(query(first, '.stat-value').textContent.trim()).toBe('13');
  });

  it('projects content after the value', async () => {
    const fixture = await render();
    const rating = query(fixture.nativeElement as HTMLElement, 'lib-stat.rating');
    expect(query(rating, '.stat-value .star').textContent).toBe('★');
  });

  it('is a list item inside a group, and has no role alone', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    expect(query(root, 'lib-stat-group').getAttribute('role')).toBe('list');
    expect(query(root, 'lib-stat-group lib-stat').getAttribute('role')).toBe('listitem');
    expect(query(root, 'lib-stat.alone').hasAttribute('role')).toBe(false);
  });

  it('marks the label-first layout on the host, and leaves the default unmarked', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    expect(query(root, 'lib-stat.first').getAttribute('data-label-first')).toBe('');
    expect(query(root, 'lib-stat.alone').hasAttribute('data-label-first')).toBe(false);
  });
});

// Vitest builds the component without its styles, so the spec reads the stylesheet.
describe('Stat styles', () => {
  const styles = readFileSync('src/stat.scss', 'utf8');

  it('lets the consumer size the value, with the extra large text as the default', () => {
    const value = styles.slice(styles.indexOf('.stat-value {'));
    expect(value.slice(0, value.indexOf('}'))).toContain(
      'font-size: var(--stat-value-size, var(--text-xl));',
    );
    // A declaration here would beat the one a consumer sets on the host.
    expect(styles).not.toMatch(/--stat-value-size\s*:/);
  });

  it('keeps the words of the label whole', () => {
    const label = /\.stat-label \{([^}]*)\}/.exec(styles)?.[1] ?? '';
    expect(label).toContain('overflow-wrap: break-word;');
    // `anywhere` breaks a word in the middle when the line is short.
    expect(styles).not.toMatch(/overflow-wrap: anywhere|word-break|hyphens: auto/);
  });

  it('moves the label above the value in the label-first layout', () => {
    expect(styles).toMatch(/:host\(\[data-label-first\]\) \.stat-label \{\s*order: -1;/);
  });
});

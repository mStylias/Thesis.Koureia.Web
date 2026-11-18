import { Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { LucideBan, LucidePencil, LucideTrash2 } from '@lucide/angular';
import { provideUiCopy } from '@util/ui-copy';
import { firstValueFrom } from 'rxjs';

import { DrawerActions } from './drawer-actions';
import type { DrawerAction } from './drawer-actions.types';

@Component({
  imports: [DrawerActions],
  template: `
    <lib-drawer-actions [actions]="actions()" [paused]="paused()" aria-label="Actions">
      <button type="button" class="end-button">Edit</button>
    </lib-drawer-actions>
  `,
})
class Host {
  readonly ran: string[] = [];
  readonly paused = signal(false);
  readonly actions = signal<readonly DrawerAction[]>([
    this.action('book', 'Book again', { severity: 'primary', variant: 'filled' }),
    this.action('deactivate', 'Deactivate'),
    this.action('delete', 'Delete', { severity: 'error', variant: 'text' }),
  ]);

  action(id: string, label: string, extra: Partial<DrawerAction> = {}): DrawerAction {
    return {
      id,
      label,
      icon: id === 'delete' ? LucideTrash2 : id === 'book' ? LucidePencil : LucideBan,
      run: () => {
        this.ran.push(id);
      },
      ...extra,
    };
  }
}

describe('DrawerActions', () => {
  let fixture: ComponentFixture<Host>;

  function root(): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      'lib-drawer-actions',
    );
    if (element === null) throw new Error('drawer actions not rendered');
    return element;
  }

  /** The buttons on the line, not the hidden ones the fit measures. */
  function lineButtons(): HTMLButtonElement[] {
    return [...root().querySelectorAll<HTMLButtonElement>('.drawer-actions-start button')];
  }

  function names(): string[] {
    return lineButtons().map(
      (button) => button.getAttribute('aria-label') ?? button.textContent.trim(),
    );
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function render(): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['en'], defaultLang: 'en' },
        }),
        provideUiCopy({}),
      ],
    });
    fixture = TestBed.createComponent(Host);
    await settle();
    await firstValueFrom(TestBed.inject(TranslocoService).load('drawer/en'));
    await settle();
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is a toolbar that keeps every caption before it is measured, and the end slot apart', async () => {
    await render();

    expect(root().getAttribute('role')).toBe('toolbar');
    expect(names()).toEqual(['Book again', 'Deactivate', 'Delete']);
    expect(root().querySelector('.drawer-actions-end .end-button')).not.toBeNull();
    expect(root().querySelector('.drawer-actions-measure')?.closest('[inert]')).not.toBeNull();
  });

  it('gives up captions from the end, then moves icons into ⋮ with Delete in red', async () => {
    // Captions of 100, icons of 40, an end slot of 60 and no gap. On a line of 250, Book again
    // keeps its caption and the other two are icons: 100 + 40 + 40 + 60 = 240.
    let available = 250;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const width = this.matches('lib-drawer-actions')
        ? available
        : this.matches('.drawer-actions-end')
          ? 60
          : this.matches('[data-measure-icon]')
            ? 40
            : this.matches('[data-measure]')
              ? 100
              : 0;
      return { width } as DOMRect;
    });
    await render();

    expect(names()).toEqual(['Book again', 'Deactivate', 'Delete']);
    expect(lineButtons()[1]?.hasAttribute('data-icon-only')).toBe(true);
    expect(lineButtons()[2]?.hasAttribute('data-icon-only')).toBe(true);

    // 40 + 40 + ⋮ 40 + 60 = 180 does not fit in 150. One icon, the ⋮ and the end do.
    available = 150;
    fixture.componentInstance.actions.update((actions) => [...actions]);
    await settle();

    expect(names()).toEqual(['Book again', 'More actions']);
    lineButtons()[1]?.dispatchEvent(new Event('pointerdown'));
    lineButtons()[1]?.click();
    await settle();
    const rows = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    expect(rows.map((row) => row.textContent.trim())).toEqual(['Deactivate', 'Delete']);
    expect(rows.map((row) => row.hasAttribute('data-danger'))).toEqual([false, true]);

    rows[1]?.click();
    expect(fixture.componentInstance.ran).toEqual(['delete']);
  });

  it('pauses without changing how any button looks, while the panel loads the next record', async () => {
    await render();
    fixture.componentInstance.paused.set(true);
    await settle();

    expect(root().hasAttribute('inert')).toBe(true);
    expect(root().getAttribute('aria-busy')).toBe('true');
    expect(lineButtons().some((button) => button.disabled)).toBe(false);

    fixture.componentInstance.paused.set(false);
    await settle();
    expect(root().hasAttribute('inert')).toBe(false);
  });
});

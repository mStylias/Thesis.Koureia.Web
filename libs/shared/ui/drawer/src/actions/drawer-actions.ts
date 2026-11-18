import {
  booleanAttribute,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon, LucideEllipsisVertical } from '@lucide/angular';
import { Button, ButtonIcon } from '@ui/button';
import { Menu, MenuTrigger, type MenuItem } from '@ui/menu';
import { Tooltip } from '@ui/tooltip';
import { UiCopyPipe } from '@util/ui-copy';

import { drawerTranslocoScope } from '../drawer.i18n';
import { fitDrawerActions } from './drawer-actions-fit';
import type { DrawerAction, DrawerActionMode } from './drawer-actions.types';

/**
 * A drawer toolbar: a group of actions at the start, and the projected end slot.
 *
 * The end slot holds what the drawer is for, such as Edit, or Cancel and Save. It never moves
 * into the menu. When the line is short, the group gives up space from its last action: first
 * the captions, one at a time, then the icon buttons into a ⋮ menu.
 *
 * ```html
 * <lib-drawer-actions libDrawerToolbar [actions]="actions()" aria-label="Actions">
 *   <button libButton variant="outlined" (click)="edit()">Edit</button>
 * </lib-drawer-actions>
 * ```
 */
@Component({
  selector: 'lib-drawer-actions',
  imports: [
    Button,
    ButtonIcon,
    LucideDynamicIcon,
    LucideEllipsisVertical,
    Menu,
    MenuTrigger,
    RouterLink,
    Tooltip,
    TranslocoPipe,
    UiCopyPipe,
  ],
  providers: [provideTranslocoScope(drawerTranslocoScope)],
  templateUrl: './drawer-actions.html',
  styleUrl: './drawer-actions.scss',
  host: {
    role: 'toolbar',
    // `inert` keeps every button as it looks. A disabled look would flash for the length of a load.
    '[attr.inert]': 'paused() ? "" : null',
    '[attr.aria-busy]': 'paused() ? "true" : null',
  },
})
export class DrawerActions {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The group at the start, in order. The last ones give up space first. */
  readonly actions = input<readonly DrawerAction[]>([]);

  /** Overrides the translated name of the ⋮ button. */
  readonly moreAriaLabel = input('');

  /**
   * Ignores every press and keeps every button as it looks, as while the panel loads the next
   * record. The end slot pauses too.
   */
  readonly paused = input(false, { transform: booleanAttribute });

  private readonly endSlot = viewChild.required<ElementRef<HTMLElement>>('end');
  private readonly measureRow = viewChild.required<ElementRef<HTMLElement>>('measure');

  protected readonly barActions = computed(() =>
    this.actions().filter((action) => action.menuOnly !== true),
  );

  /** The fit's answer per action id. An action it has not seen yet keeps its caption. */
  private readonly fitted = signal<ReadonlyMap<string, DrawerActionMode>>(new Map());

  protected readonly menuItems = computed<readonly MenuItem[]>(() =>
    this.actions()
      .filter((action) => action.menuOnly === true || this.modeOf(action) === 'menu')
      .map((action) => ({
        label: action.label,
        icon: action.icon,
        disabled: action.disabled === true || action.loading === true,
        danger: action.severity === 'error',
        ...(action.link === undefined
          ? {
              command: () => {
                action.run?.();
              },
            }
          : { routerLink: action.link }),
      })),
  );

  protected readonly menuDisabled = computed(() =>
    this.menuItems().every((item) => item.disabled === true),
  );

  /**
   * Changes when the line, the end slot or a caption changes size. A caption grows or shrinks
   * after the first render when its translation or its font arrives.
   */
  private readonly layoutChange = signal(0);

  constructor() {
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            this.layoutChange.update((count) => count + 1);
          });
    afterNextRender(() => {
      observer?.observe(this.host.nativeElement);
      observer?.observe(this.endSlot().nativeElement);
      observer?.observe(this.measureRow().nativeElement);
    });
    inject(DestroyRef).onDestroy(() => {
      observer?.disconnect();
    });
    // Measure after the render. The measurement is untracked, so a new answer cannot trigger it.
    afterRenderEffect(() => {
      this.layoutChange();
      this.barActions();
      untracked(() => {
        this.fit();
      });
    });
  }

  protected modeOf(action: DrawerAction): DrawerActionMode {
    return this.fitted().get(action.id) ?? (action.iconOnly === true ? 'icon' : 'label');
  }

  /**
   * Reads every width from the hidden row, which always draws every caption. A collapsed
   * action can then come back without being drawn first.
   */
  private fit(): void {
    const host = this.host.nativeElement;
    const row = this.measureRow().nativeElement;
    const bar = this.barActions();
    const modes = fitDrawerActions({
      available: widthOf(host),
      gap: Number.parseFloat(getComputedStyle(host).columnGap) || 0,
      end: widthOf(this.endSlot().nativeElement),
      icon: widthOf(row.querySelector('[data-measure-icon]')),
      widths: [...row.querySelectorAll('[data-measure]')].map(widthOf),
      shrinkable: bar.map((action) => action.iconOnly !== true),
      menuRows: this.actions().some((action) => action.menuOnly === true),
    });
    const next = new Map(bar.map((action, index) => [action.id, modes[index] ?? 'label']));
    const current = this.fitted();
    const same =
      next.size === current.size && [...next].every(([id, mode]) => current.get(id) === mode);
    if (!same) this.fitted.set(next);
  }
}

function widthOf(element: Element | null): number {
  return element?.getBoundingClientRect().width ?? 0;
}

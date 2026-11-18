import { Component, input, model } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { LucideSearch } from '@lucide/angular';
import { IconField, InputIcon, InputText } from '@ui/input-text';
import { DATAGRID_TRANSLOCO_SCOPE } from '../datagrid.i18n';

/**
 * Global search over the grid's searchable columns (§7.2).
 *
 * A separate export rather than part of the shell, for the same reason as the
 * column chooser: a grid that offers no search must not carry the text field.
 * Drop it in a toolbar region and bind it to the grid's `search`.
 *
 * ```html
 * <lib-datagrid [columns]="columns" [data]="rows" key="id" [(search)]="search">
 *   <ng-template libDatagridToolbar="start">
 *     <lib-datagrid-search [(value)]="search" />
 *   </ng-template>
 * </lib-datagrid>
 * ```
 */
@Component({
  selector: 'lib-datagrid-search',
  template: `
    <div libIconField>
      <span libInputIcon><svg lucideSearch></svg></span>
      <input
        libInputText
        size="sm"
        type="search"
        [value]="value()"
        [attr.placeholder]="placeholder() || ('datagrid.search.placeholder' | uiCopy | transloco)"
        [attr.aria-label]="ariaLabel() || ('datagrid.search.label' | uiCopy | transloco)"
        (input)="onInput($event)"
      />
    </div>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
  imports: [TranslocoPipe, UiCopyPipe, IconField, InputIcon, InputText, LucideSearch],
  providers: [DATAGRID_TRANSLOCO_SCOPE],
})
export class DatagridSearch {
  /** The search term. Two-way: bind the grid's own `search` here. */
  readonly value = model('');

  /** Overrides the translated placeholder. */
  readonly placeholder = input('');

  /** Overrides the translated accessible name. */
  readonly ariaLabel = input('');

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }
}

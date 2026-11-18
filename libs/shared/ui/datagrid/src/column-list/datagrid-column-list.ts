import { Component, computed, input, model, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { LucideSearch } from '@lucide/angular';
import { Button } from '@ui/button';
import { Checkbox } from '@ui/checkbox';
import { IconField, InputIcon, InputText } from '@ui/input-text';
import { indexColumnBands } from '../core/column-bands';
import { DATAGRID_TRANSLOCO_SCOPE } from '../datagrid.i18n';
import type { ColumnDef } from '../core/types/column.types';
import type { ColumnChooserPresentation } from '../column-chooser/datagrid-column-chooser.types';
import type { ChooserBand, ChooserEntry, ChooserSection } from './datagrid-column-list.types';

/**
 * The chooser's body: a search field, the columns as checkboxes, and the
 * show-all and hide-all actions. One component for both surfaces the chooser
 * opens, so the popover and the floating panel cannot drift apart.
 */
@Component({
  selector: 'lib-datagrid-column-list',
  templateUrl: './datagrid-column-list.html',
  styleUrl: './datagrid-column-list.scss',
  imports: [
    TranslocoPipe,
    UiCopyPipe,
    Button,
    Checkbox,
    IconField,
    InputIcon,
    InputText,
    LucideSearch,
  ],
  providers: [DATAGRID_TRANSLOCO_SCOPE],
  host: {
    class: 'dg-chooser',
    '[attr.data-presentation]': 'presentation()',
  },
})
export class DatagridColumnList<TRow = unknown> {
  /** The same column definitions the grid renders. */
  readonly columns = input.required<readonly ColumnDef<TRow>[]>();

  /** Ids of the hidden columns. Two-way, shared with the chooser. */
  readonly hidden = model<readonly string[]>([]);

  /** The surface the list sits in. A popover caps its size, a panel fills the panel. */
  readonly presentation = input<ColumnChooserPresentation>('popover');

  protected readonly search = signal('');

  private readonly allEntries = computed<ChooserEntry[]>(() => {
    const hidden = new Set(this.hidden());
    const index = indexColumnBands(this.columns());
    return index.leaves.map((column) => ({
      id: column.id,
      caption: column.caption ?? column.field ?? column.id,
      visible: !hidden.has(column.id),
      hideable: column.allow?.hiding !== false,
      bands: (index.pathOf.get(column.id) ?? []).map((bandId) => {
        const band = index.bands.get(bandId);
        return { id: bandId, caption: band?.caption ?? band?.field ?? bandId };
      }),
    }));
  });

  protected readonly entries = computed<ChooserEntry[]>(() => {
    const needle = this.search().trim().toLocaleLowerCase();
    if (needle === '') {
      return this.allEntries();
    }
    // Leaf captions only. A band caption that matched would pull in columns
    // the user did not type a word of, which is not what a search does.
    return this.allEntries().filter((entry) => entry.caption.toLocaleLowerCase().includes(needle));
  });

  /**
   * The list broken into runs that share a band, so the headings say which
   * band each column belongs to. Two columns named "Name" in different bands
   * are otherwise the same row twice.
   */
  protected readonly sections = computed<ChooserSection[]>(() => {
    const sections: ChooserSection[] = [];
    let previous: readonly ChooserBand[] = [];
    for (const entry of this.entries()) {
      const key = entry.bands.map((band) => band.id).join('/');
      const last = sections.at(-1);
      if (last?.key === key) {
        last.entries = [...last.entries, entry];
        continue;
      }
      // Only the bands this run opens. The ones it shares with the run above
      // are already written, and repeating them would read as a second band
      // of the same name.
      let shared = 0;
      while (shared < entry.bands.length && entry.bands[shared].id === previous[shared]?.id) {
        shared += 1;
      }
      sections.push({
        key,
        depth: entry.bands.length,
        headings: entry.bands
          .slice(shared)
          .map((band, index) => ({ caption: band.caption, depth: shared + index })),
        entries: [entry],
      });
      previous = entry.bands;
    }
    return sections;
  });

  protected readonly empty = computed(() => this.entries().length === 0);

  protected onToggle(entry: ChooserEntry, visible: boolean): void {
    if (!entry.hideable) {
      return;
    }
    const next = new Set(this.hidden());
    if (visible) {
      next.delete(entry.id);
    } else {
      next.add(entry.id);
    }
    this.hidden.set([...next]);
  }

  /** Applies to the filtered list only, matching what the user can see. */
  protected onSetAll(visible: boolean): void {
    const next = new Set(this.hidden());
    for (const entry of this.entries()) {
      if (!entry.hideable) {
        continue;
      }
      if (visible) {
        next.delete(entry.id);
      } else {
        next.add(entry.id);
      }
    }
    this.hidden.set([...next]);
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }
}

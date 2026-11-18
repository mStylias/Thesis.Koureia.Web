import { Component, computed, input, numberAttribute, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { Button } from '@ui/button';
import { ProgressBar } from '@ui/progress';
import { DATAGRID_TRANSLOCO_SCOPE } from '../datagrid.i18n';

/**
 * The export progress strip (§15).
 *
 * A full-dataset export pages through a remote source, and §15 asks for
 * progress and cancellation. Both live here rather than in an event alone,
 * because cancelling has to be reachable by keyboard and an event gives a
 * keyboard user nothing to press.
 *
 * The count is carried as text beside the bar, so the state is never conveyed
 * by the fill alone. A source that reports no total leaves the bar
 * indeterminate and the text showing the rows fetched so far.
 */
@Component({
  selector: 'lib-datagrid-export-bar',
  templateUrl: './datagrid-export-bar.html',
  styleUrl: './datagrid-export-bar.scss',
  imports: [TranslocoPipe, UiCopyPipe, Button, ProgressBar],
  providers: [DATAGRID_TRANSLOCO_SCOPE],
  host: { class: 'dg-export-bar', role: 'status', '[attr.aria-busy]': "'true'" },
})
export class DatagridExportBar {
  /** Rows fetched so far. */
  readonly loaded = input(0, { transform: numberAttribute });

  /** Rows the source reports in total. `0` means it reported none. */
  readonly total = input(0, { transform: numberAttribute });

  /** The format being written, shown so a slow export names itself. */
  readonly format = input('');

  /** The user asked to stop. The grid abandons the fetch and writes nothing. */
  readonly canceled = output();

  /** A total of zero is "unknown", which is what leaves the bar indeterminate. */
  protected readonly determinate = computed(() => this.total() > 0);

  protected readonly percent = computed(() =>
    this.total() > 0 ? Math.min(100, (this.loaded() / this.total()) * 100) : 0,
  );

  /** Counts as text, so progress is never the fill alone. */
  protected readonly countParams = computed(() => ({
    loaded: this.loaded(),
    total: this.total(),
    format: this.format().toUpperCase(),
  }));
}

import { Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import {
  LucideCalendarRange,
  LucideDynamicIcon,
  LucideRotateCcw,
  type LucideIconInput,
} from '@lucide/angular';
import { Button } from '@ui/button';
import { ContextMenu } from '@ui/context-menu';
import type { MenuItem } from '@ui/menu';
import { DatePicker } from '@ui/date-picker';
import { DatetimePicker } from '@ui/datetime-picker';
import { InputNumber } from '@ui/input-number';
import { IconField, InputText } from '@ui/input-text';
import { PopoverTrigger } from '@ui/popover';
import { Select, type SelectOption } from '@ui/select';
import { toDateValue } from '../core/filter/date-filter';
import { filterOperatorLabelKey, relativeFilterLabelKey } from '../core/filter/operators';
import { filterOperationIcon } from './filter-operation-icons';
import type { DatagridFilterCell } from '../datagrid.types';
import type { RelativeDateFilter } from '../core/types/filter.types';
import type { DatagridFilterChange } from './datagrid-filter-row.types';
/** True for an editor value the query can use. */
function filled(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

/**
 * The inline filter editors under the header (§7.2).
 *
 * Its own `rowgroup` rather than a second row inside the header: the header
 * owns a roving tabindex over focusable `columnheader`s, and a row of editors
 * is a different focus model entirely — the editors are ordinary tab stops and
 * the cells around them are not focusable at all.
 *
 * The row holds no state. It renders the cells it is given and reports what
 * the user did; the grid owns the editor values and decides when they reach
 * the query, which is what makes deferred apply one branch instead of two
 * copies of the state.
 */
@Component({
  selector: 'lib-datagrid-filter-row',
  templateUrl: './datagrid-filter-row.html',
  styleUrl: './datagrid-filter-row.scss',
  imports: [
    TranslocoPipe,
    UiCopyPipe,
    Button,
    ContextMenu,
    DatePicker,
    DatetimePicker,
    IconField,
    InputNumber,
    InputText,
    PopoverTrigger,
    Select,
    LucideDynamicIcon,
  ],
  host: {
    role: 'rowgroup',
  },
})
export class DatagridFilterRow {
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly cells = input.required<readonly DatagridFilterCell[]>();

  /** 1-based `aria-rowindex` of the row, which follows the header row. */
  readonly ariaRowIndex = input(2);

  /**
   * Translates a key. The grid owns the Transloco scope, and the operator
   * menu builds its labels imperatively at open time — a user action, so the
   * scope has loaded by then.
   */
  readonly translate = input<(key: string, params?: Record<string, unknown>) => string>(
    (key) => key,
  );

  /** The user edited an editor. Not yet a commit: see {@link committed}. */
  readonly changed = output<DatagridFilterChange>();

  /**
   * The user finished with an editor — `Enter`, focus leaving it, or a choice
   * from the operator menu. Deferred apply waits for this.
   */
  readonly committed = output<{ columnId: string }>();

  /** The user picked a relative period, or `null` to drop the one in force. */
  readonly relativeSelected = output<{ columnId: string; preset: RelativeDateFilter | null }>();

  /**
   * The user cleared one column, from the editor's × or from the menu's Reset.
   * Distinct from an emptied editor: this also returns the column to its
   * default operator and drops any relative period.
   */
  readonly cleared = output<{ columnId: string }>();

  private readonly menuRef = viewChild<ContextMenu>('operatorMenu');

  protected readonly menuItems = signal<readonly MenuItem[]>([]);

  /** Cached so the select is not handed a fresh options array every pass. */
  private booleanOptions: { yes: string; no: string; options: SelectOption<boolean>[] } | null =
    null;

  protected operatorLabelKey(cell: DatagridFilterCell): string {
    return filterOperatorLabelKey(cell.op);
  }

  /** The glyph the chooser button draws, which reports the active operation. */
  protected operatorIcon(cell: DatagridFilterCell): LucideIconInput {
    return filterOperationIcon(cell.op);
  }

  protected relativeLabelKey(preset: RelativeDateFilter): string {
    return relativeFilterLabelKey(preset);
  }

  /** Whether the cell carries something, which the field's state reports. */
  protected hasValue(cell: DatagridFilterCell): boolean {
    if (cell.relative != null || cell.arity === 'none') {
      return true;
    }
    // A range holds either bound on its own, so an upper bound with no lower
    // one still counts as a filter the user can clear.
    return filled(cell.value) || (cell.arity === 'range' && filled(cell.valueEnd));
  }

  protected asText(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    // Only a primitive can be typed into a text editor; anything else came
    // from a node this row does not own, and printing `[object Object]` there
    // would be worse than showing nothing.
    return typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean'
      ? String(value)
      : '';
  }

  /** `null` is what `lib-input-number` shows as empty. */
  protected asNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  protected asDate(value: unknown): string {
    return toDateValue(value);
  }

  protected asDatetime(value: unknown): Date | null {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return new Date(value);
    }
    const day = toDateValue(value);
    if (!day) return null;
    const [year, month, date] = day.split('-').map(Number);
    return new Date(year, month - 1, date);
  }

  protected datetimeHasTime(value: unknown): boolean {
    return value instanceof Date;
  }

  protected onDatetimeModeChange(
    cell: DatagridFilterCell,
    enabled: boolean,
    pickerValue: Date | null,
    end: boolean,
  ): void {
    // The cell is from the previous render. Read the picker after its model change.
    if (pickerValue == null) return;
    this.onValue(cell, enabled ? pickerValue : toDateValue(pickerValue), end);
  }

  protected onDatetimeValueCommit(
    cell: DatagridFilterCell,
    value: Date | null,
    timeEnabled: boolean,
    end: boolean,
  ): void {
    this.onValueCommit(cell, timeEnabled ? value : toDateValue(value), end);
  }

  /** Both bounds of a range as one line, or empty when neither is set. */
  protected rangeLabel(cell: DatagridFilterCell): string {
    const from = this.boundText(cell.value);
    const to = this.boundText(cell.valueEnd);
    return from === '' && to === '' ? '' : `${from} – ${to}`;
  }

  private boundText(value: unknown): string {
    return value instanceof Date ? toDateValue(value) : this.asText(value);
  }

  protected asBoolean(value: unknown): boolean | undefined {
    return typeof value === 'boolean' ? value : undefined;
  }

  /** Stable identity, so `lib-select` diffs its options instead of rebuilding. */
  protected booleanOptionsFor(yes: string, no: string): readonly SelectOption<boolean>[] {
    if (this.booleanOptions?.yes !== yes || this.booleanOptions.no !== no) {
      this.booleanOptions = {
        yes,
        no,
        options: [
          { label: yes, value: true },
          { label: no, value: false },
        ],
      };
    }
    return this.booleanOptions.options;
  }

  protected onTextInput(cell: DatagridFilterCell, event: Event, end: boolean): void {
    this.emitValue(cell, (event.target as HTMLInputElement).value, end);
  }

  protected onValue(cell: DatagridFilterCell, value: unknown, end: boolean): void {
    this.emitValue(cell, value, end);
  }

  /** A picker or a select settles on one choice, so it commits as it changes. */
  protected onValueCommit(cell: DatagridFilterCell, value: unknown, end: boolean): void {
    this.emitValue(cell, value, end);
    this.committed.emit({ columnId: cell.columnId });
  }

  protected onCommit(cell: DatagridFilterCell): void {
    this.committed.emit({ columnId: cell.columnId });
  }

  protected onReset(cell: DatagridFilterCell): void {
    this.cleared.emit({ columnId: cell.columnId });
  }

  /**
   * `Escape` in an editor clears the column.
   *
   * Stopped from propagating only when it does something. The grid sits inside
   * dialogs, and swallowing the key on an already-empty cell would trap the
   * user in one.
   */
  protected onEditorEscape(cell: DatagridFilterCell, event: Event): void {
    if (!this.hasValue(cell)) {
      return;
    }
    event.stopPropagation();
    this.cleared.emit({ columnId: cell.columnId });
  }

  private emitValue(cell: DatagridFilterCell, value: unknown, end: boolean): void {
    this.changed.emit({
      columnId: cell.columnId,
      op: cell.op,
      value: end ? cell.value : value,
      valueEnd: end ? value : cell.valueEnd,
    });
  }

  /**
   * Opens the operator chooser, and the relative periods with it on a date
   * column. Both write the same column filter, so they belong in one menu:
   * §7.4 makes the last explicit action the winner, and a single list is what
   * makes that legible.
   */
  protected openOperators(cell: DatagridFilterCell, event: MouseEvent): void {
    const menu = this.menuRef();
    const anchor = (event.currentTarget as HTMLElement | null) ?? null;
    if (menu === undefined || anchor == null) {
      return;
    }
    this.menuItems.set(this.buildMenuItems(cell));
    menu.showAt(anchor, undefined, { focusFirstItem: true });
  }

  /**
   * The operator chooser's items.
   *
   * Every entry keeps its own glyph and the active one carries `checked`, so
   * the row is highlighted and announced as the selected `menuitemradio`. The
   * operators and the relative periods write the same column filter, so they
   * are one radio set: picking either clears the other.
   */
  private buildMenuItems(cell: DatagridFilterCell): MenuItem[] {
    const items: MenuItem[] = cell.operators.map((op) => ({
      label: this.translate()(filterOperatorLabelKey(op)),
      icon: filterOperationIcon(op),
      checked: op === cell.op && cell.relative == null,
      command: () => {
        this.changed.emit({
          columnId: cell.columnId,
          op,
          value: cell.value,
          valueEnd: cell.valueEnd,
        });
        this.committed.emit({ columnId: cell.columnId });
      },
    }));
    for (const preset of cell.relativePresets) {
      if (items.length === cell.operators.length) {
        items.push({ separator: true });
      }
      items.push({
        label: this.translate()(relativeFilterLabelKey(preset), { amount: preset.amount }),
        icon: LucideCalendarRange,
        checked:
          cell.relative?.direction === preset.direction &&
          cell.relative.amount === preset.amount &&
          cell.relative.unit === preset.unit,
        command: () => {
          this.relativeSelected.emit({ columnId: cell.columnId, preset });
        },
      });
    }
    // The way back to no filter at all. Without it a user who picked an
    // operator can empty the editor but not undo the choice.
    items.push(
      { separator: true },
      {
        label: this.translate()('datagrid.filterRow.reset'),
        icon: LucideRotateCcw,
        disabled: !this.hasValue(cell),
        command: () => {
          this.cleared.emit({ columnId: cell.columnId });
        },
      },
    );
    return items;
  }

  /** Moves focus to a column's editor, for the grid's keyboard entry point. */
  focusColumn(columnId: string): void {
    const cell = this.hostRef.nativeElement.querySelector<HTMLElement>(
      `[data-filter-cell][data-column="${CSS.escape(columnId)}"]`,
    );
    cell?.querySelector<HTMLElement>('input, button')?.focus();
  }
}

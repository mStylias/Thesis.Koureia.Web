import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import {
  LucideBrackets,
  LucideChevronDown,
  LucidePlus,
  LucideTriangleAlert,
  LucideX,
} from '@lucide/angular';
import { Button } from '@ui/button';
import { ContextMenu } from '@ui/context-menu';
import { DatePicker } from '@ui/date-picker';
import { DatetimePicker } from '@ui/datetime-picker';
import { InputNumber } from '@ui/input-number';
import { IconField, InputText } from '@ui/input-text';
import type { MenuItem } from '@ui/menu';
import { toDateValue } from '../core/filter/date-filter';
import {
  builderCondition,
  builderConditionCount,
  builderGroup,
  builderTreeFromNode,
  builderTreeToNode,
  defaultBuilderCondition,
  insertBuilderItem,
  removeBuilderItem,
  updateBuilderItem,
} from '../core/filter/filter-builder-model';
import type {
  BuilderConditionBuilder,
  BuilderConditionItem,
  BuilderGroupItem,
  BuilderItem,
} from '../core/filter/filter-builder-model.types';
import { filterOperatorArity, filterOperatorLabelKey } from '../core/filter/operators';
import { filterOperationIcon } from '../filter-row/filter-operation-icons';
import type { DatagridFilterEditor, DatagridFilterField } from '../datagrid.types';
import type { FilterNode, FilterOperator, FilterOperatorArity } from '../core/types/filter.types';
import type { GroupMode } from './datagrid-filter-builder.types';

const GROUP_MODES: readonly GroupMode[] = ['and', 'or', 'notAnd', 'notOr'];

/**
 * The full expression editor over the filter tree (§7.2).
 *
 * Nested groups, `and` / `or` / `not`, and a value editor typed by the field —
 * everything the row and the header filter cannot say, because each of those
 * owns one column and speaks one conjunction. The editor holds its own copy of
 * the tree and reports it once, on apply: an expression is assembled over
 * several edits, and a query per keystroke would make assembling one cost a
 * request per click.
 *
 * The host is the surface. `PopoverService` is headless — it positions and
 * dismisses — and the grid opens the editor through it for a reason the
 * browser decides: a modal `<dialog>` draws in the top layer, above every
 * overlay, so a date picker or a chooser opened from inside one paints behind
 * it. Nothing here knows about the popover; a host can place the editor
 * anywhere and drive it from `GridApi.getFilter()` / `setFilter()`.
 *
 * ```html
 * <lib-datagrid-filter-builder
 *   [fields]="fields()"
 *   [value]="api()?.getFilter() ?? null"
 *   (applied)="api()?.setFilter($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-datagrid-filter-builder',
  templateUrl: './datagrid-filter-builder.html',
  styleUrl: './datagrid-filter-builder.scss',
  imports: [
    NgTemplateOutlet,
    TranslocoPipe,
    UiCopyPipe,
    Button,
    ContextMenu,
    DatePicker,
    DatetimePicker,
    IconField,
    InputNumber,
    InputText,
    LucideBrackets,
    LucideChevronDown,
    LucidePlus,
    LucideTriangleAlert,
    LucideX,
  ],
  host: {
    role: 'dialog',
    tabindex: '-1',
    '[attr.aria-label]': 'builderLabel()',
  },
})
export class DatagridFilterBuilder {
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Fields a condition may target. A field list with no entry offers nothing. */
  readonly fields = input.required<readonly DatagridFilterField[]>();

  /**
   * The expression to edit. Read once per opening: the editor owns the tree
   * while it is open, so a query issued elsewhere does not rewrite what the
   * user is halfway through typing.
   */
  readonly value = input<FilterNode | null>(null);

  /**
   * Builds the node one condition contributes. The grid passes its own, which
   * routes through the column so a date widens to its day and a column's
   * `filterExpression` still decides.
   */
  readonly buildCondition = input<BuilderConditionBuilder>(defaultBuilderCondition);

  /**
   * Filters in force that this expression does not hold — the filter row's and
   * the header filter's per-column slots. Reported rather than merged: those
   * slots are their own surfaces, and applying an expression must not silently
   * drop what the user set elsewhere (§7.3).
   */
  readonly otherFilterCount = input(0);

  /**
   * Accessible name of the dialog. Supplied by the grid, which owns the
   * Transloco scope; everything drawn inside goes through the pipe here.
   */
  readonly builderLabel = input('');

  /**
   * Translates a key. The choosers build their menus imperatively at open
   * time, which is a user action, so the lazy scope has arrived by then.
   */
  readonly translate = input<(key: string, params?: Record<string, unknown>) => string>(
    (key) => key,
  );

  /** The expression the user applied, or `null` when it is empty. */
  readonly applied = output<FilterNode | null>();

  /** The user left without applying. */
  readonly canceled = output();

  /**
   * The editable tree. Reseeded whenever {@link value} changes, which is once
   * per opening — the editor is created fresh each time it opens.
   */
  protected readonly root = linkedSignal<FilterNode | null, BuilderGroupItem>({
    source: () => this.value(),
    computation: (node) => builderTreeFromNode(node),
  });

  protected readonly rootContext = computed(() => ({ group: this.root(), depth: 0 }));

  protected readonly empty = computed(() => builderConditionCount(this.root()) === 0);

  /** Rows the query will not receive, because their editor collected nothing. */
  protected readonly incompleteCount = computed(() =>
    countIncomplete(this.root(), this.buildCondition()),
  );

  private readonly fieldsByName = computed(
    () => new Map(this.fields().map((field) => [field.field, field])),
  );

  private readonly menuRef = viewChild<ContextMenu>('chooserMenu');

  protected readonly menuItems = signal<readonly MenuItem[]>([]);

  constructor() {
    // The editor is created on every opening, so focus has to travel into it
    // each time. The first chooser is where building an expression starts.
    afterNextRender(() => {
      this.hostRef.nativeElement.querySelector<HTMLElement>('button')?.focus();
    });
  }

  protected editorFor(item: BuilderConditionItem): DatagridFilterEditor {
    return this.fieldsByName().get(item.field)?.editor ?? 'text';
  }

  protected arityOf(item: BuilderConditionItem): FilterOperatorArity {
    return filterOperatorArity(item.op);
  }

  /** A row whose condition builds to nothing, which the query never sees. */
  protected isIncomplete(item: BuilderConditionItem): boolean {
    return this.buildCondition()(item) == null;
  }

  protected groupMode(group: BuilderGroupItem): GroupMode {
    if (group.op === 'and') {
      return group.negated ? 'notAnd' : 'and';
    }
    return group.negated ? 'notOr' : 'or';
  }

  protected groupModeLabel(group: BuilderGroupItem): string {
    return this.translate()(`datagrid.filterBuilder.mode.${this.groupMode(group)}`);
  }

  protected fieldLabel(item: BuilderConditionItem): string {
    return (
      this.fieldsByName().get(item.field)?.caption ??
      this.translate()('datagrid.filterBuilder.selectField')
    );
  }

  protected operatorLabel(item: BuilderConditionItem): string {
    return this.translate()(filterOperatorLabelKey(item.op));
  }

  protected booleanLabel(item: BuilderConditionItem): string {
    const value = this.asBoolean(item.value);
    if (value === undefined) {
      return this.translate()('datagrid.filterRow.anyBoolean');
    }
    return this.translate()(value ? 'datagrid.filterRow.true' : 'datagrid.filterRow.false');
  }

  protected conditionLabel(item: BuilderConditionItem): string {
    return this.translate()('datagrid.filterBuilder.condition', { field: this.fieldLabel(item) });
  }

  // --- Choosers ----------------------------------------------------------

  /**
   * Every chooser is a button plus this one menu, never a `lib-select`.
   *
   * A select draws its list inline, absolutely positioned inside its own host:
   * any scrolling ancestor clips it, and the list adds a scrollbar to whatever
   * contains the editor. A menu is an overlay — it paints over everything and
   * takes no space at all. It also lets the button shrink to its track, which
   * a select refuses to do below `--select-min-width`.
   */
  private openMenu(items: readonly MenuItem[], event: MouseEvent): void {
    const menu = this.menuRef();
    const anchor = (event.currentTarget as HTMLElement | null) ?? null;
    if (menu === undefined || anchor == null) {
      return;
    }
    this.menuItems.set(items);
    menu.showAt(anchor, undefined, { focusFirstItem: true });
  }

  protected openGroupMenu(group: BuilderGroupItem, event: MouseEvent): void {
    const active = this.groupMode(group);
    this.openMenu(
      GROUP_MODES.map((mode) => ({
        label: this.translate()(`datagrid.filterBuilder.mode.${mode}`),
        checked: mode === active,
        command: () => {
          this.setGroupMode(group, mode);
        },
      })),
      event,
    );
  }

  protected openFieldMenu(item: BuilderConditionItem, event: MouseEvent): void {
    this.openMenu(
      this.fields().map((field) => ({
        label: field.caption,
        checked: field.field === item.field,
        command: () => {
          this.setField(item, field.field);
        },
      })),
      event,
    );
  }

  protected openOperatorMenu(item: BuilderConditionItem, event: MouseEvent): void {
    const operators = this.fieldsByName().get(item.field)?.operators ?? [];
    this.openMenu(
      operators.map((op) => ({
        label: this.translate()(filterOperatorLabelKey(op)),
        icon: filterOperationIcon(op),
        checked: op === item.op,
        command: () => {
          this.setOperator(item, op);
        },
      })),
      event,
    );
  }

  /** Yes / No / Any, the third being the way back to no value at all. */
  protected openBooleanMenu(item: BuilderConditionItem, event: MouseEvent): void {
    const current = this.asBoolean(item.value);
    const entries: { key: string; value: boolean | null }[] = [
      { key: 'datagrid.filterRow.true', value: true },
      { key: 'datagrid.filterRow.false', value: false },
      { key: 'datagrid.filterRow.anyBoolean', value: null },
    ];
    this.openMenu(
      entries.map((entry) => ({
        label: this.translate()(entry.key),
        checked: entry.value === (current ?? null),
        command: () => {
          this.onValue(item, entry.value, false);
        },
      })),
      event,
    );
  }

  // --- Editing -----------------------------------------------------------

  private setGroupMode(group: BuilderGroupItem, mode: GroupMode): void {
    this.patch(group.id, (item) =>
      item.kind === 'group'
        ? {
            ...item,
            op: mode === 'or' || mode === 'notOr' ? 'or' : 'and',
            negated: mode === 'notAnd' || mode === 'notOr',
          }
        : item,
    );
  }

  protected onAddCondition(group: BuilderGroupItem): void {
    // `at` rather than an index: an empty field list is a real state, and the
    // index signature does not admit it.
    const field = this.fields().at(0);
    this.root.update((root) =>
      insertBuilderItem(
        root,
        group.id,
        field === undefined
          ? builderCondition()
          : builderCondition(field.field, field.operators[0]),
      ),
    );
  }

  protected onAddGroup(group: BuilderGroupItem): void {
    this.root.update((root) => insertBuilderItem(root, group.id, builderGroup('or')));
  }

  protected onRemove(id: string): void {
    this.root.update((root) => removeBuilderItem(root, id));
  }

  /**
   * A new field brings its own operator set and its own editor, so an operator
   * the field does not offer falls back to its first and the collected value
   * is dropped — a date left in a number editor would filter on nothing.
   */
  private setField(item: BuilderConditionItem, field: string): void {
    const declared = this.fieldsByName().get(field);
    const operators = declared?.operators ?? [];
    const op = operators.includes(item.op) ? item.op : (operators[0] ?? item.op);
    const sameEditor = this.editorFor(item) === (declared?.editor ?? 'text');
    this.patch(item.id, (current) =>
      current.kind === 'condition'
        ? {
            ...current,
            field,
            op,
            value: sameEditor ? current.value : null,
            valueEnd: sameEditor ? current.valueEnd : null,
          }
        : current,
    );
  }

  /** Changing arity re-shapes the value, so what the editor drops is dropped. */
  private setOperator(item: BuilderConditionItem, op: FilterOperator): void {
    const keepEnd = filterOperatorArity(op) === 'range';
    this.patch(item.id, (current) =>
      current.kind === 'condition'
        ? { ...current, op, valueEnd: keepEnd ? current.valueEnd : null }
        : current,
    );
  }

  protected onValue(item: BuilderConditionItem, value: unknown, end: boolean): void {
    this.patch(item.id, (current) =>
      current.kind === 'condition'
        ? end
          ? { ...current, valueEnd: value }
          : { ...current, value }
        : current,
    );
  }

  protected onTextInput(item: BuilderConditionItem, event: Event, end: boolean): void {
    this.onValue(item, (event.target as HTMLInputElement).value, end);
  }

  /**
   * `in` and `notIn` take a list, and one comma-separated field is the editor
   * that fits a row of controls. A number field parses its members, so the
   * list a remote source receives holds numbers and not their text.
   */
  protected onListInput(item: BuilderConditionItem, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const numeric = this.editorFor(item) === 'number';
    const members = raw
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '')
      .map((entry) => (numeric ? Number(entry) : entry))
      .filter((entry) => typeof entry !== 'number' || Number.isFinite(entry));
    this.onValue(item, members, false);
  }

  protected onDatetimeValue(
    item: BuilderConditionItem,
    value: Date | null,
    timeEnabled: boolean,
    end: boolean,
  ): void {
    this.onValue(item, timeEnabled ? value : toDateValue(value), end);
  }

  /**
   * The picker writes its value and its mode in sequence, so the item this
   * handler was bound with is a render behind. Read the picker instead.
   */
  protected onDatetimeMode(
    item: BuilderConditionItem,
    enabled: boolean,
    pickerValue: Date | null,
    end: boolean,
  ): void {
    if (pickerValue == null) {
      return;
    }
    this.onValue(item, enabled ? pickerValue : toDateValue(pickerValue), end);
  }

  private patch(id: string, update: (item: BuilderItem) => BuilderItem): void {
    this.root.update((root) => updateBuilderItem(root, id, update));
  }

  // --- Value coercion ----------------------------------------------------

  protected asText(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    return typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean'
      ? String(value)
      : '';
  }

  protected asList(value: unknown): string {
    return Array.isArray(value) ? value.map((entry) => this.asText(entry)).join(', ') : '';
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
    if (day === '') {
      return null;
    }
    const [year, month, date] = day.split('-').map(Number);
    return new Date(year, month - 1, date);
  }

  protected datetimeHasTime(value: unknown): boolean {
    return value instanceof Date;
  }

  protected asBoolean(value: unknown): boolean | undefined {
    return typeof value === 'boolean' ? value : undefined;
  }

  // --- Commit ------------------------------------------------------------

  protected onApply(): void {
    this.applied.emit(builderTreeToNode(this.root(), this.buildCondition()));
  }

  protected onClear(): void {
    this.root.set(builderGroup());
  }

  protected onCancel(): void {
    this.canceled.emit();
  }
}

function countIncomplete(group: BuilderGroupItem, build: BuilderConditionBuilder): number {
  return group.children.reduce(
    (total, child) =>
      total +
      (child.kind === 'group' ? countIncomplete(child, build) : build(child) == null ? 1 : 0),
    0,
  );
}

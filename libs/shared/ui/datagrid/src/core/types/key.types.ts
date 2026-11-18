/**
 * Row identity contract.
 *
 * Every feature that references rows (selection, expansion, editing, focus,
 * scroll restoration) references them by key, never by index.
 *
 * The declarations live in `@ui/data-source`, which every data-bound control
 * shares. `GridKey` is the grid's name for `DataKey`; the rest keep their own
 * names because they already read correctly here.
 */
export type { KeySelector, KeySpec, KeySpecObject, KeyType } from '@ui/data-source';

/** Stable primitive identity of one row. */
export type { DataKey as GridKey } from '@ui/data-source';

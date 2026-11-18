import type { Signal } from '@angular/core';

/**
 * What a host asks of an editor that switches between view and edit: its toolbar shows Edit, or
 * Cancel and Save, and a close asks once for every editor with unsaved changes.
 */
export interface StaffTabEditor {
  /** The editor is in its form. */
  readonly editing: Signal<boolean>;
  /** A save is in flight. Only this can disable Save. */
  readonly submitting: Signal<boolean>;
  /** The caller can edit this member. */
  readonly canEdit: Signal<boolean>;
  /** The form differs from what was saved. */
  hasChanges(): boolean;
  edit(): void;
  save(): void;
  /** Back to view, dropping the form's changes. The host has already asked. */
  discard(): void;
}

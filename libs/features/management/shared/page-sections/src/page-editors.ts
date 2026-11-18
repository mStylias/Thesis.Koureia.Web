import { DestroyRef, inject, InjectionToken, Service } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { ConfirmationService } from '@ui/confirmation-dialog';

import type { PageSectionEditor, PageSectionsConfig } from './page-editors.types';

const K = 'managementPageSections.discard';

/** What the page tells its sections. `providePageSections` provides it. */
export const PAGE_SECTIONS_CONFIG = new InjectionToken<PageSectionsConfig>('PAGE_SECTIONS_CONFIG');

/**
 * The cards of a page that edit. A navigation away asks once for all of them.
 *
 * Provided by the page through `providePageSections`. A card registers with
 * {@link registerPageEditor}.
 */
@Service({ autoProvided: false })
export class PageEditors {
  private readonly confirmation = inject(ConfirmationService);
  private readonly transloco = inject(TranslocoService);
  private readonly config = inject(PAGE_SECTIONS_CONFIG);
  private readonly editors = new Set<PageSectionEditor>();

  /** Adds a card. The returned function removes it. */
  register(editor: PageSectionEditor): () => void {
    this.editors.add(editor);
    return () => this.editors.delete(editor);
  }

  hasChanges(): boolean {
    return [...this.editors].some((editor) => editor.hasChanges());
  }

  /** Whether the page can close: yes unless a card holds changes the person keeps. */
  async canLeave(): Promise<boolean> {
    const dirty = [...this.editors].filter((editor) => editor.hasChanges());
    if (dirty.length === 0) return true;

    const answer = await this.confirmation.open({
      title: this.transloco.translate(`${K}.title`),
      message: this.transloco.translate(this.config.discardMessage),
      confirmLabel: this.transloco.translate(`${K}.discard`),
      cancelLabel: this.transloco.translate(`${K}.keep`),
      severity: 'warning',
    });
    if (answer !== 'confirmed') return false;

    dirty.forEach((editor) => {
      editor.discard();
    });
    return true;
  }
}

/** Registers a card with the page's {@link PageEditors} for the card's lifetime. */
export function registerPageEditor(editor: PageSectionEditor): void {
  const unregister = inject(PageEditors).register(editor);
  inject(DestroyRef).onDestroy(unregister);
}

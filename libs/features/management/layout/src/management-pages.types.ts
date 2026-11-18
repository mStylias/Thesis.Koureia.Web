import type { LucideIconInput } from '@lucide/angular';

/** A management page: one sidebar option, one route, one heading, one permission. */
export interface ManagementPage {
  /** Path segment under `/management`, in English like every other slug in the app. */
  readonly path: string;

  /**
   * Transloco key of the page name. Read three times — the sidebar option, the top bar
   * heading and the browser tab — so the three cannot disagree.
   */
  readonly titleKey: string;

  /** Leading Lucide icon; the only thing visible in the collapsed rail. */
  readonly icon: LucideIconInput;

  /**
   * The API permission code the page needs. The sidebar hides the option without it and
   * `managementPageGuard` refuses the address.
   *
   * Required, so a new page cannot reach the sidebar without a decision about who sees it. A
   * page every staff role may open declares `services:read`, which every tenant system role
   * carries.
   */
  readonly permission: string;
}

/** A titled block of pages, drawn as one sidebar group. */
export interface ManagementSection {
  readonly headingKey: string;
  readonly pages: readonly ManagementPage[];
}

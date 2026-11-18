import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Service, inject } from '@angular/core';

import type { PendingAction, PendingActionRow } from './pending-action.types';

/**
 * What a flow was about to do when it sent the person to an auth screen.
 *
 * ```ts
 * actions.record({ kind: 'booking', title: 'Last step…', rows });
 * // …on the verify-email screen
 * const action = actions.peek();
 * ```
 *
 * It exists so an auth screen can say *why* the person is standing there without importing the
 * feature that sent them. The screen renders labelled rows; it never learns what a booking is.
 *
 * Two things follow from that:
 *
 * - **The copy is the writer's.** Rows arrive translated. An auth library cannot hold strings
 *   about services and barbers, and in Greek it could not interpolate them if it did.
 * - **It is not a source of truth.** It is what the person sees while they verify. The flow's
 *   own store still owns the selection, and this entry is cleared when the flow resumes.
 *
 * `localStorage`, because the round trip to Keycloak can outlive the tab. Every method is a
 * no-op or `null` outside the browser.
 */
@Service()
export class PendingActionStore {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Replaces any entry already recorded: one person, one thing in flight. */
  record(action: PendingAction): void {
    if (!this.isBrowser) return;

    try {
      localStorage.setItem(
        ACTION_KEY,
        JSON.stringify({ version: ACTION_VERSION, ...action, savedAt: Date.now() }),
      );
    } catch {
      // Private-mode quota refusal. The auth screen then says less, which is not a reason to
      // stop the person getting there.
    }
  }

  /** Reads without clearing. The screen that shows it is not the one that acts on it. */
  peek(): PendingAction | null {
    if (!this.isBrowser) return null;

    let raw: string | null;
    try {
      raw = localStorage.getItem(ACTION_KEY);
    } catch {
      return null;
    }
    if (raw === null) return null;

    const action = parseAction(raw);
    if (action === null) this.clear();
    return action;
  }

  clear(): void {
    if (!this.isBrowser) return;

    try {
      localStorage.removeItem(ACTION_KEY);
    } catch {
      // Nothing to do and nothing worth failing for.
    }
  }
}

/** Raise this whenever the stored shape changes. The reader checks it and drops an old entry. */
const ACTION_VERSION = 1;

const ACTION_KEY = 'koureia.pendingAction.v1';

/** An entry older than this is stale enough that showing it would confuse rather than reassure. */
const ACTION_MAX_AGE_MS = 6 * 60 * 60 * 1000;

function parseAction(raw: string): PendingAction | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;

  const entry = parsed as Record<string, unknown>;
  if (entry['version'] !== ACTION_VERSION) return null;
  if (typeof entry['kind'] !== 'string' || entry['kind'] === '') return null;
  if (typeof entry['title'] !== 'string') return null;

  const savedAt = entry['savedAt'];
  if (typeof savedAt !== 'number' || Date.now() - savedAt >= ACTION_MAX_AGE_MS) return null;

  const rows = entry['rows'];
  if (!Array.isArray(rows)) return null;

  const parsedRows: PendingActionRow[] = [];
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) return null;
    const candidate = row as Record<string, unknown>;
    if (typeof candidate['label'] !== 'string' || typeof candidate['value'] !== 'string') {
      return null;
    }
    parsedRows.push({ label: candidate['label'], value: candidate['value'] });
  }

  return { kind: entry['kind'], title: entry['title'], rows: parsedRows };
}

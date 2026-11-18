import type { CalendarPanel } from '@ui/calendar';

import { readSettings } from './calendar-settings';
import type { CalendarSettings } from './calendar.types';

/**
 * The panel left open beside the calendar, kept in `localStorage`.
 *
 * In the browser, not in `calendar_settings`: the calendar draws before the settings arrive, and
 * a panel that came with them slid in after the page was already on screen. A synchronous read
 * draws it open on the first frame. `/management` is client rendered, so no server render paints
 * it closed first.
 */
export function readKeptPanel(): CalendarPanel {
  try {
    const stored = localStorage.getItem(PANEL_KEY);
    return stored === 'filters' || stored === 'settings' ? stored : null;
  } catch {
    return null;
  }
}

/** A closed panel is stored as the absence of the key. */
export function writeKeptPanel(panel: CalendarPanel): void {
  try {
    if (panel === null) {
      localStorage.removeItem(PANEL_KEY);
    } else {
      localStorage.setItem(PANEL_KEY, panel);
    }
  } catch {
    // Private-mode quota refusal. The panel still opens, and only this page remembers it.
  }
}

/**
 * The settings this browser last showed, or `null`. A copy of `calendar_settings` and the
 * default saved view as applied, read before the first draw so the calendar does not draw the
 * default view and then switch. The server copy still lands on top.
 */
export function readKeptSettings(): CalendarSettings | null {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored === null ? null : readSettings(JSON.parse(stored));
  } catch {
    return null;
  }
}

export function writeKeptSettings(settings: CalendarSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Private-mode quota refusal. The server copy still holds the settings.
  }
}

const PANEL_KEY = 'management.calendar-panel';
const SETTINGS_KEY = 'management.calendar-settings';

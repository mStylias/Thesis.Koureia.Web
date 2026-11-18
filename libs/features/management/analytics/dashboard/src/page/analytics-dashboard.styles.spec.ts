import type { Translation } from '@jsverse/transloco';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { KpiId } from '../analytics.format.types';
import el from '../i18n/el';
import en from '../i18n/en';

// Vitest builds the component without its styles, so the guard reads the stylesheets.
const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');
const styles = read('src/page/analytics-dashboard.scss');
const tile = read('src/kpis/kpi-tile.scss');
const tileTemplate = read('src/kpis/kpi-tile.html');
const shell = read('../../layout/src/management-shell/management-shell.scss');
const scale = read('../../../../shared/styles/src/abstracts/_scale.scss');
const base = read('../../../../shared/styles/src/base/_base.scss');
const chartCard = read('src/charts/chart-card.scss');
const chartGrid = read('src/charts/chart-grid.scss');
const statuses = {
  el: read('../../shared/appointments/src/i18n/el.ts'),
  en: read('../../shared/appointments/src/i18n/en.ts'),
};

// The width of 123.456,70 € in em, from the advance widths of the bold sans face with tabular
// figures.
const FIGURE_EM = 4.876;
// The root size is a percent of the browser default of 16px.
const ROOT_PX = (16 * rem(base, /html \{\s*font-size: ([\d.]+)%;/)) / 100;
const PHONE_REM = 360 / ROOT_PX;
const DESKTOP_REM = 1440 / ROOT_PX;
// A classic scrollbar on Windows. The page scrolls inside the shell.
const SCROLLBAR_REM = 15 / ROOT_PX;

// The KPI labels in em of the regular sans face, from its advance widths. A new label needs its
// width here.
const LABEL_EM: ReadonlyMap<string, number> = new Map(
  Object.entries({
    Έσοδα: 2.589,
    Ραντεβού: 3.774,
    'Μέση αξία ραντεβού': 8.042,
    'Μοναδικοί πελάτες': 7.506,
    'Χαμένα ραντεβού': 6.943,
    'Μέση βαθμολογία': 7.097,
    Revenue: 3.387,
    Appointments: 5.63,
    'Average ticket': 5.542,
    'Unique customers': 7.059,
    'Lost appointments': 7.275,
    'Average rating': 5.709,
  }),
);
const KPIS: Readonly<Record<KpiId, true>> = {
  revenue: true,
  appointments: true,
  averageTicket: true,
  uniqueCustomers: true,
  lostRate: true,
  averageRating: true,
};

// The appointment status names in em of the regular sans face, from its advance widths. A new name
// needs its width here.
const STATUS_EM: ReadonlyMap<string, number> = new Map(
  Object.entries({
    Ολοκληρωμένο: 5.995,
    Επιβεβαιωμένο: 6.104,
    'Σε αναμονή': 4.54,
    Ακυρωμένο: 4.545,
    'Δεν ήρθε': 3.55,
    Completed: 4.326,
    Confirmed: 4.174,
    Pending: 3.26,
    Cancelled: 3.817,
    'No-show': 3.536,
  }),
);

// The widest changes in em of the bold sans face with tabular figures.
const CHANGE_EM = {
  '+12,5 μ.': 3.055,
  '+12.5 pts': 3.525,
  '+100%': 2.759,
};

function rem(source: string, pattern: RegExp): number {
  const found = pattern.exec(source)?.[1];
  if (found === undefined) throw new Error(`${pattern.source} not found`);
  return Number(found);
}

/** The declarations of the first top-level rule whose whole selector is `selector`. */
function rule(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Not the tail of a selector list, whose line before ends in a comma.
  const found = new RegExp(`(?<!,\\n)^${escaped} \\{([^}]*)\\}`, 'm').exec(source)?.[1];
  if (found === undefined) throw new Error(`${selector} not found`);
  return found;
}

const map = (name: string): string => scale.slice(scale.indexOf(`$${name}: (`));
const space = (step: number): number =>
  rem(map('spacing'), new RegExp(`\\n  ${String(step)}: ([\\d.]+)rem`));
const text = (size: string): number => rem(map('text'), new RegExp(`\\n  ${size}: ([\\d.]+)rem`));
const row = (columns: number): number =>
  rem(styles, new RegExp(`\\$kpi-row-${String(columns)}: ([\\d.]+)rem;`));
const step = (source: string, pattern: RegExp): number => rem(source, pattern);

// `padding: var(--space-B) var(--space-I);` on the tile: the block step, then the inline step.
const TILE_PADDING = /\.kpi-tile \{[^}]*padding: var\(--space-(\d+)\) var\(--space-(\d+)\);/;
const tileInline = (): number => space(Number(TILE_PADDING.exec(tile)?.[2]));
const rowGap = (): number => space(step(rule(styles, '.kpi-row'), /gap: var\(--space-(\d+)\);/));

/** The content width of one tile in a row of `columns` tiles. */
function content(rowWidth: number, columns: number): number {
  return (rowWidth - rowGap() * (columns - 1)) / columns - 2 * tileInline();
}

/** The width the figure needs, less the width it gets, on the narrowest tile of a row. */
function overflow(rowWidth: number, columns: number): number {
  const width = content(rowWidth, columns);
  const cqi = rem(tile, /clamp\(var\(--text-lg\), ([\d.]+)cqi, var\(--text-xl\)\)/);
  const size = Math.min(Math.max((width * cqi) / 100, text('lg')), text('xl'));
  return size * FIGURE_EM - width;
}

/** The row width on a phone: the shell pads it by 3 steps, the page by its inline step. */
function phoneRow(): number {
  const page = step(rule(styles, ':host'), /padding: var\(--space-\d+\) var\(--space-(\d+)\)/);
  return PHONE_REM - 2 * (space(3) + space(page));
}

/** The row width at 1440px with the sidebar open, less a classic scrollbar. */
function desktopRow(): number {
  const sidebar = rem(map('component-size'), /\n {2}sidebar-width: ([\d.]+)rem/);
  const pad = space(step(shell, /--management-content-pad: #\{a\.space\((\d+)\)\};/));
  const page = step(rule(styles, ':host'), /padding: var\(--space-\d+\) var\(--space-(\d+)\)/);
  return DESKTOP_REM - sidebar - 2 * (pad + space(page)) - SCROLLBAR_REM;
}

const foot = (): string => rule(tile, '.kpi-foot');
// `--kpi-change-width: calc(var(--icon-size-S) + var(--space-G) + Wem);`
const CHANGE_WIDTH =
  /--kpi-change-width: calc\(var\(--icon-size-(\w+)\) \+ var\(--space-(\d+)\) \+ ([\d.]+)em\);/;

/** The width the change reserves, in rem. */
function changeWidth(): number {
  const [, icon = '', gap = '', em = ''] = CHANGE_WIDTH.exec(foot()) ?? [];
  const iconRem = rem(map('icon-size'), new RegExp(`\\n  ${icon}: ([\\d.]+)rem`));
  return iconRem + space(Number(gap)) + Number(em) * text('sm');
}

/** The width the sparkline gets beside the change, in rem. */
function sparklineWidth(rowWidth: number, columns: number): number {
  const gap = space(step(foot(), /gap: var\(--space-(\d+)\);/));
  return content(rowWidth, columns) - changeWidth() - gap;
}

/** The status names of an appointments dictionary, in its order. */
function statusNames(source: string): string[] {
  const block = /\n {2}status: \{([^}]*)\}/.exec(source)?.[1] ?? '';
  return [...block.matchAll(/: '([^']+)'/g)].map((found) => found[1]);
}

/** The width of a legend of `names` on one line, in rem. */
function legendWidth(names: readonly string[]): number {
  const item = rule(chartCard, '.chart-legend-item');
  const pad = space(step(item, /padding: 0 var\(--space-(\d+)\);/));
  const gap = space(step(item, /gap: var\(--space-(\d+)\);/));
  const marker = space(
    step(rule(chartCard, '.chart-legend-marker'), /width: var\(--space-(\d+)\);/),
  );
  // The transparent hairline that forced colors draw.
  const border = 1 / ROOT_PX;
  return names.reduce((sum, name) => {
    const em = STATUS_EM.get(name);
    if (em === undefined) throw new Error(`Measure "${name}" for STATUS_EM`);
    return sum + em * text('xs') + 2 * pad + marker + gap + 2 * border;
  }, 0);
}

/** The legend row of a card in one of two columns at 1440px with the sidebar open, in rem. */
function halfCardLegendRow(): number {
  const gridGap = space(step(chartGrid, /gap: var\(--space-(\d+)\);/));
  const inline = space(step(chartCard, /--card-padding: var\(--space-\d+\) var\(--space-(\d+)\);/));
  const margin = space(
    step(rule(chartCard, '.chart-legend'), /margin-inline: calc\(-1 \* var\(--space-(\d+)\)\);/),
  );
  const card = (desktopRow() - gridGap) / 2;
  return card - 2 * inline - 2 / ROOT_PX + 2 * margin;
}

/** Every stylesheet of the lib, by its path under `src`. */
function stylesheets(): [string, string][] {
  return readdirSync(join(process.cwd(), 'src'), { recursive: true })
    .map(String)
    .filter((path) => path.endsWith('.scss'))
    .map((path) => [path, read(join('src', path))]);
}

function labels(dictionary: Translation): string[] {
  const kpis = dictionary['kpis'] as Record<string, unknown>;
  return Object.keys(KPIS).map((id) => String(kpis[id]));
}

describe('analytics dashboard styles', () => {
  it('sets the KPI columns by the width of the row, not of the viewport', () => {
    expect(styles).toContain('container: dashboard-kpis / inline-size');
    expect(styles).toContain('@container dashboard-kpis (width >= #{$kpi-row-2})');
    expect(styles).toContain('@container dashboard-kpis (width >= #{$kpi-row-3})');
    expect(styles).toContain('@container dashboard-kpis (width >= #{$kpi-row-6})');
  });

  it('puts one tile on a line when two do not fit a money figure', () => {
    expect(rule(styles, '.kpi-row')).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(styles).not.toMatch(/@include a\.respond\((md|xl)\)/);
  });

  it('scales the figure to the tile through the stat size hook', () => {
    expect(tile).toContain('container: kpi-tile / inline-size');
    expect(tile).toMatch(
      /lib-stat \{\s*--stat-value-size: clamp\(var\(--text-lg\), [\d.]+cqi, var\(--text-xl\)\);/,
    );
  });

  it.each([2, 3, 6])('fits 123.456,70 € in each of %i tiles on the narrowest row', (columns) => {
    expect(overflow(row(columns), columns)).toBeLessThanOrEqual(0);
  });

  it('fits the figure at every row width from one tile to six', () => {
    const steps = [
      [row(2), 2],
      [row(3), 3],
      [row(6), 6],
    ] as const;
    for (let width = row(2); width <= 90; width += 0.0625) {
      const columns = steps.filter(([from]) => width >= from).at(-1)?.[1] ?? 1;
      expect(overflow(width, columns), `${String(width)}rem`).toBeLessThanOrEqual(0);
    }
  });

  it('keeps two tiles on a line on a 360px phone', () => {
    // The shell pads the page by 3 steps on a phone, and the page pads its content by 1 more.
    expect(shell).toMatch(
      /respond-down\(md\) \{\s*\.management-content \{\s*--management-content-pad: #\{a\.space\(3\)\};/,
    );
    expect(styles).not.toContain('respond-down(sm)');
    expect(phoneRow()).toBeGreaterThanOrEqual(row(2));
  });

  it.each([
    ['Greek', el],
    ['English', en],
  ])('fits each KPI label on one line at 1440px with the sidebar open, in %s', (_, dictionary) => {
    const width = desktopRow();
    expect(width).toBeGreaterThanOrEqual(row(6));
    for (const label of labels(dictionary)) {
      const em = LABEL_EM.get(label);
      if (em === undefined) throw new Error(`Measure "${label}" for LABEL_EM`);
      expect(em * text('sm'), label).toBeLessThanOrEqual(content(width, 6));
    }
  });

  it('pads the tile less on its block axis than on its inline axis', () => {
    const [, block, inline] = TILE_PADDING.exec(tile) ?? [];
    expect(Number(block)).toBeLessThan(Number(inline));
    expect(tile).not.toContain('--kpi-tile-padding');
  });

  it('spaces the page sections one step tighter than a form page', () => {
    expect(rule(styles, ':host')).toContain('gap: var(--space-4);');
    expect(rule(styles, 'lib-tab-panel')).toContain('padding: var(--space-3) 0 0;');
    expect(rule(styles, 'lib-tab')).toContain('padding-block: var(--space-2);');
  });
});

// jsdom has no layout, so the guard proves the heights from the rules each state shares.
describe('KPI tile skeleton', () => {
  it('draws the value stub one line of the figure tall, at the figure size', () => {
    const stub = rule(tile, '.kpi-value-stub');
    expect(stub).toContain('height: 1lh;');
    // The stub inherits the size and the line height of the value it sits in.
    expect(stub).not.toMatch(/font-size|line-height/);
    expect(tileTemplate).toMatch(
      /<lib-stat[^>]*>\s*@if \(pending\(\)\) \{\s*<span class="kpi-stub kpi-value-stub"/,
    );
  });

  it('keeps the change and the sparkline in one row under the figure', () => {
    expect(tileTemplate).toMatch(
      /<\/lib-stat>\s*<div class="kpi-foot">\s*@if \(pending\(\)\) \{\s*<span class="kpi-stub kpi-change-stub"/,
    );
    expect(foot()).toContain('display: flex;');
    expect(rule(tile, '.kpi-sparkline')).toMatch(/flex: 1;\s*min-width: 0;/);
  });

  it('gives the change and its stub one width, which holds the widest change', () => {
    expect(rule(tile, '.kpi-change-stub')).toContain('width: var(--kpi-change-width);');
    expect(rule(tile, '.kpi-change')).toContain('min-width: var(--kpi-change-width);');
    // The em of the reserve is the change's text size, which the row sets.
    expect(foot()).toContain('font-size: var(--text-sm);');
    expect(rule(tile, '.kpi-change')).not.toContain('font-size');

    // The reserve counts the arrow and the gap the change draws.
    const [, icon, gap, em] = CHANGE_WIDTH.exec(foot()) ?? [];
    expect(rule(tile, '.kpi-change-icon')).toContain(`width: var(--icon-size-${icon});`);
    expect(rule(tile, '.kpi-change')).toContain(`gap: var(--space-${gap});`);
    expect(Number(em)).toBeGreaterThanOrEqual(Math.max(...Object.values(CHANGE_EM)));
  });

  it('keeps the sparkline wider than it is tall beside the change on a 360px phone', () => {
    const height = space(6) + space(1);
    expect(sparklineWidth(phoneRow(), 2)).toBeGreaterThanOrEqual(height);
  });

  it('gives the change and its stub the same block height', () => {
    const shared = rule(tile, '.kpi-change,\n.kpi-change-stub');
    expect(shared).toContain('display: flex;');
    expect(shared).toContain('flex: none;');
    expect(shared).toContain('height: 1lh;');
    expect(rule(tile, '.kpi-change')).not.toMatch(/font-size|line-height|height:/);
    expect(rule(tile, '.kpi-change-stub')).not.toMatch(/font-size|line-height|height:/);
  });

  it('gives the sparkline, its skeleton and the empty space one height', () => {
    expect(rule(tile, '.kpi-tile')).toContain(
      '--kpi-sparkline-height: calc(var(--space-6) + var(--space-1));',
    );
    expect(rule(tile, '.kpi-sparkline')).toContain('height: var(--kpi-sparkline-height);');
  });

  it('draws one edge in forced colors: the tile, not the stat inside it', () => {
    const forced = tile.slice(tile.indexOf('@media (forced-colors: active)'));
    expect(forced).toMatch(/\n {2}\.kpi-tile \{\s*border: [^;]+ CanvasText;/);
    expect(forced).toMatch(/\n {2}lib-stat \{\s*border: 0;\s*\}/);
  });

  it('pulses by opacity only, so reduced motion stops it', () => {
    const frames = tile.slice(tile.indexOf('@keyframes kpi-pulse'));
    expect(frames).toMatch(/50% \{\s*opacity: [\d.]+;\s*\}/);
    expect(frames).not.toMatch(/transform|height|width/);
  });
});

describe('chart card legend', () => {
  it.each(Object.entries(statuses))(
    'fits the five statuses on one line in a card of two columns at 1440px, in %s',
    (_, source) => {
      const names = statusNames(source);
      expect(names).toHaveLength(5);
      // About 500px.
      expect(halfCardLegendRow() * ROOT_PX).toBeGreaterThan(490);
      expect(legendWidth(names)).toBeLessThanOrEqual(halfCardLegendRow());
    },
  );
});

describe('status colors', () => {
  it('colors text with the text tokens of the status hues, never the fill tokens', () => {
    for (const [path, source] of stylesheets()) {
      expect(source, path).not.toMatch(/(^|[^-])color: var\(--(success|warning|error|info)\)/m);
    }
    expect(tile).toMatch(/&\[data-tone='good'\] \{\s*color: var\(--success-text\);/);
    expect(tile).toMatch(/&\[data-tone='bad'\] \{\s*color: var\(--error-text\);/);
  });
});

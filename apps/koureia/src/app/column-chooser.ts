/**
 * Where every grid's column chooser opens.
 *
 * On a desktop it is a floating panel beside the grid, so the user sees each column come and go
 * while choosing. A smaller screen has no room beside the grid, so there it stays a popover under
 * its button.
 */
import { BreakpointObserver } from '@angular/cdk/layout';
import { computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DATAGRID_COLUMN_CHOOSER_OPTIONS, type DatagridColumnChooserOptions } from '@ui/datagrid';
import { map } from 'rxjs';

/** The shell's desktop breakpoint, `lg`, where the sidebar stays beside the page. */
const DESKTOP_QUERY = '(min-width: 1024px)';

/** Registers the surface every grid's column chooser opens. */
export function provideColumnChooser() {
  return [{ provide: DATAGRID_COLUMN_CHOOSER_OPTIONS, useFactory: columnChooserOptions }];
}

function columnChooserOptions(): DatagridColumnChooserOptions {
  const desktop = toSignal(
    inject(BreakpointObserver)
      .observe(DESKTOP_QUERY)
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  return {
    presentation: computed(() => (desktop() ? 'panel' : 'popover')),
    // The panel runs from the bottom of the screen up to the shell's top bar.
    panelInsetTop: 'var(--shell-header-height)',
  };
}

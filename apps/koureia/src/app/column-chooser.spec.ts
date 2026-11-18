import { TestBed } from '@angular/core/testing';
import { DATAGRID_COLUMN_CHOOSER_OPTIONS } from '@ui/datagrid';

import { provideColumnChooser } from './column-chooser';

/** A viewport that is, or is not, as wide as the desktop breakpoint. */
function stubViewport(desktop: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    (query: string): MediaQueryList =>
      ({
        matches: desktop && query.includes('min-width: 1024px'),
        media: query,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

async function options() {
  TestBed.configureTestingModule({ providers: [provideColumnChooser()] });
  const resolved = TestBed.inject(DATAGRID_COLUMN_CHOOSER_OPTIONS);
  // `BreakpointObserver` answers after a zero debounce.
  await new Promise((resolve) => setTimeout(resolve));
  return resolved;
}

describe('provideColumnChooser', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the floating panel on a desktop', async () => {
    stubViewport(true);

    expect((await options()).presentation()).toBe('panel');
  });

  it('keeps the popover on a smaller screen', async () => {
    stubViewport(false);

    expect((await options()).presentation()).toBe('popover');
  });

  it('stops the panel under the shell top bar', async () => {
    stubViewport(true);

    expect((await options()).panelInsetTop).toBe('var(--shell-header-height)');
  });
});

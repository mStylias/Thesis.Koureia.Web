import { convertToParamMap, type ActivatedRouteSnapshot, type Route } from '@angular/router';

import { appointmentDetailsChanged, closesOverPage, panelSwap } from './appointment-details.guard';

function at(appointmentId: string, query: Record<string, string> = {}): ActivatedRouteSnapshot {
  return {
    paramMap: convertToParamMap({ appointmentId }),
    queryParamMap: convertToParamMap(query),
  } as ActivatedRouteSnapshot;
}

describe('appointmentDetailsChanged', () => {
  it('runs the guard for another appointment', () => {
    expect(appointmentDetailsChanged(at('a1'), at('a2'))).toBe(true);
    expect(appointmentDetailsChanged(at('a1'), at('new'))).toBe(true);
  });

  it('runs the guard for another prefill of a create', () => {
    expect(
      appointmentDetailsChanged(
        at('new', { slotDate: '2026-09-24', slotTime: '10:00' }),
        at('new', { slotDate: '2026-09-24', slotTime: '11:00' }),
      ),
    ).toBe(true);
  });

  it('lets the page move behind the drawer without asking', () => {
    expect(
      appointmentDetailsChanged(
        at('a1', { view: 'week', date: '2026-09-21' }),
        at('a1', { view: 'day', date: '2026-09-28' }),
      ),
    ).toBe(false);
    expect(
      appointmentDetailsChanged(
        at('new', { slotDate: '2026-09-24', view: 'week' }),
        at('new', { slotDate: '2026-09-24', view: 'month' }),
      ),
    ).toBe(false);
  });
});

const page: Route = { path: 'calendar' };
const panelRoute: Route = { path: ':appointmentId' };
const other: Route = { path: 'roles' };

function node(
  routeConfig: Route | null,
  children: ActivatedRouteSnapshot[] = [],
): ActivatedRouteSnapshot {
  return { routeConfig, children } as unknown as ActivatedRouteSnapshot;
}

const panel = { routeConfig: panelRoute, parent: node(page) } as ActivatedRouteSnapshot;

describe('closesOverPage', () => {
  it('plays the exit when the page stays and the drawer goes', () => {
    expect(closesOverPage(panel, node(null, [node(page)]))).toBe(true);
  });

  it('plays no exit when the drawer stays', () => {
    expect(closesOverPage(panel, node(null, [node(page, [node(panelRoute)])]))).toBe(false);
  });

  it('plays no exit when the page goes too', () => {
    expect(closesOverPage(panel, node(null, [node(other)]))).toBe(false);
  });
});

describe('panelSwap', () => {
  const sibling: Route = { path: ':customerId' };

  function at(config: Route, segments: number): ActivatedRouteSnapshot {
    return {
      routeConfig: config,
      children: [],
      url: new Array(segments),
    } as unknown as ActivatedRouteSnapshot;
  }

  /** The appointment panel, three segments under the page: `c1/appointments/a1`. */
  const deep = {
    routeConfig: panelRoute,
    parent: node(page),
    url: new Array(3),
  } as unknown as ActivatedRouteSnapshot;

  it('goes back to a panel with fewer segments', () => {
    expect(panelSwap(deep, node(null, [node(page, [at(sibling, 1)])]))).toBe('back');
  });

  it('goes forward to a panel with more segments', () => {
    const shallow = {
      routeConfig: sibling,
      parent: node(page),
      url: new Array(1),
    } as unknown as ActivatedRouteSnapshot;
    expect(panelSwap(shallow, node(null, [node(page, [at(panelRoute, 3)])]))).toBe('forward');
  });

  it('stays level for a panel as deep', () => {
    expect(panelSwap(deep, node(null, [node(page, [at(sibling, 3)])]))).toBe('none');
  });

  it('is no swap when the same panel stays, the drawer closes or the page goes', () => {
    expect(panelSwap(deep, node(null, [node(page, [at(panelRoute, 3)])]))).toBeNull();
    expect(panelSwap(deep, node(null, [node(page)]))).toBeNull();
    expect(panelSwap(deep, node(null, [node(other, [at(sibling, 1)])]))).toBeNull();
  });
});

import { inject } from '@angular/core';
import type { ActivatedRouteSnapshot, CanDeactivateFn, Route } from '@angular/router';
import { DrawerHandoff, type DrawerSwapDirection } from '@ui/drawer';

import type { AppointmentDetails } from './appointment-details';

/** The query parameters a prefill of `new` travels in. The page's own position is not one. */
export const PREFILL_PARAMS = ['slotDate', 'slotTime', 'barberId', 'rebook', 'customerId'] as const;

/**
 * Asks before a navigation drops an edit with changes: another tile, the create button, a slot,
 * back and forward. It tells the drawer whether its page stays, so the exit plays over it.
 * Another panel of the same page takes the drawer's place at once, with no exit.
 *
 * ```ts
 * { path: ':appointmentId', component: AppointmentDetails,
 *   canDeactivate: [leaveAppointmentDetails], runGuardsAndResolvers: appointmentDetailsChanged }
 * ```
 */
export const leaveAppointmentDetails: CanDeactivateFn<AppointmentDetails> = async (
  panel,
  route,
  _state,
  next,
) => {
  // Before the `await`, which ends the injection context.
  const handoff = inject(DrawerHandoff);
  if (!(await panel.canLeave())) return false;
  const swap = panelSwap(route, next.root);
  if (swap !== null) handoff.pass(swap);
  panel.prepareLeave(swap === null && closesOverPage(route, next.root));
  return true;
};

/**
 * Where the next panel sits against this one when the next state keeps the drawer's page and shows
 * another of its panels, or `null` when it does not. A panel with more address segments is deeper:
 * a customer's appointment is `forward` of the customer.
 */
export function panelSwap(
  panel: ActivatedRouteSnapshot,
  next: ActivatedRouteSnapshot,
): DrawerSwapDirection | null {
  const page = panel.parent?.routeConfig ?? null;
  if (page === null || panel.routeConfig === null) return null;
  const sibling = findRoute(next, page)?.children.find(
    (child) => child.routeConfig !== null && child.routeConfig !== panel.routeConfig,
  );
  if (sibling === undefined) return null;
  const depth = sibling.url.length - panel.url.length;
  return depth > 0 ? 'forward' : depth < 0 ? 'back' : 'none';
}

/**
 * Whether the next state keeps the drawer's page and drops the drawer. A navigation to another page
 * plays no exit, because the whole page goes and the exit would only hold the next one back.
 */
export function closesOverPage(
  panel: ActivatedRouteSnapshot,
  next: ActivatedRouteSnapshot,
): boolean {
  const page = panel.parent?.routeConfig ?? null;
  if (page === null || panel.routeConfig === null) return false;
  const kept = routeConfigs(next);
  return kept.has(page) && !kept.has(panel.routeConfig);
}

function findRoute(node: ActivatedRouteSnapshot, config: Route): ActivatedRouteSnapshot | null {
  if (node.routeConfig === config) return node;
  for (const child of node.children) {
    const found = findRoute(child, config);
    if (found !== null) return found;
  }
  return null;
}

function routeConfigs(root: ActivatedRouteSnapshot): Set<Route> {
  const found = new Set<Route>();
  const visit = (node: ActivatedRouteSnapshot): void => {
    if (node.routeConfig !== null) found.add(node.routeConfig);
    node.children.forEach(visit);
  };
  visit(root);
  return found;
}

/**
 * Runs the guard when the drawer would show something else: another appointment, or another
 * prefill of `new`. The page moving behind the drawer changes other query parameters, and must
 * not ask.
 */
export function appointmentDetailsChanged(
  from: ActivatedRouteSnapshot,
  to: ActivatedRouteSnapshot,
): boolean {
  return (
    from.paramMap.get('appointmentId') !== to.paramMap.get('appointmentId') ||
    PREFILL_PARAMS.some((name) => from.queryParamMap.get(name) !== to.queryParamMap.get(name))
  );
}

import { inject } from '@angular/core';
import type { ActivatedRouteSnapshot, CanDeactivateFn, Route } from '@angular/router';
import { panelSwap } from '@features/management-shared-appointments';
import { DrawerHandoff } from '@ui/drawer';

import type { CustomerDetails } from './customer-details';

/**
 * Asks before a navigation drops an edit with changes: another row, back and forward. It tells
 * the drawer whether its page stays, so the exit plays over it. An appointment of the customer
 * takes the drawer's place at once, with no exit.
 */
export const leaveCustomerDetails: CanDeactivateFn<CustomerDetails> = async (
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

/** Whether the next state keeps the drawer's page and drops the drawer. */
export function closesOverPage(
  panel: ActivatedRouteSnapshot,
  next: ActivatedRouteSnapshot,
): boolean {
  const page = panel.parent?.routeConfig ?? null;
  if (page === null || panel.routeConfig === null) return false;
  const kept = routeConfigs(next);
  return kept.has(page) && !kept.has(panel.routeConfig);
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

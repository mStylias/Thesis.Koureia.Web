import type { ActivatedRouteSnapshot, CanDeactivateFn, Route } from '@angular/router';

import type { ServiceDetails } from './service-details';

/**
 * Asks before a navigation drops an edit with changes: another row, the create button, back and
 * forward. It tells the drawer whether its page stays, so the exit plays over it.
 */
export const leaveServiceDetails: CanDeactivateFn<ServiceDetails> = async (
  panel,
  route,
  _state,
  next,
) => {
  if (!(await panel.canLeave())) return false;
  panel.prepareLeave(closesOverPage(route, next.root));
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

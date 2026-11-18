import { Component, inject } from '@angular/core';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { appointmentsTranslocoScope } from '@features/management-shared-appointments';
import { Banner } from '@ui/banner';
import { Button } from '@ui/button';
import { Tab, TabContent, TabList, TabPanel, Tabs } from '@ui/tabs';

import { AnalyticsDashboardStore, DASHBOARD_TODAY } from '../analytics-dashboard.store';
import { dashboardTranslocoScope } from '../analytics-dashboard.i18n';
import type { KpiId } from '../analytics.format.types';
import { injectChartContext } from '../charts/chart-context';
import { KpiTile } from '../kpis/kpi-tile';
import { CustomersTab } from '../tabs/customers-tab';
import { DemandTab } from '../tabs/demand-tab';
import { LostTab } from '../tabs/lost-tab';
import { QualityTab } from '../tabs/quality-tab';
import { RevenueTab } from '../tabs/revenue-tab';
import { ServicesTab } from '../tabs/services-tab';
import { TeamTab } from '../tabs/team-tab';
import { DashboardFilters } from './dashboard-filters';
import { DASHBOARD_TABS } from './dashboard-filters.query';
import type { DashboardTab } from './dashboard-filters.types';

/** The KPI tiles in the order the row shows them. */
const KPI_IDS: readonly KpiId[] = [
  'revenue',
  'appointments',
  'averageTicket',
  'uniqueCustomers',
  'lostRate',
  'averageRating',
];

/**
 * The shop's numbers: the toolbar, six KPI tiles, and seven tabs of charts. The URL holds every
 * filter and the tab, so a reload, the back button and a copied link restore the same view.
 *
 * The store is provided here, so each visit starts empty. Only the open tab's charts read.
 */
@Component({
  selector: 'lib-analytics-dashboard',
  imports: [
    Banner,
    Button,
    CustomersTab,
    DashboardFilters,
    DemandTab,
    KpiTile,
    LostTab,
    QualityTab,
    RevenueTab,
    ServicesTab,
    Tab,
    TabContent,
    TabList,
    TabPanel,
    Tabs,
    TeamTab,
    TranslocoPipe,
  ],
  templateUrl: './analytics-dashboard.html',
  styleUrl: './analytics-dashboard.scss',
  providers: [
    provideTranslocoScope(dashboardTranslocoScope, appointmentsTranslocoScope),
    AnalyticsDashboardStore,
  ],
})
export class AnalyticsDashboard {
  protected readonly store = inject(AnalyticsDashboardStore);
  protected readonly today = inject(DASHBOARD_TODAY)();
  protected readonly tabs = DASHBOARD_TABS;
  protected readonly kpiIds = KPI_IDS;

  protected readonly overviewContext = injectChartContext(() => this.store.overview()?.period);

  /** The retry removes the button, so focus moves to the KPI section first. */
  protected retryOverview(section: HTMLElement): void {
    section.focus({ preventScroll: true });
    this.store.retryOverview();
  }

  protected selectTab(value: string | undefined): void {
    if (value !== undefined && (DASHBOARD_TABS as readonly string[]).includes(value)) {
      this.store.selectTab(value as DashboardTab);
    }
  }
}

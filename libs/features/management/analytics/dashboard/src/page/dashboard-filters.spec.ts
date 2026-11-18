import { Component, signal } from '@angular/core';
import { getDebugNode } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Tooltip } from '@ui/tooltip';

import { provideDashboardTesting, setDashboardTranslations } from '../testing/dashboard.testing';
import { DashboardFilters } from './dashboard-filters';
import { decodeDashboardQuery, resolveDashboardFilters } from './dashboard-filters.query';
import type { DashboardQueryPatch, DashboardStaffMember } from './dashboard-filters.types';

const TODAY = '2026-10-04';
const STAFF: DashboardStaffMember[] = [
  { id: 's1', displayName: 'Αλέξανδρος Σ.', isActive: true },
  { id: 's2', displayName: 'Γιάννης Ρ.', isActive: false },
  { id: 's3', displayName: 'Νίκος Β.', isActive: true },
];

@Component({
  imports: [DashboardFilters],
  template: `
    <lib-dashboard-filters
      [query]="query()"
      [filters]="filters()"
      [staff]="staff()"
      [today]="today"
      locale="el"
      (queryChange)="changes.push($event)"
    />
  `,
})
class Host {
  readonly today = TODAY;
  readonly params = signal<Record<string, string>>({});
  readonly staff = signal<readonly DashboardStaffMember[]>(STAFF);
  readonly query = () =>
    decodeDashboardQuery(this.params(), { today: TODAY, staffIds: STAFF.map((m) => m.id) });
  readonly filters = () => resolveDashboardFilters(this.query(), TODAY);
  readonly changes: DashboardQueryPatch[] = [];
}

describe('DashboardFilters', () => {
  let fixture: ComponentFixture<Host>;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function staffField(): HTMLElement | null {
    return root().querySelector('.filter-staff');
  }

  function combobox(field: Element | null): HTMLElement {
    const element = field?.querySelector('[role="combobox"]');
    if (!element) throw new Error('combobox not rendered');
    return element as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideDashboardTesting() });
    setDashboardTranslations();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('disables the barber filter on the Team tab, with a tooltip that says why', () => {
    fixture.componentInstance.params.set({ tab: 'team', staff: 's1' });
    fixture.detectChanges();

    const field = staffField();
    expect(combobox(field).getAttribute('aria-disabled')).toBe('true');
    const tooltip = getDebugNode(field)?.injector.get(Tooltip);
    expect(tooltip?.libTooltip()).toBe('Η καρτέλα συγκρίνει όλους τους κουρείς.');
    expect(tooltip?.tooltipDisabled()).toBe(false);
    const hint = combobox(field).getAttribute('aria-describedby') ?? '';
    expect(root().querySelector(`[id="${hint.split(' ')[0]}"]`)?.textContent).toContain(
      'Η καρτέλα συγκρίνει όλους τους κουρείς.',
    );
  });

  it('leaves the barber filter on with no tooltip on the other tabs', () => {
    const field = staffField();
    expect(combobox(field).getAttribute('aria-disabled')).not.toBe('true');
    expect(getDebugNode(field)?.injector.get(Tooltip).tooltipDisabled()).toBe(true);
  });

  it('hides the barber filter when the shop has one barber', () => {
    fixture.componentInstance.staff.set(STAFF.slice(0, 1));
    fixture.detectChanges();
    expect(staffField()).toBeNull();
  });
});

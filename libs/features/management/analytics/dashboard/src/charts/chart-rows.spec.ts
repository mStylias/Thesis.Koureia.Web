import { Injector, runInInjectionContext, signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StaffAccessStore, type WorkspaceStaffMemberViewDto } from '@auth/data-access';

import { injectStaffRows } from './chart-rows';

function member(id: string, isActive: boolean): WorkspaceStaffMemberViewDto {
  return { id, displayName: `Κουρέας ${id}`, isActive };
}

describe('injectStaffRows', () => {
  const staff = signal<readonly WorkspaceStaffMemberViewDto[]>([]);

  function rows(): Signal<number> {
    return runInInjectionContext(TestBed.inject(Injector), () => injectStaffRows());
  }

  beforeEach(() => {
    staff.set([]);
    TestBed.configureTestingModule({
      providers: [{ provide: StaffAccessStore, useValue: { staff } }],
    });
  });

  it('gives 1 row for a shop with no barbers, so the skeleton still draws a bar', () => {
    expect(rows()()).toBe(1);
  });

  it('gives 1 row when every barber is inactive', () => {
    staff.set([member('a', false), member('b', false)]);
    expect(rows()()).toBe(1);
  });

  it('counts the active barbers only', () => {
    staff.set([member('a', true), member('b', false), member('c', true), member('d', true)]);
    expect(rows()()).toBe(3);
  });

  it('follows a change to the barbers', () => {
    const count = rows();
    staff.set([member('a', true)]);
    expect(count()).toBe(1);
    staff.set([member('a', true), member('b', true)]);
    expect(count()).toBe(2);
  });
});

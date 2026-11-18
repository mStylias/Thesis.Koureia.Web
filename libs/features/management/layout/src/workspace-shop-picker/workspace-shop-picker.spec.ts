import { Injectable, signal, type WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import {
  provideTransloco,
  provideTranslocoScope,
  type Translation,
  type TranslocoLoader,
  TranslocoService,
} from '@jsverse/transloco';
import {
  PlatformCompaniesApi,
  StaffAccessStore,
  WorkspaceCompanyChoice,
  type WorkspaceCompanyViewDto,
} from '@auth/data-access';
import { Result } from '@synax/client/core';
import { Select } from '@ui/select';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { managementInlineLoader, managementTranslocoScope } from '../management.i18n';
import { WorkspaceShopPicker } from './workspace-shop-picker';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

const SHOP = { id: 'c1', name: 'Κουρείο Ένα', timezone: 'Europe/Athens' };

describe('WorkspaceShopPicker', () => {
  let fixture: ComponentFixture<WorkspaceShopPicker>;
  let company: WritableSignal<WorkspaceCompanyViewDto | null>;
  let calls: string[];

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function select(): Select<unknown> {
    return fixture.debugElement.query(By.directive(Select)).componentInstance as Select<unknown>;
  }

  async function configure(current: WorkspaceCompanyViewDto | null): Promise<void> {
    company = signal<WorkspaceCompanyViewDto | null>(current);
    calls = [];

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
          loader: EmptyLoader,
        }),
        provideTranslocoScope(managementTranslocoScope),
        {
          provide: StaffAccessStore,
          useValue: {
            company: company.asReadonly(),
            reload: () => {
              calls.push('reload');
              company.set({ id: 'c2', name: 'Κουρείο Δύο', timezone: 'Europe/Athens' });
              return Promise.resolve();
            },
          },
        },
        {
          provide: WorkspaceCompanyChoice,
          useValue: {
            set: (id: string) => {
              calls.push(`set:${id}`);
            },
          },
        },
        {
          provide: PlatformCompaniesApi,
          useValue: {
            companies: () => of(Result.Ok({ items: [], totalCount: 0 })),
          },
        },
      ],
    });

    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('en'));
    await firstValueFrom(transloco.load('management/en', { inlineLoader: managementInlineLoader }));
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockImplementation((url) => {
      calls.push(`navigate:${url.toString()}`);
      return Promise.resolve(true);
    });

    fixture = TestBed.createComponent(WorkspaceShopPicker);
    await settle();
  }

  it('asks for a shop while none is picked', async () => {
    await configure(null);

    expect(root().textContent).toContain('Pick a shop');
    expect(root().querySelector('[role="combobox"]')?.getAttribute('aria-describedby')).toBe(
      'workspace-shop-prompt',
    );
  });

  it('says nothing more once a shop is picked', async () => {
    await configure(SHOP);

    expect(root().textContent).not.toContain('Pick a shop');
  });

  // The order is the contract: the header must carry the new shop before the workspace is read,
  // and the home page must open against the new answer.
  it('stores the pick, reads the workspace again, then opens the home page', async () => {
    await configure(SHOP);

    select().value.set('c2');
    await settle();

    expect(calls).toEqual(['set:c2', 'reload', 'navigate:/management']);
  });

  it('does nothing when the same shop is picked again', async () => {
    await configure(SHOP);

    select().value.set('c1');
    await settle();

    expect(calls).toEqual([]);
  });
});

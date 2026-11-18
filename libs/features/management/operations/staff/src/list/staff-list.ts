import {
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { provideTranslocoScope, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucidePlus, LucideRefreshCw, LucideUsers } from '@lucide/angular';
import { StaffAccessStore } from '@auth/data-access';
import { STAFF_SCHEDULE_CONTEXT } from '@features/management-shared-staff-schedule';
import { Banner } from '@ui/banner';
import { Button, ButtonIcon } from '@ui/button';
import { Select, type SelectOption } from '@ui/select';
import { Spin } from '@ui/spin';
import { Tooltip } from '@ui/tooltip';

import { AddMemberDialog } from '../add/add-member-dialog';
import { staffTranslocoScope } from '../staff.i18n';
import { StaffStore } from '../staff.store';
import type { StaffFilter } from '../staff.types';
import { StaffCard } from './staff-card';
import { StaffCardSkeleton } from './staff-card-skeleton';

/** How often "today" and "next" are measured again while the page stays open. */
const CLOCK_TICK_MS = 60_000;

/**
 * The shop's people, as cards. A card opens the member in the drawer, a child route that draws
 * over this page. A shop has a handful of people, so the list is read whole and filtered here.
 */
@Component({
  selector: 'lib-staff-page',
  imports: [
    AddMemberDialog,
    Banner,
    Button,
    ButtonIcon,
    LucidePlus,
    LucideRefreshCw,
    LucideUsers,
    RouterOutlet,
    Select,
    Spin,
    StaffCard,
    StaffCardSkeleton,
    Tooltip,
    TranslocoPipe,
  ],
  templateUrl: './staff-list.html',
  styleUrl: './staff-list.scss',
  providers: [
    provideTranslocoScope(staffTranslocoScope),
    StaffStore,
    { provide: STAFF_SCHEDULE_CONTEXT, useExisting: StaffStore },
  ],
})
export class StaffList {
  private readonly transloco = inject(TranslocoService);
  private readonly access = inject(StaffAccessStore);
  protected readonly store = inject(StaffStore);

  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly filter = signal<StaffFilter>('active');

  protected readonly filterOptions = computed<readonly SelectOption<StaffFilter>[]>(() => {
    this.language();
    return (['active', 'inactive', 'all'] as const).map((value) => ({
      value,
      label: this.transloco.translate(`managementStaff.filter.${value}`),
    }));
  });

  protected readonly now = signal(new Date());

  protected readonly canAdd = computed(() => this.access.has('members:invite'));

  protected readonly addOpen = signal(false);

  /** The filtered members, active ones first. The API already sorts by name. */
  protected readonly shown = computed(() => {
    const members = this.store.members() ?? [];
    const filter = this.filter();
    const kept = members.filter((member) =>
      filter === 'all' ? true : member.isActive === (filter === 'active'),
    );
    return [...kept].sort((a, b) => Number(b.isActive) - Number(a.isActive));
  });

  protected readonly firstLoad = computed(
    () => this.store.members() === null && !this.store.membersFailed(),
  );

  constructor() {
    void this.store.reload();
    void this.store.loadOptions();

    // Browser only: a server render must not hold an interval open.
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const timer = setInterval(() => {
        this.now.set(new Date());
      }, CLOCK_TICK_MS);
      destroyRef.onDestroy(() => {
        clearInterval(timer);
      });
    });

    // A superadmin's shop change keeps this page, and the options name services in the page
    // language, so both changes read the options and the cards again.
    let seen: string | undefined;
    effect(() => {
      const current = `${this.access.company()?.id ?? ''}|${this.language()}`;
      if (seen !== undefined && current !== seen) {
        untracked(() => {
          void this.store.loadOptions();
          void this.store.reload();
        });
      }
      seen = current;
    });
  }

  /** The icon spins and the button stays live, so a second press waits for the first. */
  protected refresh(): void {
    if (this.store.membersLoading()) return;
    void this.store.reload();
  }

  protected openAdd(): void {
    this.addOpen.set(true);
  }
}

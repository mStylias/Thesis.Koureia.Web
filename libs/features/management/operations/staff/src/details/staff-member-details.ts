import {
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  viewChild,
  type AnimationCallbackEvent,
} from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  NavigationCancel,
  NavigationCancellationCode,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  Router,
  type Event as RouterEvent,
} from '@angular/router';
import {
  provideTranslocoScope,
  translateObjectSignal,
  TranslocoPipe,
  TranslocoService,
} from '@jsverse/transloco';
import {
  LucideCalendarPlus,
  LucideCamera,
  LucideCircleCheck,
  LucideCircleOff,
  LucidePencil,
  LucideSave,
  LucideTrash2,
} from '@lucide/angular';
import { filter, firstValueFrom, map } from 'rxjs';
import { StaffApi, upcomingCountOf, type StaffMemberResponse } from '@api/staff';
import { StaffAccessStore } from '@auth/data-access';
import { StaffHours, StaffTimeOff } from '@features/management-shared-staff-schedule';
import { injectErrorMessageResolver } from '@synax/client';
import { Result, type HttpError } from '@synax/client/core';
import { Banner } from '@ui/banner';
import { Button, ButtonIcon } from '@ui/button';
import { ConfirmationService } from '@ui/confirmation-dialog';
import { Drawer, DrawerActions, DrawerHeader, DrawerToolbar, type DrawerAction } from '@ui/drawer';
import { Tab, TabList, TabPanel, Tabs } from '@ui/tabs';
import { ToasterService } from '@ui/toaster';
import { Tooltip } from '@ui/tooltip';

import { StaffAvatar } from '../avatar/staff-avatar';
import { jobTitleLabel } from '../staff.format';
import { staffTranslocoScope } from '../staff.i18n';
import { StaffStore } from '../staff.store';
import { StaffPhoto } from './photo/staff-photo';
import { StaffProfile } from './profile/staff-profile';
import { StaffServices } from './services/staff-services';
import type { StaffTabEditor, StaffTabId } from './staff-member-details.types';

const K = 'managementStaff';

const TABS: readonly StaffTabId[] = ['profile', 'services', 'hours', 'timeOff'];

/**
 * One member beside the cards, in four tabs: profile, services, hours and time off. Each tab
 * edits and saves on its own, and keeps its unsaved changes while another tab shows. The tab is
 * in the address, `?tab=hours`, so a link opens it.
 *
 * Unsaved changes are never dropped silently. The drawer's own close asks through `closeGuard`, a
 * navigation through {@link canLeave}, and a reload through `beforeunload`.
 */
@Component({
  selector: 'lib-staff-member-details',
  imports: [
    Banner,
    Button,
    ButtonIcon,
    Drawer,
    DrawerActions,
    DrawerHeader,
    DrawerToolbar,
    LucideCamera,
    LucidePencil,
    LucideSave,
    StaffAvatar,
    StaffHours,
    StaffPhoto,
    StaffProfile,
    StaffServices,
    StaffTimeOff,
    Tab,
    TabList,
    TabPanel,
    Tabs,
    Tooltip,
    TranslocoPipe,
  ],
  providers: [provideTranslocoScope(staffTranslocoScope)],
  templateUrl: './staff-member-details.html',
  styleUrl: './staff-member-details.scss',
  host: {
    '(window:beforeunload)': 'onBeforeUnload($event)',
    '(animate.leave)': 'onLeave($event)',
  },
})
export class StaffMemberDetails {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(StaffApi);
  private readonly store = inject(StaffStore);
  private readonly access = inject(StaffAccessStore);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly errorMessage = injectErrorMessageResolver();
  private readonly injector = inject(Injector);
  private readonly drawer = viewChild(Drawer);

  private readonly profileTab = viewChild(StaffProfile);
  private readonly servicesTab = viewChild(StaffServices);
  private readonly hoursTab = viewChild(StaffHours);
  private readonly timeOffTab = viewChild(StaffTimeOff);

  /** `false` from the drawer's own close until the navigation it starts settles. */
  protected readonly open = signal(true);

  /** Set by the guard: the cards stay, so the exit plays over them. */
  private exitOverPage = false;

  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly staffMemberId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('staffMemberId') ?? '')),
    { initialValue: '' },
  );

  protected readonly tab = toSignal(
    this.route.queryParamMap.pipe(map((params) => toTab(params.get('tab')))),
    { initialValue: 'profile' },
  );

  private readonly memberResource = rxResource({
    params: () => this.staffMemberId() || undefined,
    stream: ({ params }) => this.api.member(params),
  });

  private readonly loaded = computed<StaffMemberResponse | null>(() => {
    const result = this.memberResource.hasValue() ? this.memberResource.value() : null;
    return result?.isSuccess === true ? result.data : null;
  });

  /** The member on screen. It stays while the next one loads, so the drawer does not jump. */
  protected readonly member = linkedSignal<
    { readonly loaded: StaffMemberResponse | null; readonly holding: boolean },
    StaffMemberResponse | null
  >({
    source: () => ({ loaded: this.loaded(), holding: this.memberResource.isLoading() }),
    computation: (next, previous) =>
      next.loaded ?? (next.holding ? (previous?.value ?? null) : null),
  });

  /** The member on screen is the last one, while the next loads. Its actions wait. */
  protected readonly switching = computed(() => {
    const shown = this.member();
    return shown !== null && shown.id !== this.staffMemberId();
  });

  private readonly readError = computed<HttpError | null>(() => {
    if (this.memberResource.isLoading()) return null;
    const result = this.memberResource.hasValue() ? this.memberResource.value() : null;
    return result?.isFailure === true ? result.error : null;
  });

  protected readonly notFound = computed(() => this.readError()?.httpCode === 404);
  protected readonly readErrorText = computed(() => {
    const error = this.readError();
    return error === null ? '' : this.errorMessage(error);
  });

  protected readonly reading = computed(
    () => this.member() === null && this.memberResource.isLoading(),
  );

  protected readonly options = this.store.options;
  protected readonly optionsFailed = this.store.optionsFailed;

  /** The member's full name. Empty until one loads: the template shows a generic heading. */
  protected readonly title = computed(() => {
    const member = this.member();
    return member === null ? '' : fullName(member);
  });

  protected readonly jobTitle = computed(() => {
    this.language();
    const code = this.member()?.jobTitleCode ?? null;
    return code === null ? '' : jobTitleLabel(code, (key) => this.transloco.translate(key));
  });

  protected readonly canServices = computed(() => this.access.has('staff:manage_services'));

  protected readonly canHours = computed(
    () =>
      this.access.has('staff:manage_schedule') ||
      (this.access.has('staff:manage_own_schedule') && this.member()?.isSelf === true),
  );

  protected readonly canTimeOff = computed(
    () =>
      this.access.has('staff:manage_timeoff') ||
      (this.access.has('staff:manage_own_timeoff') && this.member()?.isSelf === true),
  );

  protected readonly canDeactivate = computed(() => {
    const member = this.member();
    return (
      member !== null &&
      member.isActive &&
      !member.isSelf &&
      member.canManage &&
      this.access.has('members:remove')
    );
  });

  protected readonly canActivate = computed(() => {
    const member = this.member();
    return member !== null && !member.isActive && this.access.has('members:remove');
  });

  protected readonly canDelete = computed(() => {
    const member = this.member();
    return (
      member !== null &&
      member.canDelete &&
      !member.isSelf &&
      member.canManage &&
      this.access.has('members:remove')
    );
  });

  /** The tab whose Edit, Cancel and Save the toolbar shows. Time off has none of these. */
  protected readonly activeEditor = computed<StaffTabEditor | null>(() => {
    switch (this.tab()) {
      case 'profile':
        return this.profileTab() ?? null;
      case 'services':
        return this.servicesTab() ?? null;
      case 'hours':
        return this.hoursTab() ?? null;
      default:
        return null;
    }
  });

  /** A write from the toolbar in flight: activate, deactivate, delete. */
  protected readonly acting = signal(false);

  /** Reads the scope's copy as a signal, so the toolbar follows a language change. */
  private readonly actionLabels = translateObjectSignal('actions');

  /**
   * The toolbar's group: New time off, Deactivate or Activate, and Delete. The drawer folds the
   * last ones into ⋮ first. Edit, Cancel and Save are the end slot. Editing hides the group.
   */
  protected readonly toolbarActions = computed<readonly DrawerAction[]>(() => {
    if (this.member() === null || this.activeEditor()?.editing() === true) return [];
    const labels = this.actionLabels() as Record<string, string>;
    const acting = this.acting();
    const actions: DrawerAction[] = [];
    if (this.tab() === 'timeOff' && this.canTimeOff()) {
      actions.push({
        id: 'newTimeOff',
        label: labels['newTimeOff'] ?? '',
        icon: LucideCalendarPlus,
        severity: 'primary',
        variant: 'filled',
        run: () => {
          this.newTimeOff();
        },
      });
    }
    if (this.canDeactivate() || this.canActivate()) {
      const deactivate = this.canDeactivate();
      actions.push({
        id: 'active',
        label: labels[deactivate ? 'deactivate' : 'activate'] ?? '',
        icon: deactivate ? LucideCircleOff : LucideCircleCheck,
        loading: acting,
        run: () => {
          void this.setActive(!deactivate);
        },
      });
    }
    // Withheld, not disabled, once the member has history: Deactivate is the way.
    if (this.canDelete()) {
      actions.push({
        id: 'delete',
        label: labels['delete'] ?? '',
        icon: LucideTrash2,
        severity: 'error',
        variant: 'text',
        disabled: acting,
        run: () => {
          void this.remove();
        },
      });
    }
    return actions;
  });

  /** The drawer's ×, Escape and Cancel ask the same question a navigation does. */
  protected readonly closeGuard = (): Promise<boolean> => this.canLeave();

  constructor() {
    // Another member opens at the top, in the same frame it is drawn.
    let shownId: string | null = null;
    effect(() => {
      const id = this.member()?.id ?? null;
      if (id === shownId) return;
      const switched = shownId !== null && id !== null;
      shownId = id;
      if (!switched) return;
      afterNextRender(
        () => {
          this.drawer()?.scrollToTop();
        },
        { injector: this.injector },
      );
    });

    // A close whose navigation did not happen opens the drawer again.
    this.router.events.pipe(filter(settled), takeUntilDestroyed()).subscribe(() => {
      if (!this.open()) this.open.set(true);
    });
  }

  /** Whether the drawer may go: yes unless a tab holds changes the user does not discard. */
  async canLeave(): Promise<boolean> {
    const dirty = this.editors().filter((editor) => editor.hasChanges());
    if (dirty.length === 0) return true;
    if (!(await this.confirmDiscard())) return false;
    dirty.forEach((editor) => {
      editor.discard();
    });
    return true;
  }

  /** Called by the guard before the route goes. Over cards that stay, the exit plays. */
  prepareLeave(overPage: boolean): void {
    this.exitOverPage = overPage;
  }

  /** Holds the element through the drawer's exit after the router has destroyed the view. */
  protected onLeave(event: AnimationCallbackEvent): void {
    const drawer = this.drawer();
    if (!this.exitOverPage || drawer === undefined) {
      event.animationComplete();
      return;
    }
    void drawer.exit().then(() => {
      event.animationComplete();
    });
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.editors().some((editor) => editor.hasChanges())) event.preventDefault();
  }

  /** The drawer's own close: the ×, Escape. The cards show at once, and the exit plays over them. */
  protected onVisibleChange(visible: boolean): void {
    this.open.set(visible);
    if (!visible) this.close();
  }

  protected setTab(tab: string | undefined): void {
    const next = toTab(tab ?? null);
    if (next === this.tab()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: next === 'profile' ? null : next },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected edit(): void {
    this.activeEditor()?.edit();
  }

  protected save(): void {
    this.activeEditor()?.save();
  }

  /** Back to view. Changes are dropped only after the user agrees. */
  protected async cancelEdit(): Promise<void> {
    const editor = this.activeEditor();
    if (editor === null) return;
    if (editor.hasChanges() && !(await this.confirmDiscard())) return;
    editor.discard();
  }

  protected newTimeOff(): void {
    this.timeOffTab()?.create();
  }

  protected reload(): void {
    this.memberResource.reload();
  }

  protected reloadOptions(): void {
    void this.store.loadOptions();
  }

  /** A tab saved the member. The cards show it too. */
  protected onMemberChanged(member: StaffMemberResponse): void {
    this.memberResource.set(Result.Ok(member));
    void this.store.reload();
  }

  /** Hours or time off changed: the member's warnings and the cards' "today" line follow. */
  protected onScheduleChanged(): void {
    this.memberResource.reload();
    void this.store.reload();
  }

  protected async setActive(isActive: boolean): Promise<void> {
    const member = this.member();
    if (member === null || this.acting()) return;
    const action = isActive ? 'activate' : 'deactivate';
    const answer = await this.confirmation.open({
      title: this.transloco.translate(`${K}.${action}.title`),
      message: this.transloco.translate(`${K}.${action}.message`, { name: fullName(member) }),
      confirmLabel: this.transloco.translate(`${K}.${action}.confirm`),
      cancelLabel: this.transloco.translate(`${K}.${action}.cancel`),
      severity: 'warning',
    });
    if (answer !== 'confirmed') return;

    this.acting.set(true);
    const result = await firstValueFrom(this.api.setActive(member.id, isActive));
    this.acting.set(false);
    if (!result.isSuccess) {
      const count = upcomingCountOf(result.error);
      this.toaster.error(
        count === null
          ? this.errorMessage(result.error)
          : this.transloco.translate(`${K}.deactivate.upcoming`, { count }),
      );
      if (isForbidden(result.error)) this.memberResource.reload();
      return;
    }
    this.memberResource.set(result);
    void this.store.reload();
    this.toaster.success(
      this.transloco.translate(`${K}.toast.${isActive ? 'activated' : 'deactivated'}`),
    );
  }

  /** Deletes after a confirmation. A member with history offers Deactivate instead. */
  protected async remove(): Promise<void> {
    const member = this.member();
    if (member === null || this.acting()) return;
    const name = fullName(member);
    const answer = await this.confirmation.open({
      title: this.transloco.translate(`${K}.delete.title`),
      message: this.transloco.translate(`${K}.delete.message`, { name }),
      confirmLabel: this.transloco.translate(`${K}.delete.confirm`),
      cancelLabel: this.transloco.translate(`${K}.delete.cancel`),
      severity: 'error',
    });
    if (answer !== 'confirmed') return;

    this.acting.set(true);
    const result = await firstValueFrom(this.api.deleteMember(member.id));
    this.acting.set(false);
    if (!result.isSuccess) {
      if (result.error.errorCode === 'STAFF_IN_USE') {
        // A booking or a review landed between the read and the click.
        this.memberResource.reload();
        await this.offerDeactivate(name);
      } else {
        this.toaster.error(this.errorMessage(result.error));
        if (isForbidden(result.error)) this.memberResource.reload();
      }
      return;
    }
    this.toaster.success(this.transloco.translate(`${K}.toast.deleted`));
    void this.store.reload();
    this.close();
  }

  private async offerDeactivate(name: string): Promise<void> {
    if (!this.canDeactivate()) {
      this.toaster.error(this.transloco.translate(`${K}.errors.STAFF_IN_USE`));
      return;
    }
    const answer = await this.confirmation.open({
      title: this.transloco.translate(`${K}.inUse.title`),
      message: this.transloco.translate(`${K}.inUse.message`, { name }),
      confirmLabel: this.transloco.translate(`${K}.inUse.deactivate`),
      cancelLabel: this.transloco.translate(`${K}.inUse.cancel`),
      severity: 'warning',
    });
    if (answer !== 'confirmed') return;
    const member = this.member();
    if (member === null) return;
    this.acting.set(true);
    const result = await firstValueFrom(this.api.setActive(member.id, false));
    this.acting.set(false);
    if (!result.isSuccess) {
      const count = upcomingCountOf(result.error);
      this.toaster.error(
        count === null
          ? this.errorMessage(result.error)
          : this.transloco.translate(`${K}.deactivate.upcoming`, { count }),
      );
      return;
    }
    this.memberResource.set(result);
    void this.store.reload();
    this.toaster.success(this.transloco.translate(`${K}.toast.deactivated`));
  }

  private confirmDiscard(): Promise<boolean> {
    return this.confirmation
      .open({
        title: this.transloco.translate(`${K}.discard.title`),
        message: this.transloco.translate(`${K}.discard.message`),
        confirmLabel: this.transloco.translate(`${K}.discard.discard`),
        cancelLabel: this.transloco.translate(`${K}.discard.keep`),
        severity: 'warning',
      })
      .then((answer) => answer === 'confirmed');
  }

  private editors(): StaffTabEditor[] {
    return [this.profileTab(), this.servicesTab(), this.hoursTab()].filter(
      (editor): editor is NonNullable<typeof editor> => editor !== undefined,
    );
  }

  private close(): void {
    void this.router.navigate(['..'], { relativeTo: this.route });
  }
}

/** A `tab` query value as a tab. Anything unknown is the profile. */
function toTab(value: string | null): StaffTabId {
  return TABS.find((tab) => tab === value) ?? 'profile';
}

function fullName(member: StaffMemberResponse): string {
  return `${member.firstName} ${member.lastName}`.trim();
}

/** A rank or self refusal: the flags were stale, so the member reads again. */
function isForbidden(error: HttpError): boolean {
  return (
    error.errorCode === 'STAFF_OUTRANKS_CALLER' || error.errorCode === 'STAFF_CANNOT_CHANGE_SELF'
  );
}

/** The end of a navigation. A superseded one is not: the navigation after it decides. */
function settled(event: RouterEvent): boolean {
  return (
    event instanceof NavigationEnd ||
    event instanceof NavigationSkipped ||
    event instanceof NavigationError ||
    (event instanceof NavigationCancel &&
      event.code !== NavigationCancellationCode.SupersededByNewNavigation)
  );
}

import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormField } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { provideTranslocoScope, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucidePencil, LucideSave, LucideShieldCheck } from '@lucide/angular';
import { firstValueFrom, map } from 'rxjs';
import { StaffAccessStore } from '@auth/data-access';
import { injectErrorMessageResolver } from '@synax/client';
import { injectFormErrors } from '@synax/forms';
import { formEditor, type FormFailure } from '@util/forms';
import { Banner } from '@ui/banner';
import { Button, ButtonIcon } from '@ui/button';
import { Drawer, DrawerActions, DrawerHeader, DrawerToolbar } from '@ui/drawer';
import { Field, FieldControl, FieldEditor, FormErrors, FormHost } from '@ui/form-field';
import { InputText } from '@ui/input-text';
import { Textarea } from '@ui/textarea';
import { ToasterService } from '@ui/toaster';
import { Tree, TreeModel, TreeNodeTemplate, type TreeNode } from '@ui/tree';

import { rolesTranslocoScope } from '../roles.i18n';
import { categoryLabel, permissionLabel, roleLabel } from '../roles.labels';
import { RolesApi } from '../roles.api';
import { ROLE_ERROR_FIELDS, ROLE_FIELDS } from '../roles.form';
import { RolesStore } from '../roles.store';
import type { RoleFormValue, RoleResponse } from '../roles.types';
import {
  buildPermissionTree,
  grantedPermissions,
  selectedCodes,
} from './permission-tree/permission-tree';
import type {
  PermissionNodeData,
  PermissionTreeLabels,
} from './permission-tree/permission-tree.types';

/** The route parameter that means "not a role yet". */
const NEW_ROLE = 'new';

/**
 * One role, read and edited beside the list rather than in place of it.
 *
 * The panel is the route: `roles/new` and `roles/<id>` are addresses a user can bookmark and the
 * browser can go back from. The drawer is non-modal on purpose — the grid behind it stays
 * readable and usable while the panel is open — so closing it is the route's own business, and
 * `closed` navigates back to the list once the exit transition has finished.
 *
 * `new` and a role id are **one** route rather than two, so a create can move from the first to
 * the second without the outlet tearing this component down and the drawer sliding shut and open
 * again on a role the user has just made.
 *
 * View and edit are **not** addresses. They are the editor's mode, so switching between them
 * cannot re-render the panel either. The cost is that edit mode is not bookmarkable and a reload
 * lands in view; that is the accepted trade for a drawer that never flickers.
 *
 * The form itself is a {@link formEditor}: it holds validation back until save is pressed, keeps
 * it live afterwards, and puts what a refused write said either on the field it names or in the
 * area above the form. None of that is this panel's code.
 */
@Component({
  selector: 'lib-role-details',
  imports: [
    Banner,
    Button,
    ButtonIcon,
    Drawer,
    DrawerHeader,
    DrawerActions,
    DrawerToolbar,
    Field,
    FieldControl,
    FieldEditor,
    FormErrors,
    FormField,
    FormHost,
    InputText,
    LucidePencil,
    LucideSave,
    LucideShieldCheck,
    Textarea,
    TranslocoPipe,
    Tree,
    TreeNodeTemplate,
  ],
  templateUrl: './role-details.html',
  styleUrl: './role-details.scss',
  providers: [provideTranslocoScope(rolesTranslocoScope)],
})
export class RoleDetails {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly transloco = inject(TranslocoService);
  private readonly api = inject(RolesApi);
  private readonly store = inject(RolesStore);
  private readonly access = inject(StaffAccessStore);
  private readonly toaster = inject(ToasterService);
  private readonly errorMessage = injectErrorMessageResolver();
  private readonly formErrors = injectFormErrors();

  /**
   * Open the moment the route renders, and writable so the drawer can shut itself. A constant
   * `true` in the template would be re-applied by nothing once it did, leaving the panel shut
   * and the route still on the role.
   */
  protected readonly open = signal(true);

  /** The role this panel holds, or {@link NEW_ROLE}. Tracked, because a create changes it. */
  private readonly roleId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('roleId') ?? NEW_ROLE)),
    { initialValue: NEW_ROLE },
  );

  /**
   * The role, fetched per address. `params` returning `undefined` holds it idle, which is what
   * keeps a create from asking the server for a role that does not exist yet.
   */
  private readonly roleResource = rxResource({
    params: () => (this.roleId() === NEW_ROLE ? undefined : this.roleId()),
    stream: ({ params }) => this.api.role(params),
  });

  protected readonly role = computed<RoleResponse | null>(() => {
    const result = this.roleResource.value();
    return result?.isSuccess ? result.data : null;
  });

  protected readonly roleLoading = computed(() => this.roleResource.isLoading());

  /** Why the role is not here, translated, or the empty string while it is. */
  protected readonly roleError = computed(() => {
    if (this.roleResource.isLoading()) return '';
    const result = this.roleResource.value();
    if (result === undefined || result.isSuccess) return '';
    return this.errorMessage(result.error);
  });

  private readonly model = signal<RoleFormValue>({ name: '', description: '' });

  /**
   * Name and description only. The tree's selection is keys, and a category key is this
   * component's invention rather than anything the server accepts, so binding it to a form
   * field named `permissions` would put a value in the model that no request may carry. The
   * codes are derived at submit time instead.
   *
   * `resetOn` is the address: arriving at a different role resets the mode — a create becomes a
   * view of the role it made — and closes the validation gate, so a fresh editor starts silent
   * whatever the last one reported.
   */
  protected readonly editor = formEditor({
    model: this.model,
    fields: ROLE_FIELDS,
    resetOn: () => this.roleId(),
    mode: (id) => (id === NEW_ROLE ? 'create' : 'view'),
    action: () => this.write(),
  });

  /**
   * The server says which role can be edited at all. `roles:update` says whether this user can.
   * `isEditable` does not read the caller's codes.
   */
  protected readonly canEdit = computed(
    () => this.role()?.isEditable === true && this.access.has('roles:update'),
  );

  /**
   * The panel's title. Translated imperatively rather than through the pipe, because which key
   * it reads depends on the mode.
   */
  protected readonly heading = computed(() => {
    // Read so the heading rebuilds when the language changes.
    this.transloco.getActiveLang();
    if (this.editor.creating()) return this.translate('new');
    const role = this.role();
    if (role === null || role.name.length === 0) return this.translate('role');
    return roleLabel(this.transloco, role);
  });

  /**
   * The name view mode reads, which is not the one the model holds.
   *
   * The model is the write's, so it stays the server's raw string. A seeded role's name is an
   * identifier stored in English and labelled only on the client, and that label is what a
   * reader must see.
   */
  protected readonly viewedName = computed(() => {
    // Read so the name rebuilds when the language changes.
    this.transloco.getActiveLang();
    const role = this.role();
    return role === null ? '' : roleLabel(this.transloco, role);
  });

  /** The tree's selection: permission codes, plus a category key per fully selected group. */
  protected readonly selection = signal<readonly string[]>([]);

  protected readonly permissionsLoading = this.store.permissionsLoading;

  /**
   * The whole catalog, which is what edit mode has to offer — the role's codes ticked, the rest
   * unticked, and the ones the caller cannot grant disabled.
   *
   * A plain signal written from an effect, not a `computed`: `TreeModel`'s constructor writes
   * the signals its nodes are made of, which a reactive computation forbids. Holding one model
   * identity between renders is what keeps expansion and selection from being dropped, so the
   * category text is not baked in here — the row template translates it.
   */
  protected readonly editTree = signal(new TreeModel<PermissionNodeData>());

  /** Only the codes the role holds, which is the whole of what view mode has to say. */
  protected readonly viewTree = signal(new TreeModel<PermissionNodeData>());

  /** Why the catalog is not here, translated, or the empty string while it is. */
  protected readonly catalogError = computed(() => {
    const error = this.store.permissionsError();
    return error === null ? '' : this.errorMessage(error);
  });

  /**
   * What the tree calls a row.
   *
   * Read per build rather than baked in here, so a node's own label is the active language's.
   * Switching language does not rebuild the model — {@link rowLabel} is what relabels the rows
   * on screen, and discarding the model would discard what the user has ticked.
   */
  private readonly treeLabels: PermissionTreeLabels = {
    category: (category) => categoryLabel(this.transloco, category),
    permission: (permission) => permissionLabel(this.transloco, permission),
  };

  constructor() {
    this.store.requestPermissions();

    // The catalog is the whole of the edit tree, so it is rebuilt with the catalog alone.
    effect(() => {
      const permissions = this.store.permissions();
      untracked(() => {
        this.editTree.set(buildPermissionTree(permissions, this.treeLabels));
      });
    });

    // The view tree is the catalog narrowed to the role, so it needs both.
    effect(() => {
      const permissions = this.store.permissions();
      const held = this.role()?.permissions ?? [];
      untracked(() => {
        this.viewTree.set(
          buildPermissionTree(grantedPermissions(permissions, held), this.treeLabels),
        );
      });
    });

    // The form and the ticks are the role's, reset whenever a different role arrives. Writing
    // them here rather than on the Edit press is what makes a refused save recoverable: the
    // editor keeps what the user typed until the role itself is refetched.
    effect(() => {
      const role = this.role();
      untracked(() => {
        this.editor.reset({ name: role?.name ?? '', description: role?.description ?? '' });
        this.selection.set(role?.permissions ?? []);
      });
    });
  }

  /** Back to the list, which is this route's parent. */
  protected returnToList(): void {
    void this.router.navigate(['..'], { relativeTo: this.route });
  }

  /** Turns the panel into the editor. Refused unless {@link canEdit} allows it. */
  protected edit(): void {
    if (this.canEdit()) {
      this.editor.mode.set('edit');
    }
  }

  /**
   * Discards the edit.
   *
   * An edit has a view to go back to, so cancelling returns to it rather than throwing the panel
   * away — the user asked to stop editing, not to stop reading. A create has nothing behind it,
   * so it closes; the drawer's exit transition is what navigates.
   */
  protected cancel(): void {
    if (this.editor.creating()) {
      this.open.set(false);
      return;
    }

    // Puts back what the role says, so reopening the editor does not show the abandoned edit.
    const role = this.role();
    this.editor.reset({ name: role?.name ?? '', description: role?.description ?? '' });
    this.selection.set(role?.permissions ?? []);
    this.editor.mode.set('view');
  }

  /** Writes the role. The editor validates first and reports whatever the write refuses with. */
  protected save(): void {
    void this.editor.commit();
  }

  /** Re-requests a catalog that failed. */
  protected reloadPermissions(): void {
    this.store.reloadPermissions();
  }

  /** Re-requests a role that failed. */
  protected reloadRole(): void {
    this.roleResource.reload();
  }

  /**
   * A row's visible text.
   *
   * Read per render rather than baked into the node, so switching language relabels the
   * categories without rebuilding the model and discarding what the user has ticked.
   */
  protected rowLabel(node: TreeNode<PermissionNodeData>): string {
    const data = node.data();
    return data.kind === 'category'
      ? this.treeLabels.category(data.category)
      : this.treeLabels.permission(data.permission);
  }

  /**
   * The write itself.
   *
   * A create replaces `new` in history rather than pushing the new id, so the back button
   * returns to the list instead of reopening a blank create form the user has finished with,
   * and the new address resets the mode to a view of what was just made. An edit stays where it
   * is and goes back to view.
   */
  private async write(): Promise<FormFailure | undefined> {
    const roleId = this.roleId();
    const creating = this.editor.creating();
    const value = this.model();

    const request = {
      name: value.name.trim(),
      description: value.description.trim(),
      // A full replace, so this is the role's new complete set and not a diff.
      permissions: selectedCodes(this.store.permissions(), this.selection()),
    };

    const result = await firstValueFrom(
      creating ? this.api.createRole(request) : this.api.updateRole(roleId, request),
    );

    if (!result.isSuccess) {
      return this.formErrors(result.error, ROLE_ERROR_FIELDS);
    }

    this.store.roleWritten();
    this.toaster.success(this.translate(creating ? 'created' : 'updated'));

    if (creating && result.data !== null) {
      await this.router.navigate(['..', result.data.id], {
        relativeTo: this.route,
        replaceUrl: true,
      });
    } else {
      // The response is the saved role, so the view reads it without a second request.
      this.roleResource.set(result);
      this.editor.mode.set('view');
    }
    return undefined;
  }

  private translate(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`managementRoles.details.${key}`, params);
  }
}

import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  linkedSignal,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CdkDrag, CdkDropList, moveItemInArray, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  LucideArrowLeft,
  LucideArrowRight,
  LucideEllipsisVertical,
  LucideImagePlus,
  LucideRotateCcw,
  LucideTextCursorInput,
  LucideTrash2,
  LucideX,
} from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { CompanyApi, type CompanyPhotoResponse } from '@api/company';
import { PageSection, type PageSectionState } from '@features/management-shared-page-sections';
import { injectErrorMessageResolver } from '@synax/client';
import { flattenValidationErrors, type HttpError } from '@synax/client/core';
import { Button, ButtonIcon } from '@ui/button';
import { ConfirmationService } from '@ui/confirmation-dialog';
import { Menu, MenuTrigger, type MenuItem } from '@ui/menu';
import { ProgressSpinner } from '@ui/progress';
import { ToasterService } from '@ui/toaster';
import { Tooltip } from '@ui/tooltip';

import { CompanyStore } from '../company.store';
import type { PhotoUpload } from './company-photos.types';
import { PhotoDetailsDialog } from './photo-details-dialog';

const K = 'managementCompany.photos';

/** The API's limit per shop. */
export const PHOTO_LIMIT = 20;

/** What the API accepts. Anything else is refused before an upload. */
const PHOTO_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_MAX_BYTES = 15 * 1024 * 1024;

/** The refusals that mean the list on screen is stale. */
const STALE_CODES: ReadonlySet<string> = new Set([
  'COMPANY_PHOTO_NOT_FOUND',
  'COMPANY_PHOTO_ORDER_MISMATCH',
]);

/**
 * The Photos card: the shop's photos in display order, the first being the main one on the
 * public page. Every change saves at once, so the card registers no editor.
 *
 * One queue sends the files one at a time, in the order chosen, each as a tile with a spinner. A
 * drag or a tile's menu reorders. A reorder waits for the queue and for the reorder before it.
 */
@Component({
  selector: 'lib-company-photos',
  imports: [
    Button,
    ButtonIcon,
    CdkDrag,
    CdkDropList,
    LucideEllipsisVertical,
    LucideImagePlus,
    LucideRotateCcw,
    LucideX,
    Menu,
    MenuTrigger,
    PageSection,
    PhotoDetailsDialog,
    ProgressSpinner,
    Tooltip,
    TranslocoPipe,
  ],
  templateUrl: './company-photos.html',
  styleUrl: './company-photos.scss',
})
export class CompanyPhotos {
  private readonly api = inject(CompanyApi);
  private readonly store = inject(CompanyStore);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly errorMessage = injectErrorMessageResolver();
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  private readonly chooser = viewChild<ElementRef<HTMLInputElement>>('chooser');
  private readonly menuTriggers = viewChildren<unknown, ElementRef<HTMLButtonElement>>(
    'menuTrigger',
    { read: ElementRef },
  );
  private readonly addButton = viewChild<unknown, ElementRef<HTMLButtonElement>>('addButton', {
    read: ElementRef,
  });

  protected readonly canEdit = this.store.canEdit;
  protected readonly limit = PHOTO_LIMIT;

  private readonly resource = rxResource({
    stream: () => this.api.photos(),
  });

  /** The saved photos in display order. A move shows here before the API answers. */
  protected readonly photos = linkedSignal<readonly CompanyPhotoResponse[]>(() => {
    const result = this.resource.hasValue() ? this.resource.value() : undefined;
    return result?.isSuccess === true ? (result.data ?? []) : [];
  });

  /** The files waiting or on their way up, and the ones that failed. */
  protected readonly uploads = signal<readonly PhotoUpload[]>([]);
  private nextKey = 0;
  /** The queue runs. A file chosen meanwhile joins it. */
  private sending = false;
  private destroyed = false;

  protected readonly uploading = computed(() =>
    this.uploads().some((upload) => upload.error === null),
  );

  /** A reorder waits for the answer to the one before it. */
  protected readonly reordering = signal(false);

  /** The order cannot change: a reorder or an upload would answer with a list that omits it. */
  protected readonly ordering = computed(() => this.uploading() || this.reordering());

  protected readonly state = computed<PageSectionState>(() => {
    const result = this.resource.hasValue() ? this.resource.value() : undefined;
    if (result?.isSuccess === true) return 'ready';
    if (this.resource.status() === 'error' || result?.isFailure === true) return 'error';
    return 'loading';
  });

  /** Room for this many more, the running uploads counted. */
  protected readonly room = computed(
    () =>
      PHOTO_LIMIT -
      this.photos().length -
      this.uploads().filter((upload) => upload.error === null).length,
  );

  /** The text a screen reader hears for each photo. One with no description reads its place. */
  protected readonly tiles = computed(() => {
    const language = this.store.language();
    const ordering = this.ordering();
    return this.photos().map((photo, index) => {
      const label = this.transloco.translate(`${K}.photo`, { n: index + 1 });
      return {
        photo,
        alt: photo.altTexts.find((entry) => entry.languageCode === language)?.altText ?? label,
        menuLabel: this.transloco.translate(`${K}.menu`, { n: index + 1 }),
        items: this.menuItems(photo, index, ordering),
      };
    });
  });

  /** The photo whose description is open. */
  protected readonly describing = signal<CompanyPhotoResponse | null>(null);
  protected readonly describeOpen = signal(false);

  /** What the live region says after a move from the menu. */
  protected readonly announcement = signal('');

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });
  }

  protected retry(): void {
    this.resource.reload();
  }

  protected choose(): void {
    this.chooser()?.nativeElement.click();
  }

  /** Refuses what the API would refuse, then queues the rest. */
  protected onChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const chosen = Array.from(input.files ?? []);
    input.value = '';
    if (chosen.length === 0 || !this.canEdit()) return;

    const accepted = chosen.filter(
      (file) => PHOTO_TYPES.includes(file.type) && file.size <= PHOTO_MAX_BYTES,
    );
    if (accepted.length < chosen.length) {
      this.toaster.error(this.transloco.translate(`${K}.invalid`));
    }
    const room = Math.max(0, this.room());
    if (accepted.length > room) this.toaster.error(this.roomMessage(room));
    this.enqueue(accepted.slice(0, room));
  }

  protected dismiss(key: number): void {
    this.uploads.update((uploads) => uploads.filter((upload) => upload.key !== key));
  }

  /** Puts a failed file back in the queue. */
  protected retryUpload(key: number): void {
    if (!this.canEdit()) return;
    this.uploads.update((uploads) =>
      uploads.map((upload) => (upload.key === key ? { ...upload, error: null } : upload)),
    );
    void this.send();
  }

  protected onDrop(event: CdkDragDrop<readonly CompanyPhotoResponse[]>): void {
    void this.move(event.previousIndex, event.currentIndex);
  }

  protected describe(photo: CompanyPhotoResponse): void {
    if (!this.canEdit()) return;
    this.describing.set(photo);
    this.describeOpen.set(true);
  }

  protected onDescribed(saved: CompanyPhotoResponse): void {
    this.photos.update((photos) => photos.map((photo) => (photo.id === saved.id ? saved : photo)));
  }

  private enqueue(files: readonly File[]): void {
    if (files.length === 0) return;
    const added = files.map((file): PhotoUpload => ({
      key: this.nextKey++,
      name: file.name,
      file,
      error: null,
    }));
    this.uploads.update((uploads) => [...uploads, ...added]);
    void this.send();
  }

  /**
   * Sends the queue in order, one file at a time, so the API appends the photos in the order
   * chosen. It stops when the card goes away: a later request would carry another shop's id.
   */
  private async send(): Promise<void> {
    if (this.sending) return;
    this.sending = true;
    try {
      for (;;) {
        const next = this.uploads().find((upload) => upload.error === null);
        if (next === undefined || this.destroyed) return;
        const result = await firstValueFrom(
          this.api.uploadPhoto(next.file).pipe(takeUntilDestroyed(this.destroyRef)),
          { defaultValue: null },
        );
        if (result === null) return;
        if (result.isSuccess) {
          if (result.data !== null) this.addPhoto(result.data);
          this.dismiss(next.key);
          continue;
        }
        if (result.error.errorCode === 'COMPANY_PHOTO_LIMIT_REACHED') {
          // The rest cannot fit either.
          this.uploads.update((uploads) => uploads.filter((upload) => upload.error !== null));
          this.toaster.error(this.transloco.translate(`${K}.limitReached`, { max: PHOTO_LIMIT }));
          return;
        }
        const message = this.fileError(result.error);
        this.uploads.update((uploads) =>
          uploads.map((upload) =>
            upload.key === next.key ? { ...upload, error: message } : upload,
          ),
        );
      }
    } finally {
      this.sending = false;
    }
  }

  /** A reload can bring a new photo before its upload answers. */
  private addPhoto(photo: CompanyPhotoResponse): void {
    this.photos.update((photos) =>
      photos.some((candidate) => candidate.id === photo.id) ? photos : [...photos, photo],
    );
  }

  private roomMessage(room: number): string {
    if (room === 0) return this.transloco.translate(`${K}.limitReached`, { max: PHOTO_LIMIT });
    if (room === 1) return this.transloco.translate(`${K}.overLimitOne`);
    return this.transloco.translate(`${K}.overLimit`, { count: room });
  }

  /** Shows the new order at once, then saves it. A refusal puts the old order back. */
  private async move(from: number, to: number): Promise<boolean> {
    if (from === to || !this.canEdit() || this.ordering()) return false;
    const before = this.photos();
    const after = [...before];
    moveItemInArray(after, from, to);
    this.photos.set(after);

    this.reordering.set(true);
    const result = await firstValueFrom(
      this.api.reorderPhotos({ photoIds: after.map((photo) => photo.id) }),
    );
    this.reordering.set(false);
    if (result.isSuccess) {
      if (result.data !== null) this.photos.set(result.data);
      return true;
    }
    this.photos.set(before);
    if (STALE_CODES.has(result.error.errorCode)) {
      this.toaster.error(this.errorMessage(result.error));
      this.resource.reload();
    } else {
      this.toaster.error(this.transloco.translate(`${K}.reorderFailed`));
    }
    return false;
  }

  /** A move from the menu: the keyboard's way to reorder. Focus follows the photo. */
  private async moveBy(photo: CompanyPhotoResponse, step: -1 | 1): Promise<void> {
    const from = this.photos().findIndex((candidate) => candidate.id === photo.id);
    const to = from + step;
    if (from < 0 || to < 0 || to >= this.photos().length) return;
    const moved = await this.move(from, to);
    const at = moved ? to : from;
    if (moved) this.announcement.set(this.transloco.translate(`${K}.moved`, { to: at + 1 }));
    afterNextRender(() => this.menuTriggers().at(at)?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  private async remove(photo: CompanyPhotoResponse): Promise<void> {
    if (!this.canEdit()) return;
    const answer = await this.confirmation.open({
      title: this.transloco.translate(`${K}.deleteTitle`),
      message: this.transloco.translate(`${K}.deleteMessage`),
      confirmLabel: this.transloco.translate('managementCompany.actions.delete'),
      cancelLabel: this.transloco.translate('managementCompany.actions.cancel'),
      severity: 'error',
    });
    if (answer !== 'confirmed') return;
    const result = await firstValueFrom(this.api.deletePhoto(photo.id));
    if (!result.isSuccess) {
      this.toaster.error(this.errorMessage(result.error));
      if (STALE_CODES.has(result.error.errorCode)) this.resource.reload();
      return;
    }
    const at = this.photos().findIndex((candidate) => candidate.id === photo.id);
    this.photos.update((photos) => photos.filter((candidate) => candidate.id !== photo.id));
    this.toaster.success(this.transloco.translate(`${K}.deleted`));
    // The menu that had focus went with its tile: the next photo's takes it, else Add.
    afterNextRender(
      () => {
        const triggers = this.menuTriggers();
        const target = triggers.at(Math.min(at, triggers.length - 1)) ?? this.addButton();
        target?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  private menuItems(
    photo: CompanyPhotoResponse,
    index: number,
    ordering: boolean,
  ): readonly MenuItem[] {
    const last = this.photos().length - 1;
    return [
      {
        label: this.transloco.translate(`${K}.moveEarlier`),
        icon: LucideArrowLeft,
        disabled: ordering || index === 0,
        command: () => void this.moveBy(photo, -1),
      },
      {
        label: this.transloco.translate(`${K}.moveLater`),
        icon: LucideArrowRight,
        disabled: ordering || index === last,
        command: () => void this.moveBy(photo, 1),
      },
      {
        label: this.transloco.translate(`${K}.describe`),
        icon: LucideTextCursorInput,
        command: () => {
          this.describe(photo);
        },
      },
      { separator: true },
      {
        label: this.transloco.translate(`${K}.delete`),
        icon: LucideTrash2,
        danger: true,
        command: () => void this.remove(photo),
      },
    ];
  }

  /** The refusal on the file, in this page's words when it has them. */
  private fileError(error: HttpError): string {
    const code = flattenValidationErrors(error).at(0)?.code ?? error.errorCode;
    const key = `managementCompany.errors.${code}`;
    const copy = this.transloco.translate(key);
    return copy !== key && copy !== '' ? copy : this.errorMessage(error);
  }
}

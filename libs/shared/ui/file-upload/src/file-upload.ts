import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  model,
  numberAttribute,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import {
  LucideFile,
  LucideImage,
  LucideRotateCcw,
  LucideTrash2,
  LucideUpload,
  LucideX,
} from '@lucide/angular';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { claimFieldError } from '@util/forms';
import { Banner } from '@ui/banner';
import { Button } from '@ui/button';
import { ProgressBar } from '@ui/progress';
import { Tooltip } from '@ui/tooltip';
import type {
  FileUploadErrorEvent,
  FileUploadHandler,
  FileUploadItem,
  FileUploadMode,
  FileUploadRejection,
  FileUploadRejectionCode,
  FileUploadSuccessEvent,
} from './file-upload.types';

let nextItemId = 0;
let nextControlId = 0;

const clampProgress = (value: number): number => Math.min(100, Math.max(0, Math.round(value)));

/**
 * `numberAttribute` passes NaN, negatives and fractions through. Zero means unlimited
 * here, so anything not a positive finite number collapses to it — a negative `maxFiles`
 * once left zero slots and rejected every file.
 */
const normalizeLimit = (value: number): number =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

/** A translated queue summary: the key plus whatever it interpolates. */
interface FileUploadLiveMessage {
  readonly key: string;
  readonly params: Readonly<Record<string, number>>;
}

class FileUploadTransportError extends Error {
  constructor(
    readonly key: string,
    readonly params?: Readonly<Record<string, string | number>>,
  ) {
    super(key);
  }
}

@Component({
  selector: 'lib-file-upload',
  imports: [
    Banner,
    Button,
    LucideFile,
    LucideImage,
    LucideRotateCcw,
    LucideTrash2,
    LucideUpload,
    LucideX,
    ProgressBar,
    Tooltip,
    TranslocoPipe,
    UiCopyPipe,
  ],
  templateUrl: './file-upload.html',
  styleUrl: './file-upload.scss',
  providers: [
    provideTranslocoScope({
      scope: 'fileUpload',
      loader: {
        el: () => import('./i18n/el'),
        en: () => import('./i18n/en'),
      },
    }),
  ],
  host: {
    // An unnamed group is noise in the a11y tree, and the chooser reads well alone.
    '[attr.role]': 'ariaLabel() || ariaLabelledby() ? "group" : null',
    '[attr.aria-label]': 'ariaLabel() || null',
    '[attr.aria-labelledby]': 'ariaLabelledby() || null',
    '[attr.data-mode]': 'mode()',
    '[attr.data-disabled]': 'disabled() ? "" : null',
    '[attr.data-invalid]': 'showInvalid() ? "" : null',
    '[attr.data-filled]': 'value().length ? "" : null',
    '(focusout)': 'onFocusout($event)',
    '(focusin)': 'onFocusin()',
  },
})
export class FileUpload implements FormValueControl<readonly File[]> {
  /** Selected files. Supports two-way binding and Signal Forms. */
  readonly value = model<readonly File[]>([]);

  /** Compact chooser-only UI or the complete dropzone and queue. */
  readonly mode = input<FileUploadMode>('dropzone');

  /** Endpoint used for one multipart request per file. */
  readonly uploadUrl = input('');

  /** Custom uploader. When set, it takes precedence over `uploadUrl`. */
  readonly uploadHandler = input<FileUploadHandler | undefined>(undefined);

  /** Native file-picker accept expression, for example `image/*,.pdf`. */
  readonly accept = input('');

  /** Allows more than one file. */
  readonly multiple = input(false, { transform: booleanAttribute });

  /** Maximum bytes per file. Zero — or any invalid value — is unlimited. */
  readonly maxFileSize = input(0, { transform: numberAttribute });

  /** Maximum number of queued files. Zero — or any invalid value — is unlimited. */
  readonly maxFiles = input(0, { transform: numberAttribute });

  /** Upload valid files as soon as they are added. Defaults to deferred. */
  readonly autoUpload = input(false, { transform: booleanAttribute });

  /** Multipart field name used by endpoint uploads. */
  readonly fieldName = input('file');

  /** Extra fields appended to endpoint-upload FormData. */
  readonly formData = input<Readonly<Record<string, string | Blob>>>({});

  /** Request headers for endpoint uploads. */
  readonly headers = input<Readonly<Record<string, string>>>({});

  /** Include credentials in endpoint requests. */
  readonly withCredentials = input(false, { transform: booleanAttribute });

  /** Optional dropzone heading. */
  readonly heading = input('');

  /** Optional dropzone supporting copy. */
  readonly description = input('');

  /** File-picker button text. Falls back to the active locale. */
  readonly chooseLabel = input('');

  /** Queue upload button text. Falls back to the active locale. */
  readonly uploadLabel = input('');

  /** Disabled state, bound automatically by Signal Forms. */
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Invalid state, bound automatically by Signal Forms. */
  readonly invalid = input(false, { transform: booleanAttribute });

  /** Touched state, bound automatically by Signal Forms. */
  readonly touched = input(false, { transform: booleanAttribute });

  /**
   * Required state. Rendered as a translated word in the hint line, not `aria-required`,
   * which ARIA disallows on the chooser button's role — so it still reaches everyone.
   */
  readonly required = input(false, { transform: booleanAttribute });

  /** Field errors from the schema. Bound automatically by Signal Forms. */
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);

  /** Accessible name for the whole control, e.g. "Booking attachments". */
  readonly ariaLabel = input('');

  /** `id` of the element naming the whole control. */
  readonly ariaLabelledby = input('');

  /** `id`(s) describing the chooser; the control's own ids are appended. */
  readonly ariaDescribedby = input('');

  /** Marks the field touched after focus leaves the component. */
  readonly touch = output();

  /** Emitted for the valid files added in one interaction. */
  readonly filesAdded = output<readonly File[]>();

  /** Emitted once for each rejected selection batch. */
  readonly filesRejected = output<readonly FileUploadRejection[]>();

  /** Emitted after an individual file upload succeeds. */
  readonly uploadSuccess = output<FileUploadSuccessEvent>();

  /** Emitted after an individual file upload fails. */
  readonly uploadError = output<FileUploadErrorEvent>();

  /** Emitted after an individual item is removed. */
  readonly fileRemoved = output<File>();

  /** Emitted after all files and validation messages are cleared. */
  readonly filesCleared = output();

  protected readonly inputId = `lib-file-upload-${nextControlId++}`;
  protected readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  protected readonly dragging = signal(false);
  private readonly mutableItems = signal<readonly FileUploadItem[]>([]);
  private readonly mutableRejections = signal<readonly FileUploadRejection[]>([]);
  readonly items = this.mutableItems.asReadonly();
  readonly rejections = this.mutableRejections.asReadonly();

  protected readonly queuedItems = computed(() =>
    this.items().filter((item) => item.status === 'queued'),
  );
  protected readonly uploading = computed(() =>
    this.items().some((item) => item.status === 'uploading'),
  );

  /** Sanitised limits — see `normalizeLimit`. Use these, never the raw inputs. */
  protected readonly safeMaxFileSize = computed(() => normalizeLimit(this.maxFileSize()));
  protected readonly safeMaxFiles = computed(() => normalizeLimit(this.maxFiles()));

  private readonly blurred = signal(false);

  /** True between opening the native picker and focus coming back. */
  private readonly picking = signal(false);

  /**
   * True once first paint is behind us. `animate.enter` fires on initial render too, so a
   * pre-filled `value` would flick its whole queue into view on load.
   */
  protected readonly mounted = signal(false);

  protected readonly firstError = computed(() => this.errors().at(0));

  /** Errors surface once touched, so a pre-filled value accuses nobody. */
  protected readonly showError = computed(
    () => (this.touched() || this.blurred()) && !!this.firstError(),
  );

  /** `required` is the only kind with a message of its own; the rest share one. */
  protected readonly errorKey = computed(() =>
    this.firstError()?.kind === 'required'
      ? 'fileUpload.errors.required'
      : 'fileUpload.errors.invalid',
  );

  /**
   * Signal Forms drives `invalid` off the schema, so a required field is invalid before
   * anyone touches it — red on load. Where there is an error to gate on, styling follows
   * the same touched rule as the message. A bare `[invalid]` with no errors is the
   * consumer's explicit instruction and paints at once.
   */
  protected readonly showInvalid = computed(
    () =>
      this.rejections().length > 0 || this.showError() || (this.invalid() && !this.firstError()),
  );

  protected readonly showMessages = computed(
    () => this.showError() || this.rejections().length > 0,
  );

  /** Consumer-supplied ids first; the control appends its own, never replaces them. */
  protected readonly describedBy = computed(
    () =>
      [this.ariaDescribedby(), this.showMessages() ? `${this.inputId}-errors` : '']
        .filter(Boolean)
        .join(' ') || null,
  );

  /**
   * One summarised announcement for the queue: a live region per row would talk over
   * itself. Deliberately count-free while uploading, so a batch announces once.
   */
  protected readonly liveMessage = computed((): FileUploadLiveMessage | null => {
    const items = this.items();
    if (items.some((item) => item.status === 'uploading')) {
      return { key: 'fileUpload.live.uploading', params: {} };
    }
    const done = items.filter((item) => item.status === 'success').length;
    const failed = items.filter((item) => item.status === 'error').length;
    if (!done && !failed) {
      return null;
    }
    return {
      key: failed ? 'fileUpload.live.finishedWithErrors' : 'fileUpload.live.finished',
      params: { done, failed, total: items.length },
    };
  });

  private readonly controllers = new Map<string, AbortController>();
  constructor() {
    claimFieldError();
    // Sync external values with the richer queue by File reference, so retained files
    // keep their status and preview URLs.
    effect(() => {
      const files = this.value();
      const current = new Map(this.mutableItems().map((item) => [item.file, item] as const));
      const next = files.map((file) => current.get(file) ?? this.createItem(file));
      for (const item of current.values()) {
        if (!files.includes(item.file)) {
          this.disposeItem(item);
        }
      }
      if (
        next.length !== this.mutableItems().length ||
        next.some((item, index) => item !== this.mutableItems()[index])
      ) {
        this.mutableItems.set(next);
      }
    });

    afterNextRender(() => {
      this.mounted.set(true);
    });

    inject(DestroyRef).onDestroy(() => {
      for (const item of this.mutableItems()) {
        this.disposeItem(item);
      }
    });
  }

  /** Opens the native picker. Safe to call from consumer code. */
  choose(): void {
    if (!this.disabled()) {
      // The OS picker pulls focus off the document, firing a focusout that looks like a blur.
      this.picking.set(true);
      this.fileInput().nativeElement.click();
    }
  }

  /** Validates and adds files supplied by a picker, drop, or consumer code. */
  addFiles(files: Iterable<File>): void {
    if (this.disabled()) {
      return;
    }
    const candidates = Array.from(files);

    const accepted: File[] = [];
    const rejected: FileUploadRejection[] = [];
    const existing = this.value();
    const validationExisting = this.multiple() ? existing : [];
    let available = this.multiple()
      ? this.safeMaxFiles()
        ? Math.max(0, this.safeMaxFiles() - existing.length)
        : Number.POSITIVE_INFINITY
      : 1;

    for (const file of candidates) {
      const code = this.rejectionCode(file, validationExisting, accepted, available);
      if (code) {
        rejected.push({ file, code });
        continue;
      }
      accepted.push(file);
      available -= 1;
    }

    this.mutableRejections.set(rejected);
    if (rejected.length) {
      this.filesRejected.emit(rejected);
    }
    if (!accepted.length) {
      return;
    }

    const next = this.multiple() ? [...existing, ...accepted] : accepted;
    const retained = this.multiple() ? this.mutableItems() : [];
    if (!this.multiple()) {
      for (const item of this.mutableItems()) {
        this.disposeItem(item);
      }
    }
    this.mutableItems.set([...retained, ...accepted.map((file) => this.createItem(file))]);
    this.value.set(next);
    this.filesAdded.emit(accepted);

    if (this.autoUpload()) {
      queueMicrotask(() => void this.upload());
    }
  }

  /** Uploads all queued files, or the supplied item IDs, concurrently. */
  async upload(itemIds?: readonly string[]): Promise<void> {
    if (this.disabled()) {
      return;
    }
    const ids = itemIds ? new Set(itemIds) : undefined;
    const pending = this.mutableItems().filter(
      (item) => item.status === 'queued' && (!ids || ids.has(item.id)),
    );
    await Promise.all(pending.map((item) => this.uploadItem(item)));
  }

  /** Resets a failed or canceled item and uploads it again. */
  async retry(itemOrId: FileUploadItem | string): Promise<void> {
    const id = typeof itemOrId === 'string' ? itemOrId : itemOrId.id;
    this.updateItem(id, {
      status: 'queued',
      progress: 0,
      error: undefined,
      errorKey: undefined,
      errorParams: undefined,
    });
    await this.upload([id]);
  }

  /** Aborts an active upload and keeps its item available for retry. */
  cancel(itemOrId: FileUploadItem | string): void {
    const id = typeof itemOrId === 'string' ? itemOrId : itemOrId.id;
    this.controllers.get(id)?.abort();
  }

  /** Removes one queued item and releases any generated preview. */
  remove(itemOrId: FileUploadItem | string): void {
    const id = typeof itemOrId === 'string' ? itemOrId : itemOrId.id;
    const item = this.mutableItems().find((candidate) => candidate.id === id);
    if (!item) {
      return;
    }
    this.controllers.get(id)?.abort();
    this.disposeItem(item);
    this.mutableItems.update((items) => items.filter((candidate) => candidate.id !== id));
    this.value.set(this.value().filter((file) => file !== item.file));
    this.fileRemoved.emit(item.file);
  }

  /** Clears the queue, validation feedback, and active uploads. */
  clear(): void {
    for (const controller of this.controllers.values()) {
      controller.abort();
    }
    this.mutableRejections.set([]);
    for (const item of this.mutableItems()) {
      this.disposeItem(item);
    }
    this.mutableItems.set([]);
    this.value.set([]);
    this.filesCleared.emit();
  }

  protected onInputChange(event: Event): void {
    this.picking.set(false);
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(input.files);
    }
    // Selecting the same file again must still produce a change event.
    input.value = '';
  }

  protected onDragOver(event: DragEvent): void {
    if (this.disabled()) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.dragging.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    const current = event.currentTarget as HTMLElement;
    if (!current.contains(event.relatedTarget as Node | null)) {
      this.dragging.set(false);
    }
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (!this.disabled() && event.dataTransfer?.files) {
      this.addFiles(event.dataTransfer.files);
    }
  }

  protected onFocusout(event: FocusEvent): void {
    // Opening the picker is not a blur: treating it as one painted the validation error
    // while the dialog was still open.
    if (this.picking()) {
      return;
    }
    const host = event.currentTarget as HTMLElement;
    if (!host.contains(event.relatedTarget as Node | null)) {
      this.blurred.set(true);
      this.touch.emit();
    }
  }

  /** Focus is back in the control, so the picker is closed either way. */
  protected onFocusin(): void {
    this.picking.set(false);
  }

  protected formatBytes(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    const units = ['KB', 'MB', 'GB'];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
  }

  private createItem(file: File): FileUploadItem {
    return {
      id: `file-upload-item-${nextItemId++}`,
      file,
      previewUrl:
        file.type.startsWith('image/') && typeof URL.createObjectURL === 'function'
          ? URL.createObjectURL(file)
          : undefined,
      status: 'queued',
      progress: 0,
    };
  }

  private disposeItem(item: FileUploadItem): void {
    this.controllers.get(item.id)?.abort();
    this.controllers.delete(item.id);
    if (item.previewUrl && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(item.previewUrl);
    }
  }

  private rejectionCode(
    file: File,
    existing: readonly File[],
    accepted: readonly File[],
    available: number,
  ): FileUploadRejectionCode | undefined {
    if (this.safeMaxFileSize() > 0 && file.size > this.safeMaxFileSize()) {
      return 'size';
    }
    if (this.accept() && !this.matchesAccept(file, this.accept())) {
      return 'type';
    }
    if ([...existing, ...accepted].some((other) => this.sameFile(other, file))) {
      return 'duplicate';
    }
    if (available <= 0) {
      return 'count';
    }
    return undefined;
  }

  private matchesAccept(file: File, accept: string): boolean {
    return accept
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
      .some((entry) => {
        if (entry.startsWith('.')) {
          return file.name.toLowerCase().endsWith(entry);
        }
        if (entry.endsWith('/*')) {
          return file.type.toLowerCase().startsWith(entry.slice(0, -1));
        }
        return file.type.toLowerCase() === entry;
      });
  }

  private sameFile(first: File, second: File): boolean {
    return (
      first === second ||
      (first.name === second.name &&
        first.size === second.size &&
        first.lastModified === second.lastModified)
    );
  }

  private async uploadItem(item: FileUploadItem): Promise<void> {
    // Cancel-then-retry can leave the old transport unwinding while the new one flies.
    // The registered controller identifies the current attempt, so a late completion
    // writes nothing and does not drop the live controller.
    const controller = new AbortController();
    this.controllers.get(item.id)?.abort();
    this.controllers.set(item.id, controller);
    const isCurrent = () => this.controllers.get(item.id) === controller;

    this.updateItem(item.id, {
      status: 'uploading',
      progress: 0,
      error: undefined,
      errorKey: undefined,
      errorParams: undefined,
    });

    try {
      const reportProgress = (progress: number) => {
        if (isCurrent()) {
          this.updateItem(item.id, { progress: clampProgress(progress) });
        }
      };
      const handler = this.uploadHandler();
      const response = handler
        ? await handler({ file: item.file, signal: controller.signal, reportProgress })
        : await this.uploadToUrl(item.file, controller.signal, reportProgress);
      if (!isCurrent()) {
        return;
      }
      this.updateItem(item.id, { status: 'success', progress: 100, response });
      const completed = this.mutableItems().find((entry) => entry.id === item.id);
      if (completed) {
        this.uploadSuccess.emit({ item: completed, response });
      }
    } catch (error) {
      if (!isCurrent()) {
        return;
      }
      const canceled = controller.signal.aborted;
      // Only a consumer's own Error message shows verbatim; it is the one string this
      // component cannot translate. Everything else uses a key, so an unknown throw never
      // renders hardcoded English over the user's locale.
      const message =
        !canceled && error instanceof Error && !(error instanceof FileUploadTransportError)
          ? error.message
          : '';
      this.updateItem(item.id, {
        status: canceled ? 'canceled' : 'error',
        error: message || undefined,
        errorKey:
          canceled || message
            ? undefined
            : error instanceof FileUploadTransportError
              ? error.key
              : 'fileUpload.errors.unknown',
        errorParams: error instanceof FileUploadTransportError ? error.params : undefined,
      });
      const failed = this.mutableItems().find((entry) => entry.id === item.id);
      if (failed && !canceled) {
        this.uploadError.emit({ item: failed, error } satisfies FileUploadErrorEvent);
      }
    } finally {
      if (isCurrent()) {
        this.controllers.delete(item.id);
      }
    }
  }

  private uploadToUrl(
    file: File,
    signal: AbortSignal,
    reportProgress: (progress: number) => void,
  ): Promise<unknown> {
    const url = this.uploadUrl();
    if (!url) {
      return Promise.reject(new FileUploadTransportError('fileUpload.errors.noUploader'));
    }

    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', url);
      request.withCredentials = this.withCredentials();
      for (const [name, value] of Object.entries(this.headers())) {
        request.setRequestHeader(name, value);
      }
      request.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          reportProgress((event.loaded / event.total) * 100);
        }
      });
      request.addEventListener('load', () => {
        if (request.status >= 200 && request.status < 300) {
          resolve(this.parseResponse(request));
        } else {
          reject(
            new FileUploadTransportError('fileUpload.errors.http', {
              status: request.status,
            }),
          );
        }
      });
      request.addEventListener('error', () => {
        reject(new FileUploadTransportError('fileUpload.errors.network'));
      });
      request.addEventListener('abort', () => {
        reject(new DOMException('Upload canceled', 'AbortError'));
      });
      signal.addEventListener(
        'abort',
        () => {
          request.abort();
        },
        { once: true },
      );

      const body = new FormData();
      body.append(this.fieldName(), file, file.name);
      for (const [name, value] of Object.entries(this.formData())) {
        body.append(name, value);
      }
      request.send(body);
    });
  }

  private parseResponse(request: XMLHttpRequest): unknown {
    const text = request.responseText;
    if (!text) {
      return undefined;
    }
    if (request.getResponseHeader('content-type')?.includes('application/json')) {
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return text;
      }
    }
    return text;
  }

  private updateItem(id: string, patch: Partial<FileUploadItem>): void {
    this.mutableItems.update((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }
}

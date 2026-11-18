import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { StaffApi, type StaffMemberResponse } from '@api/staff';
import { StaffAccessStore } from '@auth/data-access';
import { injectErrorMessageResolver } from '@synax/client';
import { Button } from '@ui/button';
import { ConfirmationService } from '@ui/confirmation-dialog';
import { Dialog, DialogFooter } from '@ui/dialog';
import { ImageCropper } from '@ui/image-cropper';
import { ToasterService } from '@ui/toaster';

import { StaffAvatar } from '../../avatar/staff-avatar';

const K = 'managementStaff.profile';

/** What the API accepts. Anything else is refused before an upload. */
const PHOTO_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/**
 * The member's photo in a dialog: the current photo with the rules for a new one, then a crop
 * step for a chosen file. It saves at once, outside edit mode. One per drawer, opened from the
 * header's photo.
 *
 * ```html
 * <lib-staff-photo #photo [member]="member()" (changed)="onMemberChanged($event)" />
 * <button (click)="photo.open()">…</button>
 * ```
 */
@Component({
  selector: 'lib-staff-photo',
  imports: [Button, Dialog, DialogFooter, ImageCropper, StaffAvatar, TranslocoPipe],
  templateUrl: './staff-photo.html',
  styleUrl: './staff-photo.scss',
})
export class StaffPhoto {
  private readonly api = inject(StaffApi);
  private readonly access = inject(StaffAccessStore);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly errorMessage = injectErrorMessageResolver();
  private readonly chooser = viewChild.required<ElementRef<HTMLInputElement>>('chooser');
  protected readonly cropper = viewChild(ImageCropper);

  /** The member on screen. `null` while none has loaded. */
  readonly member = input<StaffMemberResponse | null>(null);

  /** The member, saved with the new photo or without one. */
  readonly changed = output<StaffMemberResponse>();

  /** `members:update`, on a member who holds nothing the caller lacks. */
  readonly canEdit = computed(() => {
    const member = this.member();
    return member !== null && member.canManage && this.access.has('members:update');
  });

  /** An upload or a removal is in flight. */
  readonly busy = signal(false);

  protected readonly visible = signal(false);

  /** The file chosen for a new photo. The dialog shows the crop step while it is set. */
  protected readonly file = signal<File | null>(null);

  /** Opens the dialog on the current photo. */
  open(): void {
    if (!this.canEdit()) return;
    this.file.set(null);
    this.visible.set(true);
  }

  protected onVisibleChange(visible: boolean): void {
    // A close during an upload waits for it: the result still lands, and so does the toast.
    if (!visible && this.busy()) return;
    this.visible.set(visible);
    if (!visible) this.file.set(null);
  }

  /** Opens the native file chooser. */
  protected choose(): void {
    if (this.busy()) return;
    this.chooser().nativeElement.click();
  }

  /** A chosen file: refused here when the API would refuse it, else cropped before the upload. */
  protected onChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;
    input.value = '';
    if (file === null) return;
    if (!PHOTO_TYPES.includes(file.type) || file.size > PHOTO_MAX_BYTES) {
      this.toaster.error(this.transloco.translate('managementStaff.errors.STAFF_PHOTO_INVALID'));
      return;
    }
    this.file.set(file);
  }

  protected back(): void {
    if (!this.busy()) this.file.set(null);
  }

  protected async save(): Promise<void> {
    const member = this.member();
    const cropper = this.cropper();
    if (member === null || cropper === undefined || this.busy()) return;
    this.busy.set(true);
    // A browser with no canvas sends the photo as it is: the API crops it to the center.
    const photo = (await cropper.crop()) ?? this.file();
    if (photo === null) {
      this.busy.set(false);
      return;
    }
    const result = await firstValueFrom(this.api.uploadPhoto(member.id, photo));
    this.busy.set(false);
    if (!result.isSuccess) {
      this.toaster.error(this.errorMessage(result.error));
      return;
    }
    this.toaster.success(this.transloco.translate('managementStaff.toast.photoUpdated'));
    this.changed.emit({ ...member, avatarUrl: result.data?.avatarUrl ?? null });
    this.onVisibleChange(false);
  }

  /** Removes the photo after a confirmation. The initials show in its place. */
  protected async remove(): Promise<void> {
    const member = this.member();
    if (member === null || this.busy()) return;
    const answer = await this.confirmation.open({
      title: this.transloco.translate(`${K}.removePhotoTitle`),
      message: this.transloco.translate(`${K}.removePhotoMessage`),
      confirmLabel: this.transloco.translate(`${K}.removePhotoConfirm`),
      cancelLabel: this.transloco.translate(`${K}.removePhotoCancel`),
      severity: 'error',
    });
    if (answer !== 'confirmed') return;
    this.busy.set(true);
    const result = await firstValueFrom(this.api.deletePhoto(member.id));
    this.busy.set(false);
    if (!result.isSuccess) {
      this.toaster.error(this.errorMessage(result.error));
      return;
    }
    this.toaster.success(this.transloco.translate('managementStaff.toast.photoRemoved'));
    this.changed.emit({ ...member, avatarUrl: null });
    this.onVisibleChange(false);
  }
}

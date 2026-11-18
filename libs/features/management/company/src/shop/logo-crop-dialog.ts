import { Component, inject, input, model, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { CompanyApi } from '@api/company';
import { injectErrorMessageResolver } from '@synax/client';
import { Button } from '@ui/button';
import { Dialog, DialogFooter } from '@ui/dialog';
import { ImageCropper } from '@ui/image-cropper';
import { ToasterService } from '@ui/toaster';

/** The side of the square the API stores. A larger crop only costs bytes. */
const LOGO_OUTPUT_SIZE = 512;

/**
 * Crops a chosen file to a square and uploads it as the shop's logo. It saves at once, outside
 * edit mode.
 *
 * ```html
 * <lib-logo-crop-dialog [(visible)]="cropping" [file]="file()" (saved)="onLogo($event)" />
 * ```
 */
@Component({
  selector: 'lib-logo-crop-dialog',
  imports: [Button, Dialog, DialogFooter, ImageCropper, TranslocoPipe],
  template: `
    <!-- Nothing closes it during an upload: the result still lands, and so does the toast. -->
    <lib-dialog
      size="sm"
      [(visible)]="visible"
      [closable]="!busy()"
      [closeOnEscape]="!busy()"
      [header]="'managementCompany.shop.logo.title' | transloco"
    >
      @if (file(); as chosen) {
        <lib-image-cropper
          #cropper
          shape="square"
          [source]="chosen"
          [outputSize]="outputSize"
          [ariaLabel]="'managementCompany.shop.logo.cropArea' | transloco"
          [zoomAriaLabel]="'managementCompany.shop.logo.zoom' | transloco"
          [hint]="'managementCompany.shop.logo.hint' | transloco"
        />
      }

      <ng-template libDialogFooter>
        <button
          libButton
          type="button"
          severity="secondary"
          variant="text"
          [disabled]="busy()"
          (click)="visible.set(false)"
        >
          {{ 'managementCompany.actions.cancel' | transloco }}
        </button>
        <button
          libButton
          type="button"
          severity="primary"
          [loading]="busy()"
          [disabled]="!cropper()?.ready()"
          (click)="save()"
        >
          {{ 'managementCompany.actions.save' | transloco }}
        </button>
      </ng-template>
    </lib-dialog>
  `,
})
export class LogoCropDialog {
  private readonly api = inject(CompanyApi);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly errorMessage = injectErrorMessageResolver();

  readonly visible = model(false);
  readonly file = input<File | null>(null);

  /** The upload went through. Carries the new logo's address. */
  readonly saved = output<string | null>();

  protected readonly cropper = viewChild(ImageCropper);
  protected readonly outputSize = LOGO_OUTPUT_SIZE;

  readonly busy = signal(false);

  protected async save(): Promise<void> {
    const cropper = this.cropper();
    const file = this.file();
    if (cropper === undefined || file === null || this.busy()) return;
    this.busy.set(true);
    // A browser with no canvas sends the file as it is: the API crops it to the center.
    const cropped = await cropper.crop();
    const result = await firstValueFrom(
      this.api.uploadLogo(cropped === null ? file : logoFile(cropped)),
    );
    this.busy.set(false);
    if (!result.isSuccess) {
      this.toaster.error(this.errorMessage(result.error));
      return;
    }
    this.toaster.success(this.transloco.translate('managementCompany.shop.logo.saved'));
    this.saved.emit(result.data?.logoUrl ?? null);
    this.visible.set(false);
  }
}

/** The cropped image as a file that keeps its type: the API checks the part's `Content-Type`. */
export function logoFile(blob: Blob): File {
  const extension = blob.type === 'image/jpeg' ? 'jpg' : 'webp';
  return new File([blob], `logo.${extension}`, { type: blob.type });
}

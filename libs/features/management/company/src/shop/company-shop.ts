import { Component, computed, inject, signal, viewChild, type ElementRef } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideExternalLink, LucideImageUp, LucideStore, LucideTrash2 } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { CompanyApi } from '@api/company';
import { PageSection, type PageSectionState } from '@features/management-shared-page-sections';
import { injectErrorMessageResolver } from '@synax/client';
import { Button, ButtonIcon } from '@ui/button';
import { ConfirmationService } from '@ui/confirmation-dialog';
import { formatPhone } from '@ui/phone-input';
import { ToasterService } from '@ui/toaster';

import { CompanyStore } from '../company.store';
import { LogoCropDialog } from './logo-crop-dialog';

const K = 'managementCompany.shop.logo';

/** What the API accepts. Anything else is refused before an upload. */
const LOGO_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];
const LOGO_MAX_BYTES = 10 * 1024 * 1024;

/**
 * The Shop card: the logo, the name, the address and the contact details, with a link to the
 * public page. Only the logo changes here, and it saves at once. Support changes the rest.
 */
@Component({
  selector: 'lib-company-shop',
  imports: [
    Button,
    ButtonIcon,
    LogoCropDialog,
    LucideExternalLink,
    LucideImageUp,
    LucideStore,
    LucideTrash2,
    PageSection,
    TranslocoPipe,
  ],
  templateUrl: './company-shop.html',
  styleUrl: './company-shop.scss',
})
export class CompanyShop {
  private readonly store = inject(CompanyStore);
  private readonly api = inject(CompanyApi);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly errorMessage = injectErrorMessageResolver();
  private readonly chooser = viewChild<ElementRef<HTMLInputElement>>('chooser');

  protected readonly settings = this.store.settings;
  protected readonly canEdit = this.store.canEdit;

  protected readonly state = computed<PageSectionState>(() => {
    if (this.settings() !== null) return 'ready';
    return this.store.failed() ? 'error' : 'loading';
  });

  /** Street and neighborhood, then postal code, city and region. */
  protected readonly addressLines = computed(() => {
    const settings = this.settings();
    if (settings === null) return [];
    return [
      [settings.street, settings.neighborhood],
      [[settings.postalCode, settings.city].join(' '), settings.region],
    ].map((parts) => parts.filter((part) => part !== null && part !== '').join(', '));
  });

  protected readonly phone = computed(() => {
    const phone = this.settings()?.phone ?? '';
    return phone === '' ? '' : formatPhone(phone);
  });

  /** The public page in the language the person reads now. */
  protected readonly publicHref = computed(() => {
    const settings = this.settings();
    return settings === null
      ? null
      : `/${this.store.language()}/barbershops/${encodeURIComponent(settings.slug)}`;
  });

  /** The address without a scheme, as people say it. */
  protected readonly websiteText = computed(() =>
    (this.settings()?.website ?? '').replace(/^https?:\/\//, '').replace(/\/$/, ''),
  );

  /** Nothing checks the stored address. Without a scheme, a link would be relative to this page. */
  protected readonly websiteHref = computed(() => {
    const website = this.settings()?.website ?? '';
    return /^https?:\/\//i.test(website) ? website : `https://${website}`;
  });

  /** The file chosen for a new logo. The crop dialog shows it. */
  protected readonly file = signal<File | null>(null);
  protected readonly cropping = signal(false);

  protected readonly removing = signal(false);

  protected retry(): void {
    this.store.reload();
  }

  protected choose(): void {
    this.chooser()?.nativeElement.click();
  }

  /** A chosen file: refused here when the API would refuse it, else cropped before the upload. */
  protected onChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;
    input.value = '';
    if (file === null) return;
    if (!LOGO_TYPES.includes(file.type) || file.size > LOGO_MAX_BYTES) {
      this.toaster.error(this.transloco.translate(`${K}.invalid`));
      return;
    }
    this.file.set(file);
    this.cropping.set(true);
  }

  protected onSaved(logoUrl: string | null): void {
    this.store.setLogo(logoUrl);
    this.file.set(null);
  }

  /** Removes the logo after a confirmation. The store icon shows in its place. */
  protected async remove(): Promise<void> {
    if (this.removing()) return;
    const answer = await this.confirmation.open({
      title: this.transloco.translate(`${K}.removeTitle`),
      message: this.transloco.translate(`${K}.removeMessage`),
      confirmLabel: this.transloco.translate('managementCompany.actions.remove'),
      cancelLabel: this.transloco.translate('managementCompany.actions.cancel'),
      severity: 'error',
    });
    if (answer !== 'confirmed') return;
    this.removing.set(true);
    const result = await firstValueFrom(this.api.deleteLogo());
    this.removing.set(false);
    if (!result.isSuccess) {
      this.toaster.error(this.errorMessage(result.error));
      return;
    }
    this.store.setLogo(null);
    this.toaster.success(this.transloco.translate(`${K}.removed`));
  }
}

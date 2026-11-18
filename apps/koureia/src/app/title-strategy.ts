import { inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { BRAND } from '@util/brand';
import { readPageMeta } from '@util/language';
import { Subscription } from 'rxjs';

/**
 * Resolves route `title` values as Transloco keys so tab titles are
 * localized. Re-emits on language change, keeping the title in sync.
 *
 * A page that resolves a `PageMeta` names itself: its title is literal, not a key.
 */
@Injectable()
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly transloco = inject(TranslocoService);
  // Only the name, never the config object — see `BrandConfig`.
  private readonly brandName = inject(BRAND).name;
  private subscription?: Subscription;

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const key = this.buildTitle(snapshot);
    this.subscription?.unsubscribe();

    const pageMeta = readPageMeta(snapshot.root);
    if (pageMeta !== null) {
      this.title.setTitle(`${pageMeta.title} | ${this.brandName}`);
      return;
    }

    if (!key) {
      this.title.setTitle(this.brandName);
      return;
    }

    this.subscription = this.transloco.selectTranslate(key).subscribe((value) => {
      // Transloco echoes the key back when no translation exists.
      this.title.setTitle(value === key ? this.brandName : `${value} | ${this.brandName}`);
    });
  }
}

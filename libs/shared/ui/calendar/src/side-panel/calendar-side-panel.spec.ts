import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { TranslocoService, provideTransloco } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import type { CalendarPanel } from '../calendar.types';
import { CalendarSidePanel } from './calendar-side-panel';

// jsdom has no <dialog> methods; the drawer drives the dialog with them.
beforeAll(() => {
  HTMLDialogElement.prototype.show = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
  };
});

@Component({
  imports: [CalendarSidePanel],
  template: `
    <ng-template #filters><p class="host-filters">Seats</p></ng-template>
    <ng-template #actions><button type="button" class="host-clear">Clear all</button></ng-template>
    <lib-calendar-side-panel
      [overlay]="overlay()"
      view="day"
      [filtersTemplate]="filters"
      [filterActionsTemplate]="withActions() ? actions : null"
      [(panel)]="panel"
    />
  `,
})
class Host {
  readonly panel = signal<CalendarPanel>(null);
  readonly overlay = signal(false);
  readonly withActions = signal(true);
}

describe('CalendarSidePanel', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function dialog(): HTMLDialogElement {
    const found = root().querySelector<HTMLDialogElement>('dialog.drawer');
    if (found === null) throw new Error('drawer not rendered');
    return found;
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
      ],
    });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await settle();
    await firstValueFrom(TestBed.inject(TranslocoService).load('calendar/en'));
    await settle();
  });

  it('is closed with no panel, and never modal once open', async () => {
    expect(dialog().open).toBe(false);

    host.panel.set('filters');
    await settle();
    expect(dialog().open).toBe(true);
    expect(dialog().hasAttribute('data-modal')).toBe(false);
  });

  it('names itself after the panel it shows and draws the host filters with their footer', async () => {
    host.panel.set('filters');
    await settle();

    const labelledBy = dialog().getAttribute('aria-labelledby');
    expect(
      labelledBy === null ? '' : root().querySelector(`#${labelledBy}`)?.textContent.trim(),
    ).toBe('Filters');
    expect(root().querySelector('.host-filters')).not.toBeNull();
    expect(root().querySelector('.host-clear')).not.toBeNull();
  });

  it('swaps to the settings in place, with no footer', async () => {
    host.panel.set('filters');
    await settle();
    host.panel.set('settings');
    await settle();

    expect(dialog().open).toBe(true);
    expect(root().querySelector('.drawer-title')?.textContent.trim()).toBe('Settings');
    expect(root().querySelector('lib-calendar-settings')).not.toBeNull();
    expect(root().querySelector('.host-clear')).toBeNull();
  });

  it('draws no footer for filters without actions', async () => {
    host.withActions.set(false);
    host.panel.set('filters');
    await settle();

    expect(root().querySelector('.sp-footer')).toBeNull();
  });

  it('pushes the calendar, or slides over it at the overlay width', async () => {
    host.panel.set('filters');
    await settle();
    expect(dialog().getAttribute('data-mode')).toBe('push');

    host.overlay.set(true);
    await settle();
    expect(dialog().getAttribute('data-mode')).toBe('over');
  });

  it('writes the close back to the host', async () => {
    host.panel.set('filters');
    await settle();

    root().querySelector<HTMLButtonElement>('.drawer-close')?.click();
    await settle();
    expect(host.panel()).toBeNull();
  });
});

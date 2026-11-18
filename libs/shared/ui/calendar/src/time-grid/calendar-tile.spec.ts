import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { TranslocoService, provideTransloco } from '@jsverse/transloco';
import { LucideBan } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import type { CalendarEvent, CalendarResource } from '../calendar.types';
import { CalendarTile } from './calendar-tile';

const NIKOS: CalendarResource = { id: 'n', label: 'Nikos P.', swatch: 3, initials: 'NP' };

const TRIM: CalendarEvent = {
  id: 'e1',
  date: '2026-09-21',
  start: '09:00',
  end: '09:45',
  title: 'George',
  subtitle: 'Haircut • Beard',
  resourceId: 'n',
  badge: { label: 'Pending', tone: 'warning' },
};

@Component({
  imports: [CalendarTile],
  template: `
    <button
      type="button"
      libCalendarTile
      #tile="libCalendarTile"
      [attr.aria-label]="tile.label()"
      [event]="event()"
      [resource]="resource()"
      [selected]="selected()"
      [showResource]="showResource()"
      [showTime]="showTime()"
      [resourceLabel]="resourceLabel()"
      locale="en-GB"
    ></button>
  `,
})
class Host {
  readonly event = signal<CalendarEvent>(TRIM);
  readonly resource = signal<CalendarResource | null>(NIKOS);
  readonly selected = signal(false);
  readonly showResource = signal(true);
  readonly showTime = signal(false);
  readonly resourceLabel = signal('Barber');
}

describe('CalendarTile', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function tile(): HTMLButtonElement {
    const found = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[libCalendarTile]',
    );
    if (found === null) throw new Error('tile not rendered');
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

  it('is named by its times, title, resource with the host noun, and badge', () => {
    expect(tile().getAttribute('aria-label')).toBe(
      '09:00 to 09:45, George, Barber: Nikos P., Pending',
    );
  });

  it('draws its marks beside the title and reads each one in its name', async () => {
    host.event.set({
      ...TRIM,
      marks: [{ icon: LucideBan, label: 'Blocked from online booking', tone: 'error' }],
    });
    await settle();

    expect(tile().querySelector('lib-calendar-marks .mark')?.getAttribute('data-tone')).toBe(
      'error',
    );
    expect(tile().getAttribute('aria-label')).toBe(
      '09:00 to 09:45, George, Barber: Nikos P., Pending, Blocked from online booking',
    );
  });

  it('names the resource alone when the host gives no noun, and not at all in its own column', async () => {
    host.resourceLabel.set('');
    await settle();
    expect(tile().getAttribute('aria-label')).toBe('09:00 to 09:45, George, Nikos P., Pending');

    host.showResource.set(false);
    await settle();
    expect(tile().getAttribute('aria-label')).toBe('09:00 to 09:45, George, Pending');
  });

  it('carries its state as text and attributes, never colour alone', async () => {
    expect(tile().getAttribute('data-swatch')).toBe('3');
    expect(tile().querySelector('.tile-badge')?.textContent.trim()).toBe('Pending');
    expect(tile().querySelector('.tile-dot')?.getAttribute('aria-hidden')).toBe('true');

    host.event.set({ ...TRIM, muted: true });
    host.selected.set(true);
    await settle();
    expect(tile().hasAttribute('data-muted')).toBe(true);
    expect(tile().getAttribute('aria-current')).toBe('true');
  });

  it('draws a neutral tile with no resource', async () => {
    host.resource.set(null);
    await settle();

    expect(tile().hasAttribute('data-swatch')).toBe(false);
    expect(tile().getAttribute('aria-label')).toBe('09:00 to 09:45, George, Pending');
  });

  it('shows its times only on request', async () => {
    expect(tile().querySelector('.tile-time')).toBeNull();

    host.showTime.set(true);
    await settle();
    expect(tile().querySelector('.tile-time')?.textContent.replace(/\s+/g, '')).toBe('09:00–09:45');
  });
});

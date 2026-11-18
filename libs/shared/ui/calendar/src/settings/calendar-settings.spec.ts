import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { TranslocoService, provideTransloco } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import type { CalendarDayColumns, CalendarTimeScale, CalendarView } from '../calendar.types';
import { CalendarSettings } from './calendar-settings';

@Component({
  imports: [CalendarSettings],
  template: `
    <lib-calendar-settings
      [view]="view()"
      [dayColumnsLabel]="dayColumnsLabel()"
      [(timeScale)]="timeScale"
      [(dayColumns)]="dayColumns"
      [(showTime)]="showTime"
    />
  `,
})
class Host {
  readonly view = signal<CalendarView>('day');
  readonly dayColumnsLabel = signal('');
  readonly timeScale = signal<CalendarTimeScale>(30);
  readonly dayColumns = signal<CalendarDayColumns>('single');
  readonly showTime = signal(false);
}

describe('CalendarSettings', () => {
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

  function switchNamed(name: string): HTMLInputElement {
    const label = [...root().querySelectorAll<HTMLElement>('lib-switch')].find((element) =>
      element.textContent.includes(name),
    );
    const input = label?.querySelector<HTMLInputElement>('input[role="switch"]');
    if (input == null) throw new Error(`switch "${name}" not rendered`);
    return input;
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

  it('names the time scale group by its heading and offers the four scales', () => {
    const heading = root().querySelector('.cs-heading');
    const group = root().querySelector('lib-radio-group');

    expect(heading?.textContent.trim()).toBe('Time scale');
    expect(group?.getAttribute('aria-labelledby')).toBe(heading?.id);
    expect([...root().querySelectorAll('.radio-label')].map((label) => label.textContent)).toEqual([
      '5 min',
      '10 min',
      '30 min',
      '60 min',
    ]);
  });

  it('writes the scale picked back to the host', async () => {
    const radios = [...root().querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios[2]?.checked).toBe(true);

    radios[0]?.click();
    await settle();
    expect(host.timeScale()).toBe(5);
  });

  it('toggles the times on the tiles and the columns per resource', async () => {
    switchNamed('Times on entries').click();
    switchNamed('One column per resource').click();
    await settle();

    expect(host.showTime()).toBe(true);
    expect(host.dayColumns()).toBe('perResource');
  });

  it('takes the host copy for the columns switch', async () => {
    host.dayColumnsLabel.set('One column per barber');
    await settle();

    expect(switchNamed('One column per barber')).toBeDefined();
  });

  it('offers the columns switch in day view only, and no tile setting in year view', async () => {
    host.view.set('week');
    await settle();
    expect(root().textContent).not.toContain('One column per resource');
    expect(root().textContent).toContain('Times on entries');

    host.view.set('year');
    await settle();
    expect(root().querySelectorAll('lib-switch')).toHaveLength(0);
  });
});

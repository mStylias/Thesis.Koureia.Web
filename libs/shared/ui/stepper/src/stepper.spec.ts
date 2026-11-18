import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';
import { firstValueFrom } from 'rxjs';

import { Stepper } from './stepper';
import type { StepperStep } from './stepper.types';

const STEPS: readonly StepperStep[] = [
  { id: 'shop', label: 'Barbershop', locked: true },
  { id: 'services', label: 'Services' },
  { id: 'barber', label: 'Barber' },
  { id: 'when', label: 'Date and time' },
];

@Component({
  imports: [Stepper],
  template: `
    <lib-stepper
      [steps]="steps()"
      [(activeStep)]="active"
      [completedSteps]="completed()"
      (stepSelected)="selected.push($event)"
    >
      <p class="body">step body</p>
    </lib-stepper>
  `,
})
class StepperHost {
  readonly steps = signal(STEPS);
  readonly active = signal('barber');
  readonly completed = signal<readonly string[]>(['shop', 'services']);
  readonly selected: string[] = [];
}

describe('Stepper', () => {
  let fixture: ComponentFixture<StepperHost>;
  let host: StepperHost;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function steps(): HTMLElement[] {
    return Array.from(element().querySelectorAll<HTMLElement>('.stepper__step'));
  }

  function step(id: string): HTMLElement {
    const index = STEPS.findIndex((candidate) => candidate.id === id);
    const found = steps().at(index);
    if (found === undefined) throw new Error(`step ${id} not rendered`);
    return found;
  }

  function header(id: string): HTMLElement {
    const found = step(id).querySelector<HTMLElement>('.stepper__header');
    if (found === null) throw new Error(`header for ${id} not rendered`);
    return found;
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['el', 'en'],
            defaultLang: 'en',
            fallbackLang: 'en',
            missingHandler: { useFallbackTranslation: true },
          },
        }),
      ],
    });
    fixture = TestBed.createComponent(StepperHost);
    host = fixture.componentInstance;
    // A pipe must transform before the scope is loaded.
    await settle();
    await firstValueFrom(TestBed.inject(TranslocoService).load('stepper/en'));
    await settle();
  });

  it('marks each step with the state it is in', async () => {
    await settle();

    expect(step('shop').dataset['state']).toBe('locked');
    expect(step('services').dataset['state']).toBe('completed');
    expect(step('barber').dataset['state']).toBe('active');
    expect(step('when').dataset['state']).toBe('upcoming');
  });

  it('names the active step for assistive technology', async () => {
    await settle();

    expect(step('barber').getAttribute('aria-current')).toBe('step');
    expect(step('services').getAttribute('aria-current')).toBeNull();
  });

  it('renders a completed step as a button and activates it', async () => {
    await settle();

    const completed = header('services');
    expect(completed.tagName).toBe('BUTTON');

    completed.click();
    await settle();

    expect(host.active()).toBe('services');
    expect(host.selected).toEqual(['services']);
  });

  it('renders a locked step as inert markup, however complete it is', async () => {
    await settle();

    const locked = header('shop');
    expect(locked.tagName).not.toBe('BUTTON');

    locked.click();
    await settle();

    expect(host.active()).toBe('barber');
    expect(host.selected).toEqual([]);
  });

  it('leaves an upcoming step unfocusable', async () => {
    await settle();

    const upcoming = header('when');
    expect(upcoming.tagName).not.toBe('BUTTON');
    expect(upcoming.hasAttribute('tabindex')).toBe(false);
  });

  it('reports the position in the compact header and hides it from the reader', async () => {
    await settle();

    const compact = element().querySelector<HTMLElement>('.stepper__compact');
    if (compact === null) throw new Error('compact header not rendered');

    expect(compact.getAttribute('aria-hidden')).toBe('true');
    expect(compact.textContent).toContain('Step 3 of 4');
    // The rail names every step at every width, so the header does not repeat the active one.
    expect(compact.textContent).not.toContain('Barber');
  });

  it('names every step in the rail, so no width has to rely on the compact header', async () => {
    await settle();

    for (const { id, label } of STEPS) {
      expect(step(id).querySelector('.stepper__label')?.textContent).toContain(label);
    }
  });

  it('carries completion as text, not by the tick alone', async () => {
    await settle();

    expect(step('services').querySelector('.sr-only')?.textContent).toContain('completed');
    expect(step('when').querySelector('.sr-only')).toBeNull();
  });

  it('shows a summary only for a step that has one', async () => {
    host.steps.set([
      { id: 'shop', label: 'Barbershop', locked: true },
      { id: 'services', label: 'Services', summary: 'Haircut, beard' },
      { id: 'barber', label: 'Barber' },
      { id: 'when', label: 'Date and time' },
    ]);
    await settle();

    expect(step('services').querySelector('.stepper__summary')?.textContent.trim()).toBe(
      'Haircut, beard',
    );
    expect(step('barber').querySelector('.stepper__summary')).toBeNull();
  });

  it('projects the caller body', async () => {
    await settle();

    expect(element().querySelector('.stepper__panel .body')?.textContent).toBe('step body');
  });
});

describe('Stepper copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({ 'stepper.label': 'customer.stepsLabel' }),
      ],
    });
    const fixture = TestBed.createComponent(StepperHost);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { stepsLabel: 'Your booking' } }, 'en', { merge: true });
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('stepper/en'));
    fixture.detectChanges();

    const list = (fixture.nativeElement as HTMLElement).querySelector('.stepper__list');
    expect(list?.getAttribute('aria-label')).toBe('Your booking');
  });
});

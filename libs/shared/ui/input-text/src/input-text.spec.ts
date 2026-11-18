import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';
import { IconField, InputIcon } from './icon-field/icon-field';
import { InputText } from './input-text';
import { InputTextSize } from './input-text.types';

@Component({
  imports: [InputText, IconField, InputIcon],
  template: `
    <input
      libInputText
      class="plain"
      [size]="size()"
      [invalid]="invalid()"
      [disabled]="disabled()"
      [frameless]="frameless()"
      aria-label="Plain"
    />

    <div
      libIconField
      class="decorated"
      [iconPosition]="iconPosition()"
      [showClear]="showClear()"
      [clearAriaLabel]="clearAriaLabel()"
      (cleared)="clearedCount = clearedCount + 1"
    >
      @if (withIcon()) {
        <span libInputIcon class="icon">★</span>
      }
      <input
        libInputText
        aria-label="Decorated"
        [disabled]="fieldDisabled()"
        [readOnly]="fieldReadOnly()"
        (input)="onInput($event)"
      />
    </div>
  `,
})
class InputTextHost {
  readonly size = signal<InputTextSize>('md');
  readonly invalid = signal(false);
  readonly disabled = signal(false);
  readonly frameless = signal(false);
  readonly iconPosition = signal<'left' | 'right'>('left');
  readonly showClear = signal(false);
  readonly clearAriaLabel = signal('');
  readonly withIcon = signal(false);
  readonly fieldDisabled = signal(false);
  readonly fieldReadOnly = signal(false);

  clearedCount = 0;
  lastValue = '';

  onInput(event: Event): void {
    this.lastValue = (event.target as HTMLInputElement).value;
  }
}

describe('InputText / IconField', () => {
  let fixture: ComponentFixture<InputTextHost>;
  let host: InputTextHost;

  function plain(): HTMLInputElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      'input.plain',
    );
    if (!element) {
      throw new Error('plain input not rendered');
    }
    return element;
  }

  function field(): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector('.decorated');
    if (!element) {
      throw new Error('icon field not rendered');
    }
    return element as HTMLElement;
  }

  function fieldInput(): HTMLInputElement {
    const element = field().querySelector('input');
    if (!element) {
      throw new Error('decorated input not rendered');
    }
    return element;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function type(value: string): Promise<void> {
    fieldInput().value = value;
    fieldInput().dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  function clearButton(): HTMLButtonElement | null {
    return field().querySelector<HTMLButtonElement>('.input-clear-button');
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
    fixture = TestBed.createComponent(InputTextHost);
    host = fixture.componentInstance;
    await settle();
    // The clear button's name comes from a lazily imported scope; the pipe
    // registers its loader on the first render that shows the button.
    host.showClear.set(true);
    await type('x');
    await firstValueFrom(TestBed.inject(TranslocoService).load('iconField/en'));
    await type('');
    host.showClear.set(false);
    await settle();
  });

  it('reflects the size for the styles to key off', async () => {
    expect(plain().getAttribute('data-size')).toBe('md');

    host.size.set('lg');
    await settle();
    expect(plain().getAttribute('data-size')).toBe('lg');
  });

  it('reflects invalid as data attribute and aria-invalid', async () => {
    expect(plain().hasAttribute('data-invalid')).toBe(false);
    expect(plain().hasAttribute('aria-invalid')).toBe(false);

    host.invalid.set(true);
    await settle();

    expect(plain().hasAttribute('data-invalid')).toBe(true);
    expect(plain().getAttribute('aria-invalid')).toBe('true');
  });

  it('reflects frameless, so a parent can draw the frame for a group', async () => {
    expect(plain().hasAttribute('data-frameless')).toBe(false);

    host.frameless.set(true);
    await settle();
    expect(plain().hasAttribute('data-frameless')).toBe(true);

    // Invalid still reports: a state the user must notice outranks the one
    // doubled hairline that frameless exists to remove.
    host.invalid.set(true);
    await settle();
    expect(plain().hasAttribute('data-invalid')).toBe(true);
  });

  it('stays a native input — disabled works natively', async () => {
    host.disabled.set(true);
    await settle();
    expect(plain().disabled).toBe(true);
  });

  it('reflects the icon position and marks the icon decorative', async () => {
    host.withIcon.set(true);
    await settle();

    expect(field().getAttribute('data-icon-position')).toBe('left');
    expect(field().querySelector('.icon')?.getAttribute('aria-hidden')).toBe('true');

    host.iconPosition.set('right');
    await settle();
    expect(field().getAttribute('data-icon-position')).toBe('right');
  });

  it('shows the clear button only while clearable and filled', async () => {
    host.showClear.set(true);
    await settle();
    expect(field().querySelector('.input-clear-button')).toBeNull();

    await type('Kimonas');
    expect(field().querySelector('.input-clear-button')).not.toBeNull();

    await type('');
    expect(field().querySelector('.input-clear-button')).toBeNull();
  });

  it('clears the input, re-dispatches input, and emits cleared', async () => {
    host.showClear.set(true);
    await type('Kimonas');
    expect(host.lastValue).toBe('Kimonas');

    field().querySelector<HTMLButtonElement>('.input-clear-button')?.click();
    await settle();

    expect(fieldInput().value).toBe('');
    // The dispatched input event reached listeners on the input itself.
    expect(host.lastValue).toBe('');
    expect(host.clearedCount).toBe(1);
    expect(field().querySelector('.input-clear-button')).toBeNull();
  });

  it('names the clear button from the translated scope, and lets a consumer override it', async () => {
    host.showClear.set(true);
    await type('Kimonas');

    expect(clearButton()?.getAttribute('aria-label')).toBe('Clear field');
    expect(clearButton()?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');

    host.clearAriaLabel.set('Empty the search');
    await settle();
    expect(clearButton()?.getAttribute('aria-label')).toBe('Empty the search');
  });

  it('reports data-filled so a float label can see a value it cannot reach', async () => {
    // The projected input is the wrapper's child, not the label wrapper's, so
    // the :placeholder-shown trick can never match it.
    expect(field().hasAttribute('data-filled')).toBe(false);

    await type('Kimonas');
    expect(field().hasAttribute('data-filled')).toBe(true);

    await type('');
    expect(field().hasAttribute('data-filled')).toBe(false);
  });

  it('withholds the clear button while the input is disabled', async () => {
    host.showClear.set(true);
    await type('Kimonas');
    expect(field().querySelector('.input-clear-button')).not.toBeNull();

    host.fieldDisabled.set(true);
    await settle();

    // A control the user cannot edit must not offer a control that edits it.
    expect(field().querySelector('.input-clear-button')).toBeNull();
    expect(fieldInput().value).toBe('Kimonas');
  });

  it('withholds the clear button while the input is read-only', async () => {
    host.showClear.set(true);
    await type('Kimonas');

    host.fieldReadOnly.set(true);
    await settle();

    expect(field().querySelector('.input-clear-button')).toBeNull();
    expect(fieldInput().value).toBe('Kimonas');
  });

  it('brings the clear button back when the input is re-enabled', async () => {
    host.showClear.set(true);
    await type('Kimonas');
    host.fieldDisabled.set(true);
    await settle();

    host.fieldDisabled.set(false);
    await settle();

    expect(field().querySelector('.input-clear-button')).not.toBeNull();
  });

  it('hides the clear button when the value is emptied programmatically', async () => {
    host.showClear.set(true);
    await type('Kimonas');
    expect(field().querySelector('.input-clear-button')).not.toBeNull();

    // Programmatic write, no input event — like a Signal Forms reset.
    // afterEveryRender only fires when a render happens; a real form
    // write dirties the view itself, so simulate that by touching
    // unrelated state before settling.
    fieldInput().value = '';
    host.iconPosition.set('right');
    await settle();
    await settle();

    expect(field().querySelector('.input-clear-button')).toBeNull();
  });
});

describe('IconField copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({ 'iconField.clear': 'customer.clear' }),
      ],
    });
    const fixture = TestBed.createComponent(InputTextHost);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { clear: 'Clear what you typed' } }, 'en', {
      merge: true,
    });
    fixture.componentInstance.showClear.set(true);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector<HTMLInputElement>('.decorated input');
    if (!input) throw new Error('decorated input not rendered');
    input.value = 'Kimonas';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('iconField/en'));
    fixture.detectChanges();

    expect(root.querySelector('.input-clear-button')?.getAttribute('aria-label')).toBe(
      'Clear what you typed',
    );
  });
});

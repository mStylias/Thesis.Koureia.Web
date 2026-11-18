import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  form,
  FormField,
  max as maxRule,
  readonly as readonlyRule,
  required,
} from '@angular/forms/signals';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';
import { firstValueFrom } from 'rxjs';
import { Rating } from './rating';
import { RatingSize } from './rating.types';

const TRANSLOCO = provideTransloco({
  config: {
    availableLangs: ['el', 'en'],
    defaultLang: 'en',
    fallbackLang: 'en',
    missingHandler: { useFallbackTranslation: true },
  },
});

@Component({
  imports: [Rating],
  template: `
    <lib-rating
      [(value)]="value"
      [max]="max()"
      [size]="size()"
      [readonly]="readonly()"
      [disabled]="disabled()"
      [invalid]="invalid()"
      [required]="required()"
      [ariaLabel]="ariaLabel()"
      [ariaLabelledby]="ariaLabelledby()"
      [ariaDescribedby]="ariaDescribedby()"
      (touch)="touchCount = touchCount + 1"
    />
    <button type="button" id="outside">Outside</button>
  `,
})
class RatingHost {
  readonly value = signal<number | null>(null);
  readonly max = signal(5);
  readonly size = signal<RatingSize>('md');
  readonly readonly = signal(false);
  readonly disabled = signal(false);
  readonly invalid = signal(false);
  readonly required = signal(false);
  readonly ariaLabel = signal('');
  readonly ariaLabelledby = signal('');
  readonly ariaDescribedby = signal('');
  readonly rating = viewChild.required(Rating);

  touchCount = 0;
}

@Component({
  imports: [Rating, FormField],
  template: `<lib-rating [formField]="reviewForm.score" />`,
})
class SignalFormsHost {
  readonly model = signal<{ score: number | null }>({ score: null });
  readonly reviewForm = form(this.model, (path) => {
    required(path.score, { message: 'Rate the visit' });
  });
}

describe('Rating', () => {
  let fixture: ComponentFixture<RatingHost>;
  let host: RatingHost;

  function root(): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('lib-rating');
    if (!element) {
      throw new Error('lib-rating not rendered');
    }
    return element;
  }

  function group(): HTMLElement {
    const element = root().querySelector<HTMLElement>('.rating');
    if (!element) {
      throw new Error('rating group not rendered');
    }
    return element;
  }

  function stars(): HTMLButtonElement[] {
    return Array.from(root().querySelectorAll<HTMLButtonElement>('button[role="radio"]'));
  }

  function star(index: number): HTMLButtonElement {
    const element = stars().at(index);
    if (!element) {
      throw new Error(`star ${String(index + 1)} not rendered`);
    }
    return element;
  }

  function filled(): number {
    return root().querySelectorAll('.star[data-on]').length;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function press(target: HTMLElement, key: string): Promise<KeyboardEvent> {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    await settle();
    return event;
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [TRANSLOCO] });
    fixture = TestBed.createComponent(RatingHost);
    host = fixture.componentInstance;
    await settle();
    await firstValueFrom(TestBed.inject(TranslocoService).load('rating/en'));
    await settle();
  });

  describe('host attribute contract', () => {
    it('reflects size, disabled, invalid, readonly and filled', async () => {
      expect(root().getAttribute('data-size')).toBe('md');
      for (const name of ['data-disabled', 'data-invalid', 'data-readonly', 'data-filled']) {
        expect(root().hasAttribute(name)).toBe(false);
      }

      host.size.set('lg');
      host.disabled.set(true);
      host.invalid.set(true);
      host.readonly.set(true);
      host.value.set(3);
      await settle();

      expect(root().getAttribute('data-size')).toBe('lg');
      for (const name of ['data-disabled', 'data-invalid', 'data-readonly', 'data-filled']) {
        expect(root().getAttribute(name)).toBe('');
      }
    });
  });

  describe('interactive mode', () => {
    it('renders a named radio group of named star radios', () => {
      expect(group().getAttribute('role')).toBe('radiogroup');
      expect(group().getAttribute('aria-label')).toBe('Rating');
      expect(stars()).toHaveLength(5);
      expect(stars().map((button) => button.getAttribute('aria-label'))).toEqual([
        '1 star',
        '2 stars',
        '3 stars',
        '4 stars',
        '5 stars',
      ]);
      expect(stars().every((button) => button.type === 'button')).toBe(true);
      expect(stars().every((button) => button.getAttribute('aria-checked') === 'false')).toBe(true);
    });

    it('draws each star as a decorative icon', () => {
      const icons = root().querySelectorAll('svg');
      expect(icons).toHaveLength(5);
      expect(Array.from(icons).every((icon) => icon.getAttribute('aria-hidden') === 'true')).toBe(
        true,
      );
    });

    it('keeps one tab stop on the first star while nothing is rated', () => {
      expect(stars().map((button) => button.tabIndex)).toEqual([0, -1, -1, -1, -1]);
    });

    it('moves the tab stop to the checked star', async () => {
      host.value.set(3);
      await settle();

      expect(stars().map((button) => button.tabIndex)).toEqual([-1, -1, 0, -1, -1]);
      expect(star(2).getAttribute('aria-checked')).toBe('true');
      expect(filled()).toBe(3);
    });

    it('selects a star on click', async () => {
      star(3).click();
      await settle();

      expect(host.value()).toBe(4);
      expect(star(3).getAttribute('aria-checked')).toBe('true');
      expect(filled()).toBe(4);
    });

    it('previews a hovered star without writing the value', async () => {
      host.value.set(1);
      await settle();

      star(3).dispatchEvent(new Event('pointerenter'));
      await settle();
      expect(filled()).toBe(4);
      expect(host.value()).toBe(1);

      group().dispatchEvent(new Event('pointerleave'));
      await settle();
      expect(filled()).toBe(1);
    });

    it('exposes required and invalid on the group, never native required', async () => {
      host.required.set(true);
      host.invalid.set(true);
      await settle();

      expect(group().getAttribute('aria-required')).toBe('true');
      expect(group().getAttribute('aria-invalid')).toBe('true');
      expect(root().querySelector('[required]')).toBeNull();
    });

    it('lets an external label replace the default name', async () => {
      host.ariaLabelledby.set('score-heading');
      await settle();

      expect(group().getAttribute('aria-labelledby')).toBe('score-heading');
      expect(group().hasAttribute('aria-label')).toBe(false);

      host.ariaLabel.set('Service');
      await settle();
      expect(group().getAttribute('aria-label')).toBe('Service');
    });

    it('passes the consumer describedby through untouched', async () => {
      host.ariaDescribedby.set('hint error');
      await settle();

      expect(group().getAttribute('aria-describedby')).toBe('hint error');
    });
  });

  describe('keyboard', () => {
    it('steps with the arrow keys and moves focus with the value', async () => {
      star(0).focus();

      await press(star(0), 'ArrowRight');
      expect(host.value()).toBe(1);

      await press(star(0), 'ArrowUp');
      expect(host.value()).toBe(2);
      expect(document.activeElement).toBe(star(1));

      await press(star(1), 'ArrowLeft');
      expect(host.value()).toBe(1);

      await press(star(0), 'ArrowDown');
      expect(host.value()).toBe(1);
    });

    it('stops at the last star instead of wrapping', async () => {
      host.value.set(5);
      await settle();

      await press(star(4), 'ArrowRight');
      expect(host.value()).toBe(5);
    });

    it('jumps with Home and End', async () => {
      host.value.set(3);
      await settle();

      await press(star(2), 'End');
      expect(host.value()).toBe(5);
      expect(document.activeElement).toBe(star(4));

      await press(star(4), 'Home');
      expect(host.value()).toBe(1);
      expect(document.activeElement).toBe(star(0));
    });

    it('selects the focused star with Space and Enter', async () => {
      const space = await press(star(0), ' ');
      expect(host.value()).toBe(1);
      expect(space.defaultPrevented).toBe(true);

      host.value.set(null);
      await settle();
      await press(star(0), 'Enter');
      expect(host.value()).toBe(1);
    });

    it('leaves other keys alone', async () => {
      const tab = await press(star(0), 'Tab');

      expect(tab.defaultPrevented).toBe(false);
      expect(host.value()).toBeNull();
    });
  });

  describe('disabled', () => {
    beforeEach(async () => {
      host.value.set(2);
      host.disabled.set(true);
      await settle();
    });

    it('disables every star, which drops the tab stop', () => {
      expect(stars().every((button) => button.disabled)).toBe(true);
      expect(group().getAttribute('aria-disabled')).toBe('true');
    });

    it('ignores click, keys and hover', async () => {
      star(4).click();
      await press(star(1), 'ArrowRight');
      await press(star(1), 'End');
      star(4).dispatchEvent(new Event('pointerenter'));
      await settle();

      expect(host.value()).toBe(2);
      expect(filled()).toBe(2);
    });

    it('does not take focus from focus()', () => {
      host.rating().focus();

      expect(root().contains(document.activeElement)).toBe(false);
    });
  });

  describe('readonly', () => {
    beforeEach(async () => {
      host.value.set(4);
      host.readonly.set(true);
      await settle();
    });

    it('renders one image named with the score and no controls', () => {
      expect(group().getAttribute('role')).toBe('img');
      expect(group().getAttribute('aria-label')).toBe('4 of 5 stars');
      expect(root().querySelector('button')).toBeNull();
      expect(root().querySelector('[tabindex]')).toBeNull();
      expect(filled()).toBe(4);
    });

    it('lets ariaLabel replace the summary', async () => {
      host.ariaLabel.set('Average 4 of 5');
      await settle();

      expect(group().getAttribute('aria-label')).toBe('Average 4 of 5');
    });

    it('rounds a fractional score to whole stars', async () => {
      host.value.set(3.6);
      await settle();

      expect(group().getAttribute('aria-label')).toBe('4 of 5 stars');
      expect(filled()).toBe(4);
    });

    it('reads an empty score as zero', async () => {
      host.value.set(null);
      await settle();

      expect(group().getAttribute('aria-label')).toBe('0 of 5 stars');
      expect(filled()).toBe(0);
    });

    it('does not take focus from focus()', () => {
      host.rating().focus();

      expect(root().contains(document.activeElement)).toBe(false);
    });
  });

  describe('max normalization', () => {
    it.each([
      [3, 3],
      [3.7, 3],
      [0, 1],
      [-4, 1],
      [Number.NaN, 5],
      [100, 10],
    ])('renders max %s as %s stars', async (max, count) => {
      host.max.set(max);
      await settle();

      expect(stars()).toHaveLength(count);
    });

    it('clamps a value above max', async () => {
      host.max.set(3);
      host.value.set(7);
      await settle();

      expect(filled()).toBe(3);
      expect(star(2).getAttribute('aria-checked')).toBe('true');
    });
  });

  describe('touch', () => {
    it('does not touch while focus moves between stars', () => {
      star(0).dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: star(1) }));

      expect(host.touchCount).toBe(0);
    });

    it('touches once focus leaves the control', () => {
      const outside = (fixture.nativeElement as HTMLElement).querySelector('#outside');
      star(0).dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));

      expect(host.touchCount).toBe(1);
    });
  });

  describe('focus()', () => {
    it('focuses the checked star, or the first', async () => {
      host.rating().focus();
      expect(document.activeElement).toBe(star(0));

      host.value.set(3);
      await settle();
      host.rating().focus();
      expect(document.activeElement).toBe(star(2));
    });
  });
});

@Component({
  imports: [Rating, FormField],
  template: `<lib-rating [formField]="reviewForm.score" />`,
})
class RuleHost {
  readonly locked = signal(false);
  readonly model = signal<{ score: number | null }>({ score: 2 });
  readonly reviewForm = form(this.model, (path) => {
    maxRule(path.score, 3);
    readonlyRule(path.score, { when: () => this.locked() });
  });
}

describe('Rating with Signal Forms', () => {
  it('takes the star count and read-only state from the field rules', async () => {
    TestBed.configureTestingModule({ providers: [TRANSLOCO] });
    const fixture = TestBed.createComponent(RuleHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = (fixture.nativeElement as HTMLElement).querySelector('lib-rating');
    if (!element) {
      throw new Error('lib-rating not rendered');
    }

    expect(element.querySelectorAll('button[role="radio"]')).toHaveLength(3);

    fixture.componentInstance.locked.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.hasAttribute('data-readonly')).toBe(true);
    expect(element.querySelector('[role="img"]')).not.toBeNull();
    expect(element.querySelector('button')).toBeNull();
  });

  it('round-trips the value and reflects field state', async () => {
    TestBed.configureTestingModule({ providers: [TRANSLOCO] });
    const fixture = TestBed.createComponent(SignalFormsHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = (fixture.nativeElement as HTMLElement).querySelector('lib-rating');
    const group = element?.querySelector('[role="radiogroup"]');
    const buttons = Array.from(element?.querySelectorAll('button') ?? []);
    if (!element || !group || buttons.length !== 5) {
      throw new Error('lib-rating not rendered');
    }

    expect(group.getAttribute('aria-required')).toBe('true');

    buttons[2].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.model().score).toBe(3);
    expect(fixture.componentInstance.reviewForm.score().valid()).toBe(true);

    fixture.componentInstance.model.set({ score: 5 });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(buttons[4].getAttribute('aria-checked')).toBe('true');

    buttons[4].dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    fixture.detectChanges();
    expect(fixture.componentInstance.reviewForm.score().touched()).toBe(true);
  });

  it('reflects an invalid field', async () => {
    TestBed.configureTestingModule({ providers: [TRANSLOCO] });
    const fixture = TestBed.createComponent(SignalFormsHost);
    fixture.componentInstance.reviewForm.score().markAsTouched();
    fixture.detectChanges();
    await fixture.whenStable();
    const element = (fixture.nativeElement as HTMLElement).querySelector('lib-rating');

    expect(fixture.componentInstance.reviewForm.score().invalid()).toBe(true);
    expect(element?.hasAttribute('data-invalid')).toBe(true);
    expect(element?.querySelector('[role="radiogroup"]')?.getAttribute('aria-invalid')).toBe(
      'true',
    );
  });
});

@Component({
  imports: [Rating],
  template: `<lib-rating [value]="2" />`,
})
class CopyHost {}

describe('Rating copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [TRANSLOCO, provideUiCopy({ 'rating.label': 'customer.ratingLabel' })],
    });
    const fixture = TestBed.createComponent(CopyHost);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { ratingLabel: 'Your score' } }, 'en', { merge: true });
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('rating/en'));
    fixture.detectChanges();

    const group = (fixture.nativeElement as HTMLElement).querySelector('[role="radiogroup"]');
    expect(group?.getAttribute('aria-label')).toBe('Your score');
    expect(group?.querySelector('button')?.getAttribute('aria-label')).toBe('1 star');
  });
});

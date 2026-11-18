import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FloatLabelVariant } from './form-field.types';
import { FloatLabel } from './float-label/float-label';
import { IftaLabel } from './ifta-label/ifta-label';

@Component({
  imports: [FloatLabel, IftaLabel],
  template: `
    <div libFloatLabel [variant]="variant()" data-testid="float">
      <input id="name" type="text" placeholder=" " />
      <label for="name">Name</label>
    </div>

    <div libIftaLabel data-testid="ifta">
      <input id="email" type="email" placeholder=" " />
      <label for="email">Email</label>
    </div>
  `,
})
class LabelsHost {
  readonly variant = signal<FloatLabelVariant>('over');
}

describe('FloatLabel / IftaLabel', () => {
  let fixture: ComponentFixture<LabelsHost>;

  function wrapper(testId: string): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector(
      `[data-testid="${testId}"]`,
    );
    if (!element) {
      throw new Error(`${testId} wrapper not rendered`);
    }
    return element as HTMLElement;
  }

  beforeEach(async () => {
    fixture = TestBed.createComponent(LabelsHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('projects the control and label untouched', () => {
    expect(wrapper('float').querySelector('input#name')).not.toBeNull();
    expect(wrapper('float').querySelector('label[for="name"]')?.textContent).toContain('Name');
  });

  it('reflects the variant for the styles to key off', async () => {
    expect(wrapper('float').getAttribute('data-variant')).toBe('over');

    fixture.componentInstance.variant.set('in');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(wrapper('float').getAttribute('data-variant')).toBe('in');
  });

  it('renders the IFTA wrapper without a variant attribute', () => {
    expect(wrapper('ifta').hasAttribute('data-variant')).toBe(false);
    expect(wrapper('ifta').querySelector('label[for="email"]')).not.toBeNull();
  });
});

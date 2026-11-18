import { Component, Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { UiCopyPipe, injectUiCopy, provideUiCopy } from './ui-copy';

@Component({
  selector: 'lib-copy-probe',
  imports: [UiCopyPipe],
  template: `<span>{{ 'timePicker.placeholder' | uiCopy }}</span>`,
})
class Probe {}

@Component({
  imports: [Probe],
  providers: [provideUiCopy({ 'timePicker.placeholder': 'uiCopy.timePicker.placeholder' })],
  template: `<lib-copy-probe />`,
})
class CustomerHost {}

describe('ui copy', () => {
  it('reads the control’s own key when nothing overrides it', () => {
    const resolve = TestBed.runInInjectionContext(() => injectUiCopy());

    expect(resolve('timePicker.placeholder')).toBe('timePicker.placeholder');
  });

  it('reads the override where one is provided, in a template', () => {
    const fixture = TestBed.createComponent(CustomerHost);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent.trim()).toBe(
      'uiCopy.timePicker.placeholder',
    );
  });

  it('adds a nested provider to the one above it, and lets it win on a shared key', () => {
    const outer = Injector.create({
      providers: [provideUiCopy({ a: 'outer.a', b: 'outer.b' })],
      parent: TestBed.inject(Injector),
    });
    const inner = Injector.create({
      providers: [provideUiCopy({ b: 'inner.b' })],
      parent: outer,
    });
    const resolve = runInInjectionContext(inner, () => injectUiCopy());

    expect(resolve('a')).toBe('outer.a');
    expect(resolve('b')).toBe('inner.b');
    expect(resolve('c')).toBe('c');
  });
});

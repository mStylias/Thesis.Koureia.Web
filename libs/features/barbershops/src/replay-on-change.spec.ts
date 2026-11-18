import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ReplayOnChange } from './replay-on-change';

@Component({
  imports: [ReplayOnChange],
  template: `<span [libReplayOnChange]="amount()" [animationClass]="cls()">{{ amount() }}</span>`,
})
class Host {
  readonly amount = signal('25 €');
  readonly cls = signal('total-enter');
}

async function mount(): Promise<{ span: HTMLElement; host: Host; settle: () => Promise<void> }> {
  const fixture = TestBed.createComponent(Host);
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  await settle();

  const root = fixture.nativeElement as HTMLElement;
  const span = root.querySelector('span');
  if (!span) throw new Error('span not rendered');

  return { span, host: fixture.componentInstance, settle };
}

describe('ReplayOnChange', () => {
  it('leaves the first value alone, so the first paint is still', async () => {
    const { span } = await mount();

    expect(span.classList.contains('total-enter')).toBe(false);
  });

  it('carries the class onto the element when the value changes', async () => {
    const { span, host, settle } = await mount();

    host.amount.set('40 €');
    await settle();

    expect(span.classList.contains('total-enter')).toBe(true);
  });

  it('replays on every later change, not only the first', async () => {
    const { span, host, settle } = await mount();

    host.amount.set('40 €');
    await settle();
    // What a replay looks like from outside: the class leaves and comes back inside one
    // effect, so the only observable state is that it is still on the element.
    host.amount.set('52 €');
    await settle();

    expect(span.classList.contains('total-enter')).toBe(true);
  });

  it('withholds the replay when no class is named', async () => {
    const { span, host, settle } = await mount();

    host.cls.set('');
    host.amount.set('40 €');
    await settle();

    expect(span.getAttribute('class')).toBeNull();
  });
});

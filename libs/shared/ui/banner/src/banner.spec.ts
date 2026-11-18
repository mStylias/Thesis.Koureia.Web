import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { LucideShieldCheck, type LucideIconInput } from '@lucide/angular';

import { Banner } from './banner';
import type { BannerTone } from './banner.types';

@Component({
  imports: [Banner],
  template: `
    <lib-banner [tone]="tone()" [heading]="heading()" [icon]="icon()">
      The appointment is booked.
      @if (withAction()) {
        <button type="button" libBannerAction>Retry</button>
      }
    </lib-banner>
  `,
})
class Host {
  readonly tone = signal<BannerTone>('info');
  readonly heading = signal('');
  readonly icon = signal<LucideIconInput | null>(null);
  readonly withAction = signal(false);
}

@Component({
  imports: [Banner],
  template: `<lib-banner role="alert">It did not save.</lib-banner>`,
})
class AlertHost {}

describe('Banner', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function banner(): HTMLElement {
    const found = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('lib-banner');
    if (found === null) throw new Error('banner not rendered');
    return found;
  }

  function part(selector: string): HTMLElement {
    const found = banner().querySelector<HTMLElement>(selector);
    if (found === null) throw new Error(`${selector} not rendered`);
    return found;
  }

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await settle();
  });

  it('is info by default and shows the projected message', () => {
    const plain = TestBed.createComponent(Banner);
    plain.detectChanges();
    expect((plain.nativeElement as HTMLElement).getAttribute('data-tone')).toBe('info');
    expect(part('.banner-content').textContent.trim()).toBe('The appointment is booked.');
  });

  it('gives each tone its own icon, so color is not the only signal', async () => {
    const shapes = new Set<string>();
    for (const tone of ['info', 'success', 'warning', 'error'] as const) {
      host.tone.set(tone);
      await settle();
      expect(banner().getAttribute('data-tone')).toBe(tone);
      shapes.add(part('.banner-icon').innerHTML);
    }
    expect(shapes.size).toBe(4);
  });

  it('hides the icon from a screen reader', () => {
    expect(part('.banner-icon').getAttribute('aria-hidden')).toBe('true');
  });

  it('replaces the tone icon with the one given', async () => {
    const toneIcon = part('.banner-icon').innerHTML;
    host.icon.set(LucideShieldCheck);
    await settle();
    expect(part('.banner-icon').innerHTML).not.toBe(toneIcon);
  });

  it('shows a heading over the message only when one is given', async () => {
    expect(banner().querySelector('.banner-heading')).toBeNull();
    host.heading.set('Not shown in online booking');
    await settle();
    expect(part('.banner-heading').textContent).toBe('Not shown in online booking');
  });

  it('moves a marked action out of the message into the action slot', async () => {
    host.withAction.set(true);
    await settle();
    expect(part('.banner-actions').querySelector('button')?.textContent).toBe('Retry');
    expect(part('.banner-content').querySelector('button')).toBeNull();
  });

  it('sets no role, and keeps the one a consumer gives', () => {
    expect(banner().hasAttribute('role')).toBe(false);

    const alert = TestBed.createComponent(AlertHost);
    alert.detectChanges();
    const element = (alert.nativeElement as HTMLElement).querySelector('lib-banner');
    expect(element?.getAttribute('role')).toBe('alert');
  });
});

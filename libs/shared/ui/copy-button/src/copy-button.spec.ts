import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';
import { firstValueFrom } from 'rxjs';

import { COPIED_MS, CopyButton } from './copy-button';

@Component({
  imports: [CopyButton],
  template: `<lib-copy-button value="ada@example.com" label="Copy email" />`,
})
class Host {}

function setup(overrides: Record<string, string> = {}): ComponentFixture<Host> {
  TestBed.configureTestingModule({
    providers: [
      provideTransloco({
        config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
      }),
      provideUiCopy(overrides),
    ],
  });
  return TestBed.createComponent(Host);
}

async function settle(fixture: ComponentFixture<Host>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  await firstValueFrom(TestBed.inject(TranslocoService).load('copyButton/en'));
  fixture.detectChanges();
  await fixture.whenStable();
}

function button(fixture: ComponentFixture<Host>): HTMLButtonElement {
  const found = (fixture.nativeElement as HTMLElement).querySelector('button');
  if (!(found instanceof HTMLButtonElement)) throw new Error('button not rendered');
  return found;
}

function status(fixture: ComponentFixture<Host>): string {
  const found = (fixture.nativeElement as HTMLElement).querySelector('[role="status"]');
  if (!(found instanceof HTMLElement)) throw new Error('status not rendered');
  return found.textContent.trim();
}

describe('CopyButton', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps the consumer name and shows "Copy"', async () => {
    const fixture = setup();
    await settle(fixture);
    expect(button(fixture).getAttribute('aria-label')).toBe('Copy email');
    expect(button(fixture).textContent.trim()).toBe('Copy');
  });

  it('copies the value, says so, and reads "Copy" again after the delay', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const fixture = setup();
    await settle(fixture);
    vi.useFakeTimers();

    button(fixture).click();
    await Promise.resolve();
    fixture.detectChanges();
    expect(writeText).toHaveBeenCalledWith('ada@example.com');
    expect(button(fixture).textContent.trim()).toBe('Copied');
    expect(status(fixture)).toBe('Copied');

    vi.advanceTimersByTime(COPIED_MS);
    fixture.detectChanges();
    expect(button(fixture).textContent.trim()).toBe('Copy');
    expect(status(fixture)).toBe('');
  });

  it('announces a refused copy', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error()) },
    });
    const fixture = setup();
    await settle(fixture);

    button(fixture).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(status(fixture)).toBe('The copy failed.');
    expect(button(fixture).textContent.trim()).toBe('Copy');
  });
});

describe('CopyButton copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    const fixture = setup({ 'copyButton.copy': 'customer.copy' });
    TestBed.inject(TranslocoService).setTranslation({ customer: { copy: 'Copy it' } }, 'en', {
      merge: true,
    });
    await settle(fixture);
    expect(button(fixture).textContent.trim()).toBe('Copy it');
  });
});

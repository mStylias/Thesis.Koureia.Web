import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ActiveLanguage } from './active-language';
import { LangLink } from './lang-link';

@Component({
  imports: [LangLink],
  template: `
    <a id="string" langLink="/barbershops">string</a>
    <a id="root" langLink="/">root</a>
    <a id="array" [langLink]="['/barbershops', 'kalamaria']">array</a>
    <a id="relative" langLink="how-it-works">relative</a>
    <a id="query" langLink="/barbershops" [queryParams]="{ near: 'me' }">query</a>
  `,
})
class LinkHost {}

function hrefs(language: 'el' | 'en'): Record<string, string | null> {
  // Each call is a fresh app. `ActiveLanguage` is read at binding time, so two components
  // must render the two languages. Mutating one component does not work.
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  TestBed.inject(ActiveLanguage).set(language);

  const fixture = TestBed.createComponent(LinkHost);
  fixture.detectChanges();

  const element = fixture.nativeElement as HTMLElement;
  return Object.fromEntries(
    [...element.querySelectorAll('a')].map((anchor) => [anchor.id, anchor.getAttribute('href')]),
  );
}

describe('LangLink', () => {
  it('prefixes an absolute string target with the active language', () => {
    expect(hrefs('en')['string']).toBe('/en/barbershops');
  });

  it('turns the root into the language home rather than into a double slash', () => {
    expect(hrefs('el')['root']).toBe('/el');
  });

  it('prefixes only the first command of an array target', () => {
    expect(hrefs('en')['array']).toBe('/en/barbershops/kalamaria');
  });

  it('does not touch a relative target — the route it resolves against carries the prefix', () => {
    // RouterLink resolves this against the test's root route, which is why it starts with a
    // slash. What matters is that `en` is absent: the directive added nothing.
    expect(hrefs('en')['relative']).toBe('/how-it-works');
  });

  it('keeps the rest of the RouterLink API, because it is a RouterLink', () => {
    expect(hrefs('el')['query']).toBe('/el/barbershops?near=me');
  });

  it('follows the active language rather than hardcoding the default', () => {
    expect(hrefs('el')['string']).toBe('/el/barbershops');
    expect(hrefs('en')['string']).toBe('/en/barbershops');
  });
});

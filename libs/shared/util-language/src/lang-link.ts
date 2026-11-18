import { Directive, Input, inject } from '@angular/core';
import { RouterLink, UrlTree } from '@angular/router';

import { ActiveLanguage } from './active-language';
import { AppLanguage, withLanguagePrefix } from './language';

/**
 * `routerLink`, with the active language in front of it.
 *
 * ```html
 * <a langLink="/barbershops">…</a>
 * <a [langLink]="['/barbershops', slug]">…</a>
 * ```
 *
 * Write a link target the way it reads in the route table, `/barbershops` and not
 * `/el/barbershops`, and this directive adds the published prefix. Everything else about
 * `routerLink` still works, including `queryParams`, `fragment` and `target`, because this is
 * a `RouterLink` with one input renamed.
 *
 * It uses an `@Input` setter and not `input()`. The prefix must be on the `href` in the HTML
 * the server sends, so the write to `RouterLink` must happen in the binding pass and not in an
 * `effect` that flushes after it. A setter runs there. This is the one place in the workspace
 * where a signal input is the slower answer.
 *
 * Reading the language once per binding is safe, because a language switch is a full
 * navigation, so no rendered link outlives the language it was built for.
 *
 * A missed link does not crash. It navigates to an unprefixed path, fails `canMatch` and lands
 * on the 404 page, which is loud enough to find.
 */
@Directive({
  selector: 'a[langLink],area[langLink]',
})
export class LangLink extends RouterLink {
  private readonly language = inject(ActiveLanguage);

  @Input({ required: true })
  set langLink(commands: readonly unknown[] | string | UrlTree | null | undefined) {
    this.routerLink = prefixLanguage(commands, this.language.value());
  }
}

function prefixLanguage(
  commands: readonly unknown[] | string | UrlTree | null | undefined,
  language: AppLanguage,
): readonly unknown[] | string | UrlTree | null | undefined {
  // A `UrlTree` is a resolved address, and a relative array is anchored to a route that
  // carries the prefix. Only an absolute path needs a rewrite.
  if (commands instanceof UrlTree || commands === null || commands === undefined) {
    return commands;
  }

  if (typeof commands === 'string') {
    return commands.startsWith('/') ? withLanguagePrefix(commands, language) : commands;
  }

  const [first, ...rest] = commands;
  if (typeof first !== 'string' || !first.startsWith('/')) return commands;

  return [withLanguagePrefix(first, language), ...rest];
}

// Global design-system entry points are stylesheet projects, not TypeScript libraries.
// oxlint-disable-next-line @nx/enforce-module-boundaries
import '../../../libs/shared/styles/src/tailwind.css';
// oxlint-disable-next-line @nx/enforce-module-boundaries
import '../../../libs/themes/koureia/src/main.scss';
import './styles.scss';

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app.config';
import { bootstrapKcApplication } from './kc.gen';
import { sanitizeKcContext } from './login/sanitize-kc-context';
import { pageLanguageTag } from './page-language';

void (async () => {
  // Before anything renders. The built HTML cannot know the language, and a page that claims
  // the wrong one is read aloud in the wrong voice.
  document.documentElement.lang = pageLanguageTag(window.kcContext);

  if (window.kcContext === undefined) {
    const { NoContextComponent } = await import('./no-context.component');
    await bootstrapApplication(NoContextComponent, appConfig);
    return;
  }

  void bootstrapKcApplication({
    kcContext: sanitizeKcContext(window.kcContext),
    bootstrapApplication: ({ KcRootComponent, kcProvider }) =>
      bootstrapApplication(KcRootComponent, {
        ...appConfig,
        providers: [...appConfig.providers, kcProvider],
      }),
  });
})();

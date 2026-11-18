import { inject, makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { SYNAX_ERROR_MESSAGES, type SynaxErrorMessages } from '@synax/client';
import { SyntheticErrorCodes } from '@synax/client/core';

/**
 * The copy for the codes the client itself produces, such as a request with no response. A
 * server never sends them, so no feature maps them. Without this, the English description
 * Synax attaches shows on a Greek page. A feature registry merges over this one.
 */
export function provideAppErrorMessages(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: SYNAX_ERROR_MESSAGES, useFactory: appErrorMessages },
  ]);
}

function appErrorMessages(): SynaxErrorMessages {
  const transloco = inject(TranslocoService);
  const codes = Object.fromEntries(
    Object.values(SyntheticErrorCodes).map((code) => [
      code,
      () => transloco.translate(`errors.${code}`),
    ]),
  );
  return { codes };
}

// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createGetKcContextMock } from 'keycloakify/login/KcContext';

import type { KcContextExtension, KcContextExtensionPerPage } from './KcContext';
import { sanitizeKcContext } from './sanitize-kc-context';

const { getKcContextMock } = createGetKcContextMock<KcContextExtension, KcContextExtensionPerPage>({
  kcContextExtension: {
    themeName: 'koureia',
    properties: { KOUREIA_APP_URL: 'http://localhost:6100' },
  },
  kcContextExtensionPerPage: {},
});

const PAYLOAD = 'Wrong password. <b>Try again.</b><img src=x onerror="alert(1)">';

describe('sanitizeKcContext', () => {
  it('strips script from the page message and keeps the safe markup', () => {
    const context = sanitizeKcContext(
      getKcContextMock({
        pageId: 'login.ftl',
        overrides: { message: { type: 'error', summary: PAYLOAD } },
      }),
    );
    expect(context.message?.summary).toContain('<b>Try again.</b>');
    expect(context.message?.summary).not.toContain('onerror');
  });

  it('strips script from the field messages', () => {
    const raw = getKcContextMock({ pageId: 'login.ftl' });
    const context = sanitizeKcContext({
      ...raw,
      messagesPerField: {
        ...raw.messagesPerField,
        get: () => PAYLOAD,
        getFirstError: () => PAYLOAD,
      },
    });
    expect(context.messagesPerField.get('username')).not.toContain('onerror');
    expect(context.messagesPerField.getFirstError('username', 'password')).not.toContain('onerror');
  });

  it('leaves a page with no message without one', () => {
    const context = sanitizeKcContext(getKcContextMock({ pageId: 'login.ftl' }));
    expect(context.message).toBeUndefined();
  });
});

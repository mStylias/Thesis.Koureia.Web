import { detectPushEnvironment } from './push-environment';
import type { PushEnvironment } from './push-environment.types';
import { derivePushState } from './push-state';
import type { PushStateInput } from './push-state.types';

const desktop: PushEnvironment = detectPushEnvironment({
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  maxTouchPoints: 0,
  standalone: false,
  pushApi: true,
});

const iPhone: PushEnvironment = detectPushEnvironment({
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  maxTouchPoints: 5,
  standalone: false,
  pushApi: false,
});

function state(input: Partial<PushStateInput>) {
  return derivePushState({
    environment: desktop,
    server: 'configured',
    permission: 'default',
    subscribed: false,
    ...input,
  });
}

describe('derivePushState', () => {
  it('is unknown on the server and before the API answers', () => {
    expect(state({ environment: null })).toBe('unknown');
    expect(state({ server: 'unknown' })).toBe('unknown');
  });

  it('follows the permission and the subscription', () => {
    expect(state({ permission: 'default' })).toBe('available');
    expect(state({ permission: 'denied' })).toBe('blocked');
    expect(state({ permission: 'granted', subscribed: false })).toBe('off');
    expect(state({ permission: 'granted', subscribed: true })).toBe('on');
    expect(state({ permission: 'granted', subscribed: null })).toBe('unknown');
  });

  it('is unsupported everywhere when the environment has no push keys, the guides included', () => {
    expect(state({ server: 'not-configured' })).toBe('unsupported');
    expect(state({ environment: iPhone, server: 'not-configured' })).toBe('unsupported');
  });

  it('sends an iPhone outside the Home Screen to the guide, whatever the permission', () => {
    expect(state({ environment: iPhone, permission: null, subscribed: null })).toBe(
      'needs-home-screen',
    );
  });
});

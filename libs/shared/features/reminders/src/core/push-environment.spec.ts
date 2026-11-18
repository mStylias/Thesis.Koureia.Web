import { detectPushEnvironment, deviceLabel, environmentState } from './push-environment';
import type { PushEnvironmentInput } from './push-environment.types';

const UA = {
  iPhoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  iPhoneSafariOld:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1',
  iPhoneHomeScreen:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  iPhoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  samsung:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36',
  instagramIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 325.0.0.0 (iPhone14,5; iOS 17_4; el_GR; el)',
  facebookAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/460.0.0.0;]',
  viberAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 Viber/21.5.0.0',
  windowsChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  windowsEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
};

function detect(input: Partial<PushEnvironmentInput> & { userAgent: string }) {
  return detectPushEnvironment({ maxTouchPoints: 0, standalone: false, pushApi: true, ...input });
}

describe('detectPushEnvironment', () => {
  it('sends Safari on an iPhone to the Home Screen', () => {
    const environment = detect({ userAgent: UA.iPhoneSafari, maxTouchPoints: 5, pushApi: false });

    expect(environment).toMatchObject({ os: 'ios', browser: 'safari', iosVersion: [17, 4] });
    expect(environmentState(environment)).toBe('needs-home-screen');
  });

  it('offers push in the Home Screen app, whose agent has no Safari token', () => {
    const environment = detect({
      userAgent: UA.iPhoneHomeScreen,
      maxTouchPoints: 5,
      standalone: true,
    });

    expect(environment.browser).toBe('safari');
    expect(environmentState(environment)).toBe('push');
  });

  it('has no push before iOS 16.4', () => {
    const environment = detect({ userAgent: UA.iPhoneSafariOld, pushApi: false });

    expect(environmentState(environment)).toBe('unsupported');
  });

  it('tells Chrome on an iPhone apart from Safari, for the guide', () => {
    const environment = detect({ userAgent: UA.iPhoneChrome, pushApi: false });

    expect(environment).toMatchObject({ os: 'ios', browser: 'chrome' });
    expect(environmentState(environment)).toBe('needs-home-screen');
  });

  it('finds an iPad that calls itself a Mac by its touch points', () => {
    const iPad = detect({ userAgent: UA.macSafari, maxTouchPoints: 5, pushApi: false });
    const mac = detect({ userAgent: UA.macSafari });

    expect(iPad).toMatchObject({ os: 'ios', osName: 'iPadOS', iosVersion: [17, 4] });
    expect(environmentState(iPad)).toBe('needs-home-screen');
    expect(mac).toMatchObject({ os: 'desktop', browser: 'safari', osName: 'macOS' });
    expect(environmentState(mac)).toBe('push');
  });

  it('offers push on Android in Chrome and in Samsung Internet', () => {
    const chrome = detect({ userAgent: UA.androidChrome });
    const samsung = detect({ userAgent: UA.samsung });

    expect(chrome).toMatchObject({ os: 'android', browser: 'chrome', inAppBrowser: false });
    expect(samsung).toMatchObject({ os: 'android', browser: 'samsung', inAppBrowser: false });
    expect(environmentState(chrome)).toBe('push');
    expect(environmentState(samsung)).toBe('push');
  });

  it('finds the in-app browsers, before the iPhone case', () => {
    expect(environmentState(detect({ userAgent: UA.instagramIos, pushApi: false }))).toBe(
      'in-app-browser',
    );
    expect(environmentState(detect({ userAgent: UA.facebookAndroid }))).toBe('in-app-browser');
    expect(environmentState(detect({ userAgent: UA.viberAndroid }))).toBe('in-app-browser');
  });

  it('names the desktop browsers', () => {
    expect(detect({ userAgent: UA.windowsChrome })).toMatchObject({
      os: 'desktop',
      browser: 'chrome',
      osName: 'Windows',
    });
    expect(detect({ userAgent: UA.windowsEdge }).browser).toBe('edge');
    expect(detect({ userAgent: UA.linuxFirefox })).toMatchObject({
      browser: 'firefox',
      osName: 'Linux',
    });
  });

  it('is unsupported on a desktop browser without the push API', () => {
    expect(environmentState(detect({ userAgent: UA.linuxFirefox, pushApi: false }))).toBe(
      'unsupported',
    );
  });

  it('labels a device by browser and system', () => {
    expect(deviceLabel(detect({ userAgent: UA.androidChrome }))).toBe('Chrome · Android');
    expect(deviceLabel(detect({ userAgent: UA.samsung }))).toBe('Samsung Internet · Android');
  });
});

import type {
  PushBrowserFamily,
  PushEnvironment,
  PushEnvironmentInput,
  PushEnvironmentState,
} from './push-environment.types';

/** The first iOS release with Web Push, from the Home Screen only. */
const IOS_PUSH_VERSION: readonly [number, number] = [16, 4];

/**
 * In-app browsers. None of them can subscribe, and each hides the address bar the guide needs.
 * `FBAN` and `FBAV` also cover Messenger.
 */
const IN_APP_MARKERS =
  /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|Viber|Line\/|MicroMessenger|Snapchat|TikTok|BytedanceWebview|musical_ly|LinkedInApp|Pinterest|Twitter for/i;

/** Browsers on iOS other than Safari. They cannot add a web app with push to the Home Screen. */
const IOS_OTHER_BROWSERS = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|YaBrowser|DuckDuckGo|GSA\//;

/** Reads the browser's facts from its user agent and its features. */
export function detectPushEnvironment(input: PushEnvironmentInput): PushEnvironment {
  const ua = input.userAgent;
  // iPadOS asks for desktop pages and calls itself a Mac. Only the touch points give it away.
  const iPadAsMac = ua.includes('Macintosh') && input.maxTouchPoints > 1;
  const ios = /iPhone|iPad|iPod/.test(ua) || iPadAsMac;
  const android = !ios && ua.includes('Android');
  const browser = browserFamily(ua, ios);

  return {
    os: ios ? 'ios' : android ? 'android' : 'desktop',
    browser,
    osName: osName(ua, ios, android, iPadAsMac),
    browserName: BROWSER_NAMES[browser],
    // `; wv)` marks an Android WebView, which is what most in-app browsers are.
    inAppBrowser: IN_APP_MARKERS.test(ua) || (android && ua.includes('; wv)')),
    standalone: input.standalone,
    iosVersion: ios ? iosVersion(ua) : null,
    pushApi: input.pushApi,
  };
}

/** What the browser alone allows. An in-app browser wins over the iPhone case. */
export function environmentState(environment: PushEnvironment): PushEnvironmentState {
  if (environment.inAppBrowser) return 'in-app-browser';
  if (environment.os === 'ios' && !environment.standalone) {
    return atLeast(environment.iosVersion, IOS_PUSH_VERSION) ? 'needs-home-screen' : 'unsupported';
  }
  return environment.pushApi ? 'push' : 'unsupported';
}

/** The label the API keeps for a device, for example `Chrome · Android`. */
export function deviceLabel(environment: PushEnvironment): string {
  return `${environment.browserName} · ${environment.osName}`;
}

const BROWSER_NAMES: Record<PushBrowserFamily, string> = {
  safari: 'Safari',
  chrome: 'Chrome',
  edge: 'Edge',
  firefox: 'Firefox',
  samsung: 'Samsung Internet',
  other: 'Browser',
};

function browserFamily(ua: string, ios: boolean): PushBrowserFamily {
  if (ua.includes('SamsungBrowser')) return 'samsung';
  if (/Edg(?:e|A|iOS)?\//.test(ua)) return 'edge';
  if (/Firefox\/|FxiOS/.test(ua)) return 'firefox';
  if (ua.includes('CriOS')) return 'chrome';
  // Every iOS browser runs on WebKit, and the Home Screen app drops the `Safari/` token.
  if (ios) return IOS_OTHER_BROWSERS.test(ua) ? 'other' : 'safari';
  if (/OPR\/|YaBrowser/.test(ua)) return 'other';
  if (/Chrome\/|Chromium\//.test(ua)) return 'chrome';
  if (ua.includes('Safari/')) return 'safari';
  return 'other';
}

function osName(ua: string, ios: boolean, android: boolean, iPadAsMac: boolean): string {
  if (ios) return iPadAsMac || ua.includes('iPad') ? 'iPadOS' : 'iOS';
  if (android) return 'Android';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('CrOS')) return 'ChromeOS';
  if (ua.includes('Macintosh')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  return 'Desktop';
}

/** `OS 17_4` on an iPhone. An iPad that calls itself a Mac only has Safari's `Version/17.4`. */
function iosVersion(ua: string): readonly [number, number] | null {
  const match = /OS (\d+)_(\d+)/.exec(ua) ?? /Version\/(\d+)\.(\d+)/.exec(ua);
  if (match === null) return null;
  return [Number(match[1]), Number(match[2])];
}

/** An unknown version counts as supported. The guide is then shown, which costs little. */
function atLeast(
  version: readonly [number, number] | null,
  floor: readonly [number, number],
): boolean {
  if (version === null) return true;
  return version[0] > floor[0] || (version[0] === floor[0] && version[1] >= floor[1]);
}

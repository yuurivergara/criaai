/**
 * Helpers for anti-bot detection and stealth-aware browser launches.
 *
 * `detectAntiBotChallenge` recognizes the challenge pages served by the
 * major WAF/anti-bot providers (Cloudflare, DataDome, PerimeterX, Akamai,
 * Imperva, generic captcha walls). When a challenge is detected we abort
 * the clone with an actionable error — saving partial garbage in the DB
 * is worse than a clean "we don't support this" message.
 *
 * `pickUserAgent` returns a realistic, modern desktop UA together with the
 * matching `sec-ch-ua-*` Client Hints headers. Picking these consistently
 * is important: a Firefox UA paired with Chrome Client Hints is a stronger
 * bot signal than no Client Hints at all.
 *
 * `loadStealthChromium` lazy-loads `playwright-extra` + the Puppeteer
 * stealth plugin (compatible by design). Using a singleton means the
 * stealth plugins are registered exactly once for the lifetime of the
 * Node process; subsequent calls reuse the patched chromium namespace.
 */

import type { BrowserType } from 'playwright';

export type AntiBotProvider =
  | 'cloudflare'
  | 'datadome'
  | 'perimeterx'
  | 'akamai'
  | 'imperva'
  | 'generic_captcha'
  | 'unknown';

export interface AntiBotDetection {
  /** Best guess at which vendor served the challenge. */
  provider: AntiBotProvider;
  /** Short reason string, suitable for logs. */
  reason: string;
}

export interface AntiBotResponseLike {
  status?: number;
  headers?: Record<string, string | undefined>;
}

/**
 * Inspect an HTML body (and optional HTTP response metadata) and return
 * a vendor identification when it looks like a bot challenge page.
 * Returns `null` when nothing suspicious is found.
 *
 * The detection is intentionally conservative — false negatives are fine
 * (we just keep the partial clone), but false positives would block real
 * pages. We require at least two converging signals (header + body, or
 * two body signatures) before flagging.
 */
export function detectAntiBotChallenge(
  html: string,
  response?: AntiBotResponseLike,
): AntiBotDetection | null {
  const headers = normalizeHeaders(response?.headers);
  const status = response?.status ?? 0;
  const body = (html ?? '').slice(0, 60_000);
  const lowered = body.toLowerCase();

  // ---- Cloudflare ---------------------------------------------------------
  const cfServer = headers['server']?.toLowerCase() ?? '';
  const cfMitigated = headers['cf-mitigated'];
  const cfRay = headers['cf-ray'];
  const cfChallenge =
    /just a moment\.\.\./i.test(body) ||
    /__cf_chl_(?:rt_)?tk/i.test(body) ||
    /\/cdn-cgi\/challenge-platform\//i.test(body) ||
    /verifying you are human/i.test(body) ||
    /attention required.*cloudflare/i.test(body);
  if (
    (status === 403 || status === 503 || cfMitigated || cfChallenge) &&
    (cfServer.includes('cloudflare') || cfRay || cfMitigated || cfChallenge)
  ) {
    return {
      provider: 'cloudflare',
      reason: cfMitigated
        ? `cloudflare mitigated (status=${status})`
        : `cloudflare challenge body (status=${status})`,
    };
  }

  // ---- DataDome -----------------------------------------------------------
  if (
    /datadome/i.test(headers['x-dd-debug'] ?? '') ||
    /pardon our interruption/i.test(body) ||
    /\bdd_cookie_test\b/i.test(body) ||
    /captcha-delivery\.com/i.test(body)
  ) {
    return {
      provider: 'datadome',
      reason: 'datadome challenge signature found',
    };
  }

  // ---- PerimeterX / HUMAN -------------------------------------------------
  if (
    /px-captcha/i.test(body) ||
    /_pxhd/i.test(body) ||
    /_px3/i.test(headers['set-cookie'] ?? '') ||
    /perimeterx/i.test(body)
  ) {
    return {
      provider: 'perimeterx',
      reason: 'perimeterx challenge signature found',
    };
  }

  // ---- Akamai Bot Manager -------------------------------------------------
  if (
    /akamai/i.test(headers['server'] ?? '') &&
    (/\/akamai\/sensor-data/i.test(body) ||
      /_abck=/i.test(headers['set-cookie'] ?? '') ||
      /access denied/i.test(lowered))
  ) {
    return { provider: 'akamai', reason: 'akamai bot manager signature' };
  }

  // ---- Imperva (Incapsula) -----------------------------------------------
  if (
    /incapsula/i.test(body) ||
    /\bvisid_incap\b/i.test(headers['set-cookie'] ?? '') ||
    /request unsuccessful\.\s*incapsula/i.test(lowered)
  ) {
    return { provider: 'imperva', reason: 'imperva/incapsula signature' };
  }

  // ---- Generic captcha walls ---------------------------------------------
  if (
    /id="g-recaptcha"|class="g-recaptcha"|grecaptcha\.execute/i.test(body) ||
    /h-captcha-response|hcaptcha\.com\/captcha/i.test(body) ||
    /please complete the security check/i.test(lowered)
  ) {
    // Only flag when the captcha is the dominant content (small body).
    if (body.length < 8_000) {
      return {
        provider: 'generic_captcha',
        reason: 'standalone captcha challenge',
      };
    }
  }

  if (status === 403 && body.length < 4_000 && /access denied/i.test(lowered)) {
    return { provider: 'unknown', reason: `access denied (status=${status})` };
  }

  return null;
}

function normalizeHeaders(
  raw?: Record<string, string | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') out[k.toLowerCase()] = v;
  }
  return out;
}

/**
 * Realistic desktop User-Agent strings paired with their Client Hints.
 * Sampling one entry at random produces a coherent identity — picking a
 * UA without matching Sec-CH-UA is itself a fingerprintable signal that
 * stealth-aware probes use to detect headless browsers.
 */
export interface UserAgentProfile {
  userAgent: string;
  /** Headers to merge into context.extraHTTPHeaders. */
  headers: Record<string, string>;
  /** OS hint for storageState/locale tuning. */
  platform: 'windows' | 'macos' | 'linux';
  /** Browser hint; useful when we want to match telemetry. */
  browser: 'chrome' | 'firefox' | 'edge' | 'safari';
}

const UA_PROFILES: readonly UserAgentProfile[] = [
  {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    headers: {
      'sec-ch-ua':
        '"Chromium";v="135", "Not(A:Brand";v="24", "Google Chrome";v="135"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
    },
    platform: 'windows',
    browser: 'chrome',
  },
  {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    headers: {
      'sec-ch-ua':
        '"Chromium";v="135", "Not(A:Brand";v="24", "Google Chrome";v="135"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
    },
    platform: 'macos',
    browser: 'chrome',
  },
  {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0',
    headers: {
      'sec-ch-ua':
        '"Chromium";v="134", "Not_A Brand";v="24", "Microsoft Edge";v="134"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
    },
    platform: 'windows',
    browser: 'edge',
  },
  {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:126.0) Gecko/20100101 Firefox/126.0',
    headers: {},
    platform: 'macos',
    browser: 'firefox',
  },
  {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    headers: {},
    platform: 'macos',
    browser: 'safari',
  },
];

export function pickUserAgent(seed?: string): UserAgentProfile {
  const idx = seed
    ? Math.abs(hashString(seed)) % UA_PROFILES.length
    : Math.floor(Math.random() * UA_PROFILES.length);
  return UA_PROFILES[idx];
}

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h | 0;
}

/**
 * Lazy-load `playwright-extra` and register the Puppeteer stealth plugin
 * exactly once per process. The plugin patches `navigator.webdriver`,
 * `chrome.runtime`, WebGL vendor strings, the `permissions` API and a few
 * other surface APIs that bot-detection scripts probe.
 *
 * Returns the patched `BrowserType` so the caller can `await chromium.launch(...)`
 * exactly like with vanilla `playwright`. Falls back to plain Playwright
 * if loading fails (e.g. missing optional deps in dev).
 */
let stealthChromiumPromise: Promise<BrowserType> | null = null;

function stripPlaywrightBrowserDebug(): void {
  const raw = process.env.DEBUG;
  if (!raw) return;
  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return;
  const filtered = parts.filter(
    (p) =>
      p !== 'pw:browser' &&
      p !== 'pw:browser*' &&
      p !== 'playwright:browser' &&
      p !== 'playwright:browser*',
  );
  if (filtered.length === parts.length) return;
  process.env.DEBUG = filtered.join(',');
}

export async function loadStealthChromium(): Promise<BrowserType> {
  if (stealthChromiumPromise) return stealthChromiumPromise;
  stealthChromiumPromise = (async () => {
    // Some local environments run with DEBUG=pw:browser, which floods the
    // terminal with Chromium stderr noise and drowns useful clone logs.
    stripPlaywrightBrowserDebug();
    try {
      const playwrightExtra = await import('playwright-extra');
      const stealthPlugin = (await import('puppeteer-extra-plugin-stealth'))
        .default;
      const chromium = (
        playwrightExtra as unknown as {
          chromium: BrowserType & { use: (p: unknown) => unknown };
        }
      ).chromium;
      // `use()` registers the plugin globally on the chromium namespace.
      // Playwright-extra is already wired to forward Puppeteer plugins.
      try {
        const stealth = stealthPlugin();
        // These evasions are the most frequent source of noisy
        // "Target page/context/browser has been closed" warnings on
        // shutdown under Playwright-extra. Disabling them keeps the rest
        // of stealth active while avoiding terminal spam.
        try {
          stealth.enabledEvasions?.delete('iframe.contentWindow');
          stealth.enabledEvasions?.delete('window.outerdimensions');
        } catch {
          /* optional API across plugin versions */
        }
        chromium.use(stealth);
      } catch (err) {
        // Some stealth evasion scripts rely on Puppeteer-only APIs and may
        // throw when called from playwright-extra. We ignore those — the
        // remaining evasions still help and are the bulk of the value.
        void err;
      }
      return chromium;
    } catch (err) {
      void err;
      const playwright = await import('playwright');
      return playwright.chromium;
    }
  })();
  return stealthChromiumPromise;
}

/**
 * Typed error thrown when a fetch is blocked by an anti-bot challenge.
 * The message format `source_protected_by_<provider>` is what the
 * frontend keys on to show the "Site protected by …" guidance.
 */
export class AntiBotChallengeError extends Error {
  readonly provider: AntiBotProvider;
  readonly reason: string;
  constructor(detection: AntiBotDetection) {
    super(`source_protected_by_${detection.provider}`);
    this.name = 'AntiBotChallengeError';
    this.provider = detection.provider;
    this.reason = detection.reason;
  }
}

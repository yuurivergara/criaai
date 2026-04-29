/**
 * Open-source tracking blocklist used to strip third-party analytics/ads
 * scripts from cloned HTML before it is persisted or served.
 *
 * Domain list curated from the public DuckDuckGo Tracker Radar
 * (https://github.com/duckduckgo/tracker-radar) categories
 * "Advertising"/"Analytics" — frozen here so the project has no runtime
 * network dependency and stays MIT-clean. Update periodically.
 *
 * Inline patterns cover snippets that don't use a `<script src>` (gtag,
 * fbq, dataLayer, etc.). They are matched as case-insensitive regex
 * fragments against the `<script>` body text.
 */

/** Hostname (or hostname suffix) of the tracker. Match is by `.endsWith()`. */
export const TRACKING_DOMAINS: readonly string[] = [
  'google-analytics.com',
  'googletagmanager.com',
  'googleadservices.com',
  'doubleclick.net',
  'googlesyndication.com',
  'ads.google.com',
  'stats.g.doubleclick.net',
  'facebook.com/tr',
  'facebook.net',
  'connect.facebook.net',
  'pixel.facebook.com',
  'graph.facebook.com',
  'static.xx.fbcdn.net',
  'analytics.tiktok.com',
  'ads.tiktok.com',
  'business-api.tiktok.com',
  'ads-api.tiktok.com',
  'static.ads-twitter.com',
  'analytics.twitter.com',
  'ads-twitter.com',
  'linkedin.com/li/track',
  'ads.linkedin.com',
  'snap.licdn.com',
  'px.ads.linkedin.com',
  'ads.pinterest.com',
  'analytics.pinterest.com',
  'ct.pinterest.com',
  'static.hotjar.com',
  'script.hotjar.com',
  'vars.hotjar.com',
  'www.clarity.ms',
  'c.clarity.ms',
  'cdn.mxpnl.com',
  'api.mixpanel.com',
  'cdn.segment.com',
  'api.segment.io',
  'cdn.segment.io',
  'cdn.amplitude.com',
  'api.amplitude.com',
  'api2.amplitude.com',
  'cdn.heapanalytics.com',
  'heap.io',
  'matomo.cloud',
  'matomo.org',
  'stats.wp.com',
  'pixel.wp.com',
  'scorecardresearch.com',
  'quantserve.com',
  'criteo.net',
  'criteo.com',
  'outbrain.com',
  'taboola.com',
  'mc.yandex.ru',
  'mc.yandex.com',
  'vk.com/rtrg',
  'appsflyer.com',
  'branch.io',
  'kissmetrics.io',
  'newrelic.com/agent',
  'bam.nr-data.net',
  'fullstory.com',
  'edge.fullstory.com',
  'fs.fullstory.com',
  'logrocket.com',
  'cdn.lr-ingest.io',
  'cdn.smartlook.com',
  'cdn.smartlook.cloud',
  'rec.smartlook.com',
  'snowplowanalytics.com',
  'stats.optimizely.com',
  'cdn.optimizely.com',
  'logx.optimizely.com',
  'rum.perfops.net',
  'p.adsymptotic.com',
  'p.typekit.net',
  'ads.yahoo.com',
  'analytics.yahoo.com',
  'sb.scorecardresearch.com',
  'tags.tiqcdn.com',
  'tags.bkrtx.com',
  'logs.utag.io',
  'cm.everesttech.net',
  'everesttech.net',
  'demdex.net',
  'omtrdc.net',
  '2o7.net',
  'cdn.wpadm.com',
  'rtb.adentifi.com',
  'secure.adnxs.com',
  'ib.adnxs.com',
  'rtb-csync.smartadserver.com',
  'rtb-eu.openx.net',
  'advangelists.com',
  'moatads.com',
  'z.moatads.com',
  'geo.moatads.com',
  'px.moatads.com',
  'hb-api.omnitagjs.com',
  'track.adform.net',
  'secure.adform.net',
  'log.outbrain.com',
  'trc.taboola.com',
];

/**
 * Regex fragments matched (case-insensitive) against inline script bodies.
 * A single match marks the script as "tracking" and removes it.
 */
export const TRACKING_INLINE_PATTERNS: readonly string[] = [
  'fbq\\s*\\(',
  'gtag\\s*\\(',
  '_gaq\\s*\\.\\s*push',
  'ga\\s*\\(\\s*[\'"]',
  'dataLayer\\s*\\.\\s*push',
  '_paq\\s*\\.\\s*push',
  'ttq\\s*\\.\\s*track',
  'twq\\s*\\(\\s*[\'"]',
  '_linkedin_partner_id',
  'snaptr\\s*\\(',
  'lintrk\\s*\\(',
  'pintrk\\s*\\(',
  'rdt\\s*\\(\\s*[\'"]',
  'amplitude\\s*\\.\\s*getInstance',
  'analytics\\s*\\.\\s*track\\s*\\(',
  'mixpanel\\s*\\.\\s*track',
  'Hotjar\\s*\\(\\s*[\'"]?',
  '_hjSettings',
  'hotjar\\.com',
  'clarity\\s*\\(\\s*[\'"]?',
  'clarityScript',
  'FS\\.identify',
  'fullStorySetIdentity',
  'LogRocket\\s*\\.\\s*init',
  'smartlook\\s*\\(',
  'ym\\s*\\(\\s*\\d',
  'yaCounter\\d+',
  'VK\\s*\\.\\s*Retargeting',
  '_satellite',
  's_account',
  's_code',
  'Optimizely\\s*\\.\\s*push',
  'optimizely\\s*\\.\\s*push',
];

/**
 * Compiled OR-regex of all inline patterns. Used by the cleaner.
 */
export const TRACKING_INLINE_REGEX = new RegExp(
  TRACKING_INLINE_PATTERNS.join('|'),
  'i',
);

/** Returns true if the given URL belongs to a tracker. */
export function isTrackingUrl(url: string): boolean {
  if (!url) return false;
  let host: string;
  let pathname = '';
  try {
    const parsed = new URL(url, 'https://example.com');
    host = parsed.host.toLowerCase();
    pathname = parsed.pathname.toLowerCase();
  } catch {
    host = url.toLowerCase();
  }
  for (const domain of TRACKING_DOMAINS) {
    const lowered = domain.toLowerCase();
    if (lowered.includes('/')) {
      const [d, p] = lowered.split('/', 2);
      if (host.endsWith(d) && pathname.startsWith('/' + p)) {
        return true;
      }
      continue;
    }
    if (host === lowered || host.endsWith('.' + lowered)) {
      return true;
    }
  }
  return false;
}

/** Returns true if an inline script body contains a known tracking pattern. */
export function isTrackingInlineSnippet(body: string): boolean {
  if (!body) return false;
  return TRACKING_INLINE_REGEX.test(body);
}

/**
 * Crawler helpers — sitemap discovery + minimal robots.txt parser.
 *
 * The cloning pipeline used to discover internal pages purely by
 * scraping `<a href>` from the source's first paint. That misses every
 * SPA route, every page only reachable from a footer that loads after
 * hydration, and the long tail of pages site owners list in
 * `sitemap.xml` precisely so robots can find them.
 *
 * This module provides:
 *   - `fetchSitemapUrls(baseUrl, ...)` — pulls /sitemap.xml and
 *     /sitemap_index.xml (recursively expanding nested indexes) and
 *     returns a deduplicated list of same-host URLs.
 *   - `fetchRobotsRules(baseUrl, userAgent, ...)` — parses the host
 *     robots.txt for the closest UA stanza and returns its allow/deny
 *     rules.
 *   - `isRobotsAllowed(url, rules)` — applies the parsed rules to a
 *     single URL using the standard "longest match wins, allow beats
 *     disallow on tie" semantics.
 *
 * Network calls are intentionally lightweight: 8s timeouts, single
 * attempt, swallow-on-error. A site without a sitemap or with a broken
 * robots.txt should not break the clone job — we fall back silently to
 * the existing link extraction.
 */

import { load } from 'cheerio';

export interface RobotsRule {
  type: 'allow' | 'disallow';
  pattern: string;
}

export interface RobotsRules {
  /** Group rules — applied to the chosen UA stanza. */
  rules: RobotsRule[];
  /** Crawl-delay in seconds, when present. Currently advisory only. */
  crawlDelaySec?: number;
  /** Sitemap URLs declared in robots.txt. */
  sitemaps: string[];
}

const FETCH_TIMEOUT_MS = 8000;
const MAX_SITEMAP_DEPTH = 3;
const MAX_SITEMAP_URLS = 5000;

async function safeFetch(
  url: string,
  userAgent: string,
): Promise<{ status: number; body: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': userAgent,
        Accept: 'application/xml,text/xml,text/plain,*/*;q=0.8',
      },
    });
    if (!response.ok) {
      return { status: response.status, body: '' };
    }
    const body = await response.text();
    return { status: response.status, body };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pulls and parses sitemap(s) for the host of `baseUrl`. Recursively
 * follows sitemap indexes up to `MAX_SITEMAP_DEPTH` levels deep and
 * caps the total URL count at `MAX_SITEMAP_URLS` so a hostile site
 * can't OOM the worker by pointing at a sitemap of its entire CDN.
 */
export async function fetchSitemapUrls(
  baseUrl: string,
  userAgent: string,
  extraSitemapUrls: string[] = [],
): Promise<string[]> {
  let origin: string;
  let baseHost: string;
  try {
    const parsed = new URL(baseUrl);
    origin = parsed.origin;
    baseHost = parsed.host;
  } catch {
    return [];
  }

  const seedSitemaps = new Set<string>([
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    ...extraSitemapUrls,
  ]);

  const visited = new Set<string>();
  const collected = new Set<string>();
  const stack: Array<{ url: string; depth: number }> = [];
  for (const url of seedSitemaps) {
    stack.push({ url, depth: 0 });
  }

  while (stack.length > 0 && collected.size < MAX_SITEMAP_URLS) {
    const next = stack.pop();
    if (!next) break;
    if (visited.has(next.url)) continue;
    visited.add(next.url);
    if (next.depth > MAX_SITEMAP_DEPTH) continue;

    const fetched = await safeFetch(next.url, userAgent);
    if (!fetched || !fetched.body) continue;

    const body = fetched.body;
    const $ = load(body, { xmlMode: true });

    // Sitemap index → push children onto the stack.
    $('sitemapindex sitemap loc').each((_i, el) => {
      const childUrl = $(el).text().trim();
      if (childUrl) {
        stack.push({ url: childUrl, depth: next.depth + 1 });
      }
    });

    // urlset → collect leaf URLs.
    $('urlset url loc').each((_i, el) => {
      const candidate = $(el).text().trim();
      if (!candidate) return;
      try {
        const parsed = new URL(candidate);
        if (parsed.host !== baseHost) return;
        parsed.hash = '';
        collected.add(parsed.toString());
      } catch {
        /* swallow */
      }
    });
  }

  return [...collected];
}

/**
 * Parses /robots.txt for `baseUrl` and returns the rule set that
 * matches our UA most specifically. Implementation follows the de-facto
 * standard rather than the unreleased RFC: longest matching User-Agent
 * stanza wins, with `*` as the catch-all fallback.
 *
 * Empty / missing robots.txt is reported as "no rules" (everything
 * allowed) — the polite default for sites that haven't published any
 * preferences.
 */
export async function fetchRobotsRules(
  baseUrl: string,
  userAgent: string,
): Promise<RobotsRules> {
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return { rules: [], sitemaps: [] };
  }
  const fetched = await safeFetch(`${origin}/robots.txt`, userAgent);
  if (!fetched || !fetched.body || fetched.status !== 200) {
    return { rules: [], sitemaps: [] };
  }
  return parseRobotsTxt(fetched.body, userAgent);
}

export function parseRobotsTxt(body: string, userAgent: string): RobotsRules {
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*$/, '').trim())
    .filter(Boolean);

  const groups: Array<{
    agents: string[];
    rules: RobotsRule[];
    crawlDelaySec?: number;
  }> = [];
  const sitemaps: string[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;

  for (const line of lines) {
    const sepIndex = line.indexOf(':');
    if (sepIndex < 0) continue;
    const directive = line.slice(0, sepIndex).trim().toLowerCase();
    const value = line.slice(sepIndex + 1).trim();

    if (directive === 'sitemap') {
      if (value) sitemaps.push(value);
      continue;
    }

    if (directive === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }

    lastWasAgent = false;
    if (!current) continue;
    if (directive === 'disallow') {
      current.rules.push({ type: 'disallow', pattern: value });
    } else if (directive === 'allow') {
      current.rules.push({ type: 'allow', pattern: value });
    } else if (directive === 'crawl-delay') {
      const num = Number.parseFloat(value);
      if (!Number.isNaN(num) && num >= 0) {
        current.crawlDelaySec = num;
      }
    }
  }

  const uaLower = userAgent.toLowerCase();
  let bestMatch: (typeof groups)[number] | null = null;
  let bestSpecificity = -1;
  for (const group of groups) {
    for (const agent of group.agents) {
      if (agent === '*') {
        if (bestSpecificity < 0) {
          bestMatch = group;
          bestSpecificity = 0;
        }
      } else if (uaLower.includes(agent)) {
        if (agent.length > bestSpecificity) {
          bestMatch = group;
          bestSpecificity = agent.length;
        }
      }
    }
  }

  return {
    rules: bestMatch?.rules ?? [],
    crawlDelaySec: bestMatch?.crawlDelaySec,
    sitemaps,
  };
}

/**
 * Apply parsed robots rules to a URL. Returns `true` when the URL is
 * allowed, `false` when it's explicitly disallowed.
 *
 * Conflict resolution: the LONGEST matching pattern wins. If an Allow
 * and a Disallow tie on length, Allow wins (Google + Bingbot
 * convention).
 */
export function isRobotsAllowed(url: string, rules: RobotsRules): boolean {
  if (!rules.rules.length) return true;
  let path: string;
  try {
    const parsed = new URL(url);
    path = parsed.pathname + (parsed.search ?? '');
  } catch {
    return true;
  }

  let best: { rule: RobotsRule; length: number } | null = null;
  for (const rule of rules.rules) {
    if (rule.pattern === '') {
      // Empty pattern means "match nothing" for Disallow (per spec) and
      // "allow everything" for Allow. Either way it doesn't override
      // longer patterns.
      if (rule.type === 'allow' && (!best || best.length < 0)) {
        best = { rule, length: 0 };
      }
      continue;
    }
    if (matchRobotsPattern(path, rule.pattern)) {
      const length = rule.pattern.length;
      if (
        !best ||
        length > best.length ||
        (length === best.length && rule.type === 'allow')
      ) {
        best = { rule, length };
      }
    }
  }

  return best ? best.rule.type === 'allow' : true;
}

function matchRobotsPattern(path: string, pattern: string): boolean {
  // robots.txt patterns:
  //   - `*` matches any sequence of characters.
  //   - `$` at the end anchors to the end of the URL.
  //   - everything else is literal.
  const anchored = pattern.endsWith('$');
  const raw = anchored ? pattern.slice(0, -1) : pattern;
  const regexBody = raw
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  const regex = new RegExp(`^${regexBody}${anchored ? '$' : ''}`);
  return regex.test(path);
}

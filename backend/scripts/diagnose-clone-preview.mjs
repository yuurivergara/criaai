import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';

/**
 * Two modes:
 *   1. Single URL: `node ./scripts/diagnose-clone-preview.mjs <url>`
 *      Backwards-compatible behavior. Renders the URL, prints visual
 *      stats and a screenshot.
 *   2. Suite: `node ./scripts/diagnose-clone-preview.mjs --suite [path]`
 *      Iterates over every fixture in `backend/test/clone-fixtures.json`
 *      (or the path supplied) and reports a per-URL score using the
 *      same agnostic signals our pipeline scores snapshots with. Useful
 *      to detect regressions across providers (Cakto, Kiwify, Webflow,
 *      Wix, WordPress, Next.js) and to confirm we still fail FAST on
 *      Cloudflare-protected origins.
 *
 * The script does NOT run the full clone pipeline (no Nest, no Prisma,
 * no Bull) — it directly drives Playwright with the same UA we use in
 * production so the metrics are comparable. The pipeline-specific
 * behavior (anti-bot detection, MHTML scoring, walker) is exercised by
 * the integration tests, not here.
 */

const args = process.argv.slice(2);
const isSuite = args.includes('--suite');
const targetUrl = !isSuite ? args[0] : null;
const suitePath =
  isSuite && args[args.indexOf('--suite') + 1] && !args[args.indexOf('--suite') + 1].startsWith('--')
    ? args[args.indexOf('--suite') + 1]
    : null;

if (!isSuite && !targetUrl) {
  console.error(
    'Usage:\n' +
      '  node ./scripts/diagnose-clone-preview.mjs <url>\n' +
      '  node ./scripts/diagnose-clone-preview.mjs --suite [path-to-clone-fixtures.json]',
  );
  process.exit(1);
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

const ANTI_BOT_SIGNATURES = [
  { provider: 'cloudflare', needle: 'just a moment...' },
  { provider: 'cloudflare', needle: 'verifying you are human' },
  { provider: 'cloudflare', needle: '__cf_chl_rt_tk' },
  { provider: 'datadome', needle: 'pardon our interruption' },
  { provider: 'perimeterx', needle: 'px-captcha' },
  { provider: 'recaptcha', needle: 'g-recaptcha' },
  { provider: 'hcaptcha', needle: 'h-captcha' },
];

async function probeUrl(browser, url) {
  const context = await browser.newContext({
    userAgent: UA,
    locale: 'pt-BR',
    viewport: { width: 1366, height: 820 },
    timezoneId: 'America/Sao_Paulo',
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const failedRequests = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('requestfailed', (request) => {
    failedRequests.push({
      url: request.url(),
      method: request.method(),
      error: request.failure()?.errorText ?? 'unknown',
    });
  });

  let response;
  let navigationError = null;
  try {
    response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 25000,
    });
  } catch (err) {
    navigationError = err instanceof Error ? err.message : String(err);
  }

  await page
    .waitForLoadState('networkidle', { timeout: 8000 })
    .catch(() => undefined);

  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    for (let i = 0; i < 12; i += 1) {
      window.scrollBy(0, Math.max(360, Math.floor(window.innerHeight * 0.7)));
      await sleep(220);
    }
  });

  await page.waitForTimeout(800);

  const stats = await page.evaluate(() => {
    const visibleArea = (el) => {
      const rect = el.getBoundingClientRect();
      return rect.width * rect.height;
    };
    const bodyText = (document.body?.innerText || '').trim();
    const imgs = Array.from(document.querySelectorAll('img'));
    const iframes = Array.from(document.querySelectorAll('iframe'));
    const videos = Array.from(document.querySelectorAll('video'));
    const visibleImgs = imgs.filter(
      (img) =>
        (img.currentSrc || img.getAttribute('src')) && visibleArea(img) > 2000,
    );
    return {
      url: window.location.href,
      title: document.title,
      bodyTextLength: bodyText.length,
      bodyTextSample: bodyText.slice(0, 200),
      imagesVisible: visibleImgs.length,
      imagesNaturalReady: visibleImgs.filter((img) => img.naturalWidth > 0).length,
      iframesVisible: iframes.filter(
        (frame) => frame.getAttribute('src') && visibleArea(frame) > 3000,
      ).length,
      videosVisible: videos.filter(
        (video) =>
          (video.currentSrc ||
            video.getAttribute('src') ||
            video.getAttribute('poster')) &&
          visibleArea(video) > 3000,
      ).length,
      lazyHints: document.querySelectorAll(
        '[loading="lazy"], [data-src], [data-lazy], [data-lazy-src], [class*="skeleton"], [class*="placeholder"], [class*="shimmer"]',
      ).length,
      htmlLength: document.documentElement.outerHTML.length,
    };
  });

  const html = await page.content();
  const lowered = html.toLowerCase();
  const antiBotHit = ANTI_BOT_SIGNATURES.find((sig) => lowered.includes(sig.needle));
  const status = response?.status() ?? null;
  const cfMitigatedHeader = response?.headers()?.['cf-mitigated'] ?? null;
  const serverHeader = response?.headers()?.['server'] ?? null;
  const antiBotDetected =
    !!antiBotHit ||
    (status && status >= 500 && /cloudflare/i.test(serverHeader || '')) ||
    (status === 403 && !!cfMitigatedHeader);

  await context.close();

  return {
    stats,
    consoleErrors: consoleErrors.slice(0, 20),
    failedRequests: failedRequests.slice(0, 30),
    navigationError,
    status,
    antiBot: antiBotDetected
      ? {
          detected: true,
          provider: antiBotHit?.provider ?? 'cloudflare',
          server: serverHeader,
        }
      : { detected: false },
  };
}

/**
 * Language-agnostic snapshot quality score, mirrors
 * `scoreCandidateHtml` in single-file.util.ts. Output is in the
 * 0..100+ range; >=70 means "looks like a real page rendered correctly".
 */
function scoreSnapshot(stats) {
  if (!stats) return 0;
  let score = 0;
  score += Math.min(40, Math.floor(stats.bodyTextLength / 50));
  score += Math.min(20, stats.imagesVisible * 4);
  score += Math.min(10, stats.imagesNaturalReady * 2);
  score += Math.min(10, stats.iframesVisible * 4);
  score += Math.min(10, stats.videosVisible * 4);
  score -= Math.min(20, Math.max(0, stats.lazyHints - 5));
  return Math.max(0, score);
}

function evaluateExpectation(probe, expectation) {
  const stats = probe.stats || {};
  const failures = [];
  if (expectation?.shouldFailWithAntiBot) {
    if (!probe.antiBot.detected) {
      failures.push(
        `expected anti-bot challenge but page rendered (provider=${expectation.expectedAntiBotProvider ?? 'any'})`,
      );
    } else if (
      expectation.expectedAntiBotProvider &&
      probe.antiBot.provider !== expectation.expectedAntiBotProvider
    ) {
      failures.push(
        `expected provider=${expectation.expectedAntiBotProvider} but detected ${probe.antiBot.provider}`,
      );
    }
  } else {
    if (probe.antiBot.detected) {
      failures.push(
        `unexpected anti-bot challenge (provider=${probe.antiBot.provider})`,
      );
    }
    if (
      typeof expectation?.minBodyTextLength === 'number' &&
      stats.bodyTextLength < expectation.minBodyTextLength
    ) {
      failures.push(
        `bodyTextLength=${stats.bodyTextLength} below minimum ${expectation.minBodyTextLength}`,
      );
    }
    if (
      typeof expectation?.minVisibleImages === 'number' &&
      stats.imagesVisible < expectation.minVisibleImages
    ) {
      failures.push(
        `imagesVisible=${stats.imagesVisible} below minimum ${expectation.minVisibleImages}`,
      );
    }
  }
  return failures;
}

async function runSuite(browser, fixturesPath) {
  const here = dirname(fileURLToPath(import.meta.url));
  const resolvedPath = resolve(
    fixturesPath ?? resolve(here, '..', 'test', 'clone-fixtures.json'),
  );
  const raw = await readFile(resolvedPath, 'utf8');
  const json = JSON.parse(raw);
  const fixtures = Array.isArray(json.fixtures) ? json.fixtures : [];
  if (!fixtures.length) {
    console.error(`No fixtures found in ${resolvedPath}`);
    process.exit(2);
  }

  console.log(`=== Clone Preview Suite (${fixtures.length} URLs) ===`);
  console.log(`Source: ${resolvedPath}\n`);

  const results = [];
  for (const fixture of fixtures) {
    const start = Date.now();
    process.stdout.write(`→ ${fixture.id.padEnd(28)} `);
    let probe;
    try {
      probe = await probeUrl(browser, fixture.url);
    } catch (err) {
      probe = {
        stats: null,
        navigationError: err instanceof Error ? err.message : String(err),
        antiBot: { detected: false },
        status: null,
        consoleErrors: [],
        failedRequests: [],
      };
    }
    const score = scoreSnapshot(probe.stats);
    const failures = evaluateExpectation(probe, fixture.expectation);
    const elapsedMs = Date.now() - start;
    const verdict = failures.length === 0 ? 'PASS' : 'FAIL';
    console.log(
      `${verdict.padEnd(5)} score=${String(score).padStart(3)}  status=${probe.status ?? '—'}  ${elapsedMs}ms`,
    );
    if (failures.length) {
      for (const f of failures) console.log(`     · ${f}`);
    }
    results.push({
      id: fixture.id,
      label: fixture.label,
      url: fixture.url,
      kind: fixture.kind,
      score,
      verdict,
      failures,
      antiBot: probe.antiBot,
      stats: probe.stats,
      status: probe.status,
      navigationError: probe.navigationError,
      elapsedMs,
    });
  }

  const passed = results.filter((r) => r.verdict === 'PASS').length;
  const failed = results.length - passed;
  console.log(`\nSummary: ${passed}/${results.length} passed  (${failed} failed)`);
  console.log('\n=== JSON Report ===');
  console.log(JSON.stringify(results, null, 2));

  if (failed > 0) process.exit(1);
}

const browser = await chromium.launch({ headless: true });

try {
  if (isSuite) {
    await runSuite(browser, suitePath);
  } else {
    const probe = await probeUrl(browser, targetUrl);
    const score = scoreSnapshot(probe.stats);

    console.log('=== Clone Preview Diagnose ===');
    console.log(JSON.stringify({ ...probe.stats, score }, null, 2));
    console.log('\n=== Console Errors ===');
    if (!probe.consoleErrors.length) {
      console.log('Nenhum erro de console.');
    } else {
      probe.consoleErrors.forEach((line, index) => {
        console.log(`${index + 1}. ${line}`);
      });
    }

    console.log('\n=== Failed Requests ===');
    if (!probe.failedRequests.length) {
      console.log('Nenhuma request falhou.');
    } else {
      probe.failedRequests.forEach((item, index) => {
        console.log(`${index + 1}. [${item.method}] ${item.url} :: ${item.error}`);
      });
    }

    console.log('\n=== Anti-Bot ===');
    console.log(JSON.stringify(probe.antiBot, null, 2));

    const context = browser.contexts()[0] ?? (await browser.newContext({ userAgent: UA }));
    const page = await context.newPage();
    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.screenshot({ path: './tmp-diagnose-preview.png', fullPage: true });
      console.log('\nScreenshot: ./tmp-diagnose-preview.png');
    } catch {
      // ignore screenshot failures — diagnose is read-only.
    } finally {
      await page.close().catch(() => {});
    }
  }
} finally {
  await browser.close();
}

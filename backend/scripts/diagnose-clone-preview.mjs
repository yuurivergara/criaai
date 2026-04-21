import { chromium } from 'playwright';

const targetUrl = process.argv[2];

if (!targetUrl) {
  console.error('Uso: node ./scripts/diagnose-clone-preview.mjs <url>');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  locale: 'pt-BR',
});
const page = await context.newPage();

const consoleErrors = [];
const failedRequests = [];

page.on('console', (message) => {
  if (message.type() === 'error') {
    consoleErrors.push(message.text());
  }
});

page.on('requestfailed', (request) => {
  failedRequests.push({
    url: request.url(),
    method: request.method(),
    error: request.failure()?.errorText ?? 'unknown',
  });
});

await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);

await page.evaluate(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  for (let i = 0; i < 12; i += 1) {
    window.scrollBy(0, Math.max(360, Math.floor(window.innerHeight * 0.7)));
    await sleep(220);
  }
});

await page.waitForTimeout(1200);

const stats = await page.evaluate(() => {
  const visibleArea = (el) => {
    const rect = el.getBoundingClientRect();
    return rect.width * rect.height;
  };
  const text = document.body.innerText || '';
  return {
    url: window.location.href,
    title: document.title,
    bodyTextLength: text.trim().length,
    imagesVisible: Array.from(document.querySelectorAll('img')).filter(
      (img) => (img.currentSrc || img.getAttribute('src')) && visibleArea(img) > 2000,
    ).length,
    iframesVisible: Array.from(document.querySelectorAll('iframe')).filter(
      (frame) => frame.getAttribute('src') && visibleArea(frame) > 3000,
    ).length,
    videosVisible: Array.from(document.querySelectorAll('video')).filter(
      (video) =>
        (video.currentSrc || video.getAttribute('src') || video.getAttribute('poster')) &&
        visibleArea(video) > 3000,
    ).length,
    lazyHints: document.querySelectorAll(
      '[loading="lazy"], [data-src], [data-lazy], [data-lazy-src], [class*="skeleton"], [class*="placeholder"], [class*="shimmer"]',
    ).length,
  };
});

console.log('=== Clone Preview Diagnose ===');
console.log(JSON.stringify(stats, null, 2));
console.log('\n=== Console Errors ===');
if (!consoleErrors.length) {
  console.log('Nenhum erro de console.');
} else {
  consoleErrors.slice(0, 20).forEach((line, index) => {
    console.log(`${index + 1}. ${line}`);
  });
}

console.log('\n=== Failed Requests ===');
if (!failedRequests.length) {
  console.log('Nenhuma request falhou.');
} else {
  failedRequests.slice(0, 30).forEach((item, index) => {
    console.log(
      `${index + 1}. [${item.method}] ${item.url} :: ${item.error}`,
    );
  });
}

await page.screenshot({
  path: './tmp-diagnose-preview.png',
  fullPage: true,
});
console.log('\nScreenshot: ./tmp-diagnose-preview.png');

await browser.close();

import { cpus } from 'node:os';
import type { Browser, LaunchOptions } from 'playwright';
import { loadStealthChromium } from './anti-bot.util';

/**
 * Caps how many headless Chromium instances can be alive at once.
 *
 * Each clone/quiz job opens a private Chromium with stealth patches.
 * Without a cap, a small spike in concurrent submissions OOM-kills the
 * VPS â€” Chromium is the heaviest dependency in the whole pipeline. We
 * gate `launch()` behind a tiny FIFO semaphore so Bull worker
 * concurrency can stay high (cheap I/O bound jobs can still run),
 * while only `MAX_CONCURRENT_BROWSERS` simultaneous clones get a
 * browser at any time.
 *
 * The cap defaults to `max(1, floor(cpus / 2))` so a 2-core VPS allows
 * at most one browser, a 4-core box allows 2, and so on. Override via
 * `CRIAAI_CHROMIUM_POOL_MAX` for explicit tuning.
 *
 * Each acquisition returns a fresh, isolated `Browser` plus a
 * `release()` callback. We deliberately do NOT cache `Browser`
 * instances across jobs: stealth patches are global to the process,
 * and the walker mutates context state extensively. Sharing a browser
 * would be fragile for marginal speed gains.
 */

const DEFAULT_LIMIT = (() => {
  const fromEnv = Number(process.env.CRIAAI_CHROMIUM_POOL_MAX);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.floor(fromEnv);
  }
  const cpuCount = cpus().length || 2;
  return Math.max(1, Math.floor(cpuCount / 2));
})();

class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];
  constructor(private readonly limit: number) {}

  async acquire(): Promise<() => void> {
    if (this.active < this.limit) {
      this.active += 1;
      return () => this.release();
    }
    await new Promise<void>((resolve) => {
      this.waiters.push(resolve);
    });
    this.active += 1;
    return () => this.release();
  }

  private release() {
    this.active -= 1;
    const next = this.waiters.shift();
    if (next) {
      next();
    }
  }
}

const semaphore = new Semaphore(DEFAULT_LIMIT);

export interface BrowserLease {
  browser: Browser;
  release: () => Promise<void>;
}

/**
 * Acquires a Chromium browser through the pool. Always pair with
 * `await lease.release()` in a `finally` block â€” failing to release
 * starves the pool for the rest of the process lifetime.
 */
export async function acquireChromium(
  launchOptions: LaunchOptions = {},
): Promise<BrowserLease> {
  const releaseSlot = await semaphore.acquire();
  let browser: Browser | undefined;
  try {
    const chromium = await loadStealthChromium();
    browser = await chromium.launch({ headless: true, ...launchOptions });
  } catch (err) {
    releaseSlot();
    throw err;
  }
  let released = false;
  const release = async () => {
    if (released) {
      return;
    }
    released = true;
    try {
      await browser?.close();
    } finally {
      releaseSlot();
    }
  };
  return { browser, release };
}

export function chromiumPoolLimit(): number {
  return DEFAULT_LIMIT;
}

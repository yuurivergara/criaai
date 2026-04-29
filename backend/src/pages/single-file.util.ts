/**
 * SingleFile CLI sidecar.
 *
 * Wraps the open-source `single-file-cli` tool (AGPL-3.0, isolated as a
 * separate executable) so we can produce a fully self-contained HTML
 * snapshot — every <link>, <script>, <img>, <font> and CSS `url(...)`
 * inlined — for the cloned page. The result is offered as a *candidate*
 * alongside our existing MHTML capture and DOM snapshot; the highest
 * scoring candidate is what gets persisted.
 *
 * Why a subprocess: SingleFile's source license (AGPL) is incompatible
 * with the project's own license. Running it as an external CLI keeps
 * the AGPL boundary at the binary, not at our source code.
 *
 * Why optional: SingleFile is heavyweight (boots its own Chromium) and
 * not all deployments want to spend the extra CPU/RAM. We gate the call
 * on `CRIAAI_USE_SINGLEFILE=1` and on the binary actually being
 * resolvable on the host.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as cheerio from 'cheerio';

export interface SingleFileRunOptions {
  /** URL to capture. Should be the post-redirect URL. */
  url: string;
  /** Cookies from `context.storageState()`. JSON-serialised on disk. */
  cookies?: Array<Record<string, unknown>>;
  /** Path to a Chromium binary, ideally the one Playwright bundled. */
  browserExecutablePath?: string;
  /** User-Agent string to use for the capture (matches the parent walker). */
  userAgent?: string;
  /** Hard wall-clock cap for the subprocess. Defaults to 60s. */
  timeoutMs?: number;
}

export interface SingleFileResult {
  /** Self-contained HTML, or null when the capture failed. */
  html: string | null;
  /** Wall-clock duration in ms. */
  durationMs: number;
  /** Short reason on failure. */
  error?: string;
}

/**
 * Returns true when `single-file-cli` is callable on the host. We treat
 * `single-file --version` exiting cleanly as success.
 */
export async function isSingleFileAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('single-file', ['--version'], { shell: true });
    let resolved = false;
    const finish = (ok: boolean) => {
      if (resolved) return;
      resolved = true;
      try {
        child.kill();
      } catch {
        /* swallow */
      }
      resolve(ok);
    };
    child.on('error', () => finish(false));
    child.on('exit', (code) => finish(code === 0));
    setTimeout(() => finish(false), 4000);
  });
}

/**
 * Run SingleFile as a subprocess and return the resulting self-contained
 * HTML (or null on error/timeout).
 *
 * The function:
 *   1. Materialises cookies to a JSON file on a temp dir.
 *   2. Calls `single-file <url> <out.html>` with whatever flags we have.
 *   3. Reads the produced HTML back and cleans up the temp dir.
 */
export async function runSingleFile(
  opts: SingleFileRunOptions,
): Promise<SingleFileResult> {
  const startedAt = Date.now();
  const timeoutMs = opts.timeoutMs ?? 60_000;

  const workDir = await mkdtemp(join(tmpdir(), 'criaai-singlefile-'));
  const cookiesPath = join(workDir, 'cookies.json');
  const outputPath = join(workDir, 'snapshot.html');

  try {
    if (opts.cookies && opts.cookies.length > 0) {
      await writeFile(
        cookiesPath,
        JSON.stringify(opts.cookies, null, 2),
        'utf8',
      );
    }

    const args: string[] = [opts.url, outputPath];
    if (opts.browserExecutablePath && existsSync(opts.browserExecutablePath)) {
      args.push(`--browser-executable-path=${opts.browserExecutablePath}`);
    }
    if (opts.userAgent) {
      args.push(`--user-agent=${opts.userAgent}`);
    }
    if (opts.cookies && opts.cookies.length > 0) {
      args.push(`--browser-cookies-file=${cookiesPath}`);
    }
    // Sensible defaults for fidelity-first cloning. Each flag is supported
    // by single-file-cli; see `single-file --help` for the full surface.
    args.push(
      '--browser-wait-until=networkidle0',
      '--browser-load-max-time=20000',
      '--max-resource-size=30',
      '--include-bom',
      '--remove-hidden-elements=false',
      '--remove-unused-styles=false',
      '--remove-unused-fonts=false',
    );

    const exited = await new Promise<{
      code: number | null;
      stderr: string;
    }>((resolve) => {
      const child = spawn('single-file', args, { shell: true });
      let stderr = '';
      const killTimer = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          /* swallow */
        }
      }, timeoutMs);
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });
      child.on('error', () => {
        clearTimeout(killTimer);
        resolve({ code: -1, stderr });
      });
      child.on('exit', (code) => {
        clearTimeout(killTimer);
        resolve({ code: code ?? null, stderr });
      });
    });

    if (exited.code !== 0) {
      return {
        html: null,
        durationMs: Date.now() - startedAt,
        error: `exit_code=${exited.code} ${exited.stderr.slice(0, 240)}`.trim(),
      };
    }

    if (!existsSync(outputPath)) {
      return {
        html: null,
        durationMs: Date.now() - startedAt,
        error: 'output_not_found',
      };
    }
    const html = await readFile(outputPath, 'utf8');
    return {
      html,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      html: null,
      durationMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message.slice(0, 240) : 'unknown',
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Language-agnostic score for a raw HTML string. Used to compare the
 * MHTML / SingleFile / DOM-snapshot candidates and pick the richest one.
 *
 * Same intuition as `captureBestRenderedSnapshot` (media + backgrounds +
 * text length) but operating offline on a Cheerio DOM rather than on a
 * live browser. Heuristic — by design — but stable across runs and free
 * of any natural-language anchor.
 *
 * Each signal:
 *   - <img>     : +2 if src is present (data: counts double — already inlined).
 *   - <iframe>  : +4 if src is present (resolved external content).
 *   - <video>   : +4 if src or poster is present.
 *   - <style>   : +1 every 4kb of inline CSS, capped at 24.
 *   - inline url(): +1 per CSS background-image url(...) reference, capped at 32.
 *   - body text : +1 every 250 visible chars, capped at 16.
 *   - <script>  : +6 per script tag, capped at 60. Scripts are what
 *                 keep weight pickers / kg-lb toggles / custom selects
 *                 / multi-step "Continuar" buttons working in the clone.
 *                 Heavily weighted because a candidate that lost its
 *                 scripts is functionally broken even if it's visually
 *                 perfect (Chrome's MHTML snapshots strip scripts; DOM
 *                 captures keep them).
 *
 * Empty / parse-failed HTML returns 0 so it's strictly worse than any
 * actual capture.
 */
export function scoreCandidateHtml(html: string | null | undefined): number {
  if (!html || typeof html !== 'string' || html.length < 256) return 0;
  let score = 0;
  try {
    const $ = cheerio.load(html);
    $('img').each((_i, el) => {
      const src = $(el).attr('src');
      if (!src) return;
      score += src.startsWith('data:') ? 4 : 2;
    });
    $('iframe').each((_i, el) => {
      if ($(el).attr('src')) score += 4;
    });
    $('video').each((_i, el) => {
      if ($(el).attr('src') || $(el).attr('poster')) score += 4;
    });

    let inlineCssBytes = 0;
    $('style').each((_i, el) => {
      const css = $(el).text();
      if (css) inlineCssBytes += css.length;
    });
    score += Math.min(24, Math.floor(inlineCssBytes / 4096));

    const cssUrlMatches = html.match(/url\((['"]?)(?!#)[^)'"]+\1\)/g) ?? [];
    score += Math.min(32, cssUrlMatches.length);

    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    score += Math.min(16, Math.floor(bodyText.length / 250));

    // Scripts are king for interactivity. We REQUIRE the winning
    // candidate to ship the original site's bundles, otherwise the user
    // ends up with a beautiful but dead clone (no slider drag, no
    // option highlighting, no kg/lb switch, no "Continuar" enabling
    // logic). Six points per script, up to ten scripts → 60 points
    // potential, easily outweighing the visual scoring on most pages.
    const scriptCount = $('script').length;
    score += Math.min(60, scriptCount * 6);
  } catch {
    return 0;
  }
  return score;
}

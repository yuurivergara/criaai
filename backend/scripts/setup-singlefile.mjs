#!/usr/bin/env node
/**
 * Bootstraps `single-file-cli` globally so the cloning pipeline can use
 * it as a sidecar process. SingleFile is AGPL-3.0 and is intentionally
 * kept as an external executable — installing it here only places a
 * binary on the host, not source in our tree.
 *
 * Usage:
 *   npm run snapshot:setup
 *
 * Idempotent: if SingleFile is already callable we exit successfully
 * without reinstalling.
 */

import { spawn, spawnSync } from 'node:child_process';

function checkAvailable() {
  try {
    const result = spawnSync('single-file', ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });
    if (result.status === 0) {
      const version = String(result.stdout || '').trim();
      console.log(`[setup-singlefile] already installed: ${version || 'ok'}`);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function install() {
  console.log('[setup-singlefile] installing single-file-cli globally...');
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['install', '-g', 'single-file-cli@latest'], {
      stdio: 'inherit',
      shell: true,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm install exited with code ${code}`));
    });
  });
}

(async function main() {
  if (checkAvailable()) {
    process.exit(0);
  }
  try {
    await install();
  } catch (err) {
    console.error('[setup-singlefile] failed:', err?.message || err);
    process.exit(1);
  }
  if (!checkAvailable()) {
    console.error(
      '[setup-singlefile] installation completed but binary still unreachable. Check your $PATH or npm prefix.',
    );
    process.exit(2);
  }
  console.log('[setup-singlefile] ready.');
})();

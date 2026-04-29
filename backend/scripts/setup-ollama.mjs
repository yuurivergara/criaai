#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Cross-platform Ollama bootstrapper for CriaAI.
 *
 * - Checks if Ollama is reachable at OLLAMA_HOST (default http://localhost:11434).
 * - If not installed, prints exact platform-specific instructions (and, on
 *   Windows with winget available, offers to install automatically).
 * - Pulls the default model if missing.
 *
 * Usage:
 *   node scripts/setup-ollama.mjs
 *   node scripts/setup-ollama.mjs --model qwen2.5:7b-instruct
 */

import { spawn, spawnSync } from 'node:child_process';
import { platform as osPlatform } from 'node:os';

const DEFAULT_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const argvModel = (() => {
  const idx = process.argv.indexOf('--model');
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return null;
})();
const DEFAULT_MODEL = argvModel || process.env.OLLAMA_MODEL || 'qwen2.5:3b-instruct';
const FALLBACK_MODELS = ['llama3.2:3b-instruct', 'qwen2.5:1.5b-instruct'];

const c = {
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
  y: (s) => `\x1b[33m${s}\x1b[0m`,
  b: (s) => `\x1b[36m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

async function fetchJson(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function isOllamaRunning() {
  const data = await fetchJson(`${DEFAULT_HOST}/api/tags`);
  return data && Array.isArray(data.models);
}

async function listModels() {
  const data = await fetchJson(`${DEFAULT_HOST}/api/tags`);
  if (!data || !Array.isArray(data.models)) return [];
  return data.models.map((m) => String(m.name || '').trim()).filter(Boolean);
}

function runStreaming(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: false });
    child.on('close', (code) => resolve(code ?? -1));
    child.on('error', () => resolve(-1));
  });
}

function hasExecutable(name) {
  const which = osPlatform() === 'win32' ? 'where' : 'which';
  const probe = spawnSync(which, [name], { stdio: 'ignore' });
  return probe.status === 0;
}

function printInstallInstructions() {
  const p = osPlatform();
  console.log(c.y('\n▶ Ollama não está rodando ainda. Instalação:'));
  if (p === 'win32') {
    console.log(c.b('  Windows:'));
    console.log('    Opção A (winget):  winget install --id Ollama.Ollama -e');
    console.log(
      '    Opção B (instalador): https://ollama.com/download/OllamaSetup.exe',
    );
  } else if (p === 'darwin') {
    console.log(c.b('  macOS:'));
    console.log('    brew install ollama  ||  https://ollama.com/download');
  } else {
    console.log(c.b('  Linux:'));
    console.log('    curl -fsSL https://ollama.com/install.sh | sh');
  }
  console.log(
    c.dim(
      `\nApós instalar, Ollama sobe sozinho em ${DEFAULT_HOST}. Rode novamente:`,
    ),
  );
  console.log(c.dim('    node scripts/setup-ollama.mjs'));
}

async function tryWindowsWinget() {
  if (osPlatform() !== 'win32') return false;
  if (!hasExecutable('winget')) return false;
  console.log(c.b('\n▶ winget detectado, instalando Ollama silenciosamente…'));
  const code = await runStreaming('winget', [
    'install',
    '--id',
    'Ollama.Ollama',
    '-e',
    '--accept-package-agreements',
    '--accept-source-agreements',
    '--silent',
  ]);
  if (code !== 0) {
    console.log(c.r('winget falhou (code=' + code + '). Use o instalador manual.'));
    return false;
  }
  console.log(c.g('✔ Ollama instalado via winget. Aguardando serviço subir…'));
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    if (await isOllamaRunning()) return true;
  }
  return false;
}

async function pullModel(model) {
  if (!hasExecutable('ollama')) {
    console.log(
      c.y(
        '\n▶ CLI "ollama" não está no PATH. Abra um novo terminal (após instalar) e rode:',
      ),
    );
    console.log(`    ollama pull ${model}`);
    return false;
  }
  console.log(c.b(`\n▶ Baixando modelo ${model} (uma vez só, ~2GB pro 3B / ~4GB pro 7B)…`));
  const code = await runStreaming('ollama', ['pull', model]);
  return code === 0;
}

async function main() {
  console.log(c.b('▶ CriaAI · Ollama setup'));
  console.log(c.dim(`Host alvo: ${DEFAULT_HOST}`));
  console.log(c.dim(`Modelo alvo: ${DEFAULT_MODEL}`));

  let running = await isOllamaRunning();
  if (!running) {
    const installed = await tryWindowsWinget();
    if (!installed) {
      printInstallInstructions();
      process.exit(2);
    }
    running = await isOllamaRunning();
  }

  if (!running) {
    console.log(c.r('\n✗ Ollama instalou mas não respondeu em 30s.'));
    console.log(
      c.dim(
        '  Abra o app (ícone na bandeja do sistema) e rode novamente este script.',
      ),
    );
    process.exit(3);
  }

  console.log(c.g(`\n✔ Ollama respondendo em ${DEFAULT_HOST}`));
  const existing = await listModels();
  if (existing.length) {
    console.log(c.dim(`  Modelos já presentes: ${existing.join(', ')}`));
  }

  const matchesDefault = existing.some(
    (m) => m === DEFAULT_MODEL || m.startsWith(`${DEFAULT_MODEL.split(':')[0]}:`),
  );

  if (matchesDefault) {
    console.log(c.g(`✔ Modelo "${DEFAULT_MODEL}" (ou família equivalente) já está disponível.`));
  } else {
    const ok = await pullModel(DEFAULT_MODEL);
    if (!ok) {
      for (const fb of FALLBACK_MODELS) {
        console.log(c.y(`\n▶ Tentando fallback ${fb}…`));
        const ok2 = await pullModel(fb);
        if (ok2) {
          console.log(c.g(`✔ Modelo fallback ${fb} baixado. Ajuste OLLAMA_MODEL no .env.`));
          break;
        }
      }
    }
  }

  console.log(c.g('\n✔ Setup concluído.'));
  console.log(
    c.dim(
      '  Para usar no backend, adicione no .env:\n' +
        `    OLLAMA_HOST="${DEFAULT_HOST}"\n` +
        `    OLLAMA_MODEL="${DEFAULT_MODEL}"\n`,
    ),
  );
}

main().catch((err) => {
  console.error(c.r(`Erro inesperado: ${err?.message ?? err}`));
  process.exit(1);
});

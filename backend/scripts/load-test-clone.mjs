import { performance } from 'node:perf_hooks';

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000/v1';
const sourceUrl = process.env.CLONE_SOURCE_URL ?? 'https://example.com';
const requests = Number(process.env.LOAD_REQUESTS ?? '100');
const concurrency = Number(process.env.LOAD_CONCURRENCY ?? '10');
const pollRetries = Number(process.env.LOAD_POLL_RETRIES ?? '60');
const pollDelayMs = Number(process.env.LOAD_POLL_DELAY_MS ?? '500');

const enqueueLatencies = [];
const completionLatencies = [];
const errors = [];

const jobQueue = Array.from({ length: requests }, (_, index) => index);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  const idx = Math.max(0, Math.min(rank, sorted.length - 1));
  return sorted[idx];
}

async function enqueueCloneJob() {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/pages/clone`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sourceUrl,
      objective: 'Create a high-converting SaaS landing page',
      cta: 'Start free trial',
    }),
  });
  const elapsed = performance.now() - startedAt;
  enqueueLatencies.push(elapsed);

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Clone enqueue failed: ${response.status} ${payload}`);
  }

  const payload = await response.json();
  return { jobId: payload.jobId, enqueueElapsedMs: elapsed };
}

async function waitForCompletion(jobId) {
  const startedAt = performance.now();
  for (let attempt = 0; attempt < pollRetries; attempt += 1) {
    const response = await fetch(`${baseUrl}/jobs/${jobId}`);
    if (!response.ok) {
      throw new Error(`Job polling failed for ${jobId} with ${response.status}`);
    }
    const payload = await response.json();
    if (payload.status === 'completed') {
      const elapsed = performance.now() - startedAt;
      completionLatencies.push(elapsed);
      return;
    }
    if (payload.status === 'failed' || payload.status === 'blocked') {
      throw new Error(`Job ${jobId} ended with ${payload.status}`);
    }
    await sleep(pollDelayMs);
  }
  throw new Error(`Job ${jobId} timed out`);
}

async function worker() {
  while (jobQueue.length > 0) {
    const item = jobQueue.pop();
    if (item === undefined) return;
    try {
      const enqueued = await enqueueCloneJob();
      await waitForCompletion(enqueued.jobId);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown load error');
    }
  }
}

async function run() {
  const startedAt = performance.now();
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const totalMs = performance.now() - startedAt;
  const completed = completionLatencies.length;
  const throughput = completed / (totalMs / 1000);
  const report = {
    baseUrl,
    sourceUrl,
    requests,
    concurrency,
    completed,
    failed: errors.length,
    enqueue: {
      avgMs: enqueueLatencies.reduce((acc, n) => acc + n, 0) /
        Math.max(1, enqueueLatencies.length),
      p95Ms: percentile(enqueueLatencies, 95),
    },
    completion: {
      avgMs: completionLatencies.reduce((acc, n) => acc + n, 0) /
        Math.max(1, completionLatencies.length),
      p95Ms: percentile(completionLatencies, 95),
    },
    throughputJobsPerSec: throughput,
    totalDurationMs: totalMs,
    errors,
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

void run();

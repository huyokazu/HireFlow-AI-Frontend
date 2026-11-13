#!/usr/bin/env node
/**
 * Latency benchmark for the HireFlow API: p50/p95/p99 plus the server's own Server-Timing phases,
 * so network time and server time can be told apart.
 *
 *   node scripts/bench.mjs [--base http://localhost:3000] [--n 100] [--c 1] [--paths /api/bootstrap,/api/dashboard]
 *
 * Signs in as the demo account (DEMO_EMAIL / DEMO_PASSWORD, defaults match scripts/seed-demo.ts)
 * against SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY, or uses BENCH_TOKEN if set.
 */
import { readFileSync, existsSync } from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith('--') ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []),
);
loadEnvFile('.env.local');

const base = (args.base ?? process.env.BENCH_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const n = Number(args.n ?? 100);
const c = Number(args.c ?? 1);
const paths = (args.paths ?? '/api/health,/api/bootstrap,/api/dashboard,/api/pipeline,/api/agents').split(',');

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}

async function token() {
  if (process.env.BENCH_TOKEN) return process.env.BENCH_TOKEN;
  const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      email: process.env.DEMO_EMAIL ?? 'demo@hireflow.local',
      password: process.env.DEMO_PASSWORD ?? 'hireflow-demo-2026',
    }),
  });
  if (!res.ok) throw new Error(`demo sign-in failed: HTTP ${res.status} (run npm run seed:demo)`);
  return (await res.json()).access_token;
}

const percentile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];

function serverTotals(headers) {
  const phases = {};
  for (const part of headers.filter(Boolean).flatMap((h) => h.split(','))) {
    const [name, dur] = part.trim().split(';dur=');
    if (dur) (phases[name] ??= []).push(Number(dur));
  }
  return Object.entries(phases)
    .map(([name, values]) => `${name}=${percentile(values.sort((a, b) => a - b), 0.5).toFixed(1)}ms`)
    .join(' ');
}

async function benchPath(path, auth) {
  const timings = [];
  const serverTiming = [];
  let errors = 0;
  const once = async () => {
    const start = performance.now();
    const res = await fetch(`${base}${path}`, { headers: { authorization: `Bearer ${auth}` } });
    await res.arrayBuffer();
    timings.push(performance.now() - start);
    serverTiming.push(res.headers.get('server-timing'));
    if (!res.ok) errors += 1;
  };
  await once(); // first request: may include cold start / connection setup
  const first = timings.shift();
  serverTiming.shift();
  let left = n;
  await Promise.all(Array.from({ length: c }, async () => { while (left-- > 0) await once(); }));
  timings.sort((a, b) => a - b);
  console.log(
    `${path.padEnd(22)} first=${first.toFixed(0)}ms p50=${percentile(timings, 0.5).toFixed(0)}ms ` +
      `p95=${percentile(timings, 0.95).toFixed(0)}ms p99=${percentile(timings, 0.99).toFixed(0)}ms ` +
      `errors=${errors}  server(p50): ${serverTotals(serverTiming)}`,
  );
}

const auth = await token();
console.log(`base=${base} n=${n} c=${c}`);
for (const path of paths) await benchPath(path, auth);

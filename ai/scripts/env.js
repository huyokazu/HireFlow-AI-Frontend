// Nạp file .env (Node 18 chưa có sẵn --env-file) + vài hàm tiện ích cho script.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function loadEnv() {
  const file = join(ROOT, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    const value = m[2].replace(/^["']|["']$/g, '');
    if (value && process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

export function requireKey() {
  loadEnv();
  if (!process.env.GEMINI_API_KEY) {
    console.error('Chưa có GEMINI_API_KEY. Tạo file .env theo mẫu .env.example (key lấy ở https://aistudio.google.com/apikey) rồi chạy lại.');
    process.exit(1);
  }
}

export const sample = (name) => readFileSync(join(ROOT, 'samples', name), 'utf8');
export const sampleJson = (name) => JSON.parse(sample(name));

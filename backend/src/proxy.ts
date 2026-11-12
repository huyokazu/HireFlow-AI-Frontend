import { NextResponse, type NextRequest } from 'next/server';

/**
 * CORS for the Expo web build, which runs on another origin and sends `Authorization`, so every
 * call is preflighted. Native apps don't use CORS. Auth is checked inside each route handler.
 *
 * CORS_ORIGINS is a comma-separated list; an entry may contain one `*` for preview deployments,
 * e.g. `https://hireflow-web-*.vercel.app`.
 */
const patterns = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
  .map((origin) => new RegExp(`^${origin.split('*').map(escapeRegExp).join('[a-z0-9-]+')}$`, 'i'));

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Workspace-Id',
  'Access-Control-Expose-Headers': 'Server-Timing',
  // Chromium caps this at 2 hours; it saves a preflight round trip on every repeated call.
  'Access-Control-Max-Age': '7200',
  'Timing-Allow-Origin': '*',
};

export function proxy(req: NextRequest) {
  const origin = req.headers.get('origin');
  const allowed = origin !== null && patterns.some((pattern) => pattern.test(origin));
  const headers: Record<string, string> = allowed
    ? { ...CORS_HEADERS, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : { Vary: 'Origin' };

  if (req.method === 'OPTIONS') return new NextResponse(null, { status: allowed ? 204 : 403, headers });

  const res = NextResponse.next();
  for (const [key, value] of Object.entries(headers)) res.headers.set(key, value);
  return res;
}

export const config = { matcher: '/api/:path*' };

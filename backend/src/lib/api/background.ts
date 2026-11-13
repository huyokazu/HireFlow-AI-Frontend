import 'server-only';

import { after } from 'next/server';

/**
 * Runs work after the response is sent (Next.js `after()`; Vercel keeps the function alive for it,
 * bounded by maxDuration). Outside a request scope (tests, scripts) it runs immediately instead.
 * The work must handle its own errors; failures are logged, never surfaced to the client.
 */
export function runInBackground(name: string, work: () => Promise<unknown>): void {
  const guarded = () =>
    work().catch((error: unknown) => {
      console.error(`[background:${name}]`, error);
    });
  try {
    after(guarded);
  } catch {
    void guarded();
  }
}

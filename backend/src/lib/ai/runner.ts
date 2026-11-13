import 'server-only';

import type { AiSource, Language } from '@/lib/contracts';

/**
 * Past this, a live Gemini answer isn't worth waiting for in front of an audience: the agent
 * answers with its precomputed result instead. The app waits a little longer than this for the
 * route (`AI_ROUTE_TIMEOUT_MS` in src/services/fallback.ts), so the server's fallback wins.
 */
export const AI_DEADLINE_MS = 4000;

/** Why an agent used its precomputed answer. */
export type FallbackReason = 'disabled' | 'not_configured' | 'timeout' | 'rate_limited' | 'unavailable' | 'invalid_output';

export type AiOutcome<T> = {
  data: T;
  source: AiSource;
  /** Set when `source` is `fallback`. */
  reason?: FallbackReason;
  latencyMs: number;
};

/**
 * `AI_MODE=precomputed` skips Gemini entirely, e.g. on stage over bad Wi-Fi. Without a
 * `GEMINI_API_KEY` the agents use their precomputed answers too.
 */
function liveDisabled(): FallbackReason | null {
  if (process.env.AI_MODE === 'precomputed') return 'disabled';
  if (!process.env.GEMINI_API_KEY) return 'not_configured';
  return null;
}

/** Maps a failed Gemini call (a `GeminiError` from ai/lib/gemini.js, or our deadline) to a reason. */
export function fallbackReason(error: unknown): FallbackReason {
  const status = (error as { status?: unknown } | null)?.status;
  const message = error instanceof Error ? error.message : String(error);
  if (/GEMINI_API_KEY/.test(message)) return 'not_configured';
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(message)) return 'rate_limited';
  if (status === 408 || /timeout|timed out/i.test(message)) return 'timeout';
  if (typeof status === 'number' && status >= 500) return 'unavailable';
  return 'invalid_output';
}

class DeadlineError extends Error {
  readonly status = 408;
}

/**
 * Runs one agent call against Gemini with a hard deadline, and answers with `fallback()` when the
 * call is late, rate-limited, unavailable or returns something unusable. It never throws for a
 * Gemini problem, so a route that uses it always answers within about `deadlineMs`.
 *
 * `live` receives the time it has left, to pass to ai/lib as `timeoutMs` so its own requests stop
 * too instead of running on in the background.
 */
export async function runWithFallback<T>(
  agent: string,
  live: (budgetMs: number) => Promise<T>,
  fallback: () => T | Promise<T>,
  { deadlineMs = AI_DEADLINE_MS }: { deadlineMs?: number } = {},
): Promise<AiOutcome<T>> {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  const disabled = liveDisabled();
  if (disabled) return { data: await fallback(), source: 'fallback', reason: disabled, latencyMs: elapsed() };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DeadlineError(`${agent}: no answer within ${deadlineMs} ms`)), deadlineMs);
  });
  try {
    const data = await Promise.race([live(deadlineMs), deadline]);
    return { data, source: 'gemini', latencyMs: elapsed() };
  } catch (error) {
    const reason = fallbackReason(error);
    console.warn(`[ai:${agent}] using the precomputed answer (${reason}):`, error instanceof Error ? error.message : error);
    return { data: await fallback(), source: 'fallback', reason, latencyMs: elapsed() };
  } finally {
    clearTimeout(timer);
  }
}

/** The `{{language}}` the ai/ prompts write in. */
export function promptLanguage(language: Language | undefined): string | undefined {
  if (language === 'en') return 'English';
  if (language === 'vi') return 'tiếng Việt';
  return undefined;
}

import { ApiError, getRemote, type RemoteAdapter } from './remote';

/**
 * The demo safety net for AI calls. The backend gives Gemini {@link AI_DEADLINE_MS} and then
 * answers with a precomputed result itself, so this side waits a little longer for that answer,
 * and falls back to its own precomputed copy only when the API can't be reached in time, is
 * rate-limited or fails. Nothing here ever leaves a button spinning.
 */

/** How long the backend lets a live Gemini call run before using its precomputed answer. */
export const AI_DEADLINE_MS = 4000;

/** How long the app waits for an AI route: the backend's deadline plus a database round trip. */
export const AI_ROUTE_TIMEOUT_MS = AI_DEADLINE_MS + 1500;

/** Where an answer came from: the live AI, or a precomputed one because the live one was late or failed. */
export type AnswerSource = 'live' | 'fallback';

export type Sourced<T> = { data: T; source: AnswerSource };

/** The API refused for now because of too many requests (ours, or Gemini's quota behind it). */
export function isRateLimited(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 429 || error.code === 'RATE_LIMITED');
}

/**
 * Whether a failed AI call should quietly give way to the precomputed answer: a timeout, no
 * network, a rate limit or a server-side failure. Mistakes in the request itself (a 4xx such as
 * "campaign not found") are real errors and are passed on.
 */
export function shouldFallBack(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  return error.status === 0 || error.status === 408 || isRateLimited(error) || error.status >= 500;
}

/**
 * Runs a live AI call with a precomputed fallback. In mock mode (no backend) the fallback is the
 * answer. `live` gets the timeout to pass on to its request.
 */
export async function withAiFallback<T>(
  name: string,
  live: (remote: RemoteAdapter, timeoutMs: number) => Promise<T>,
  fallback: () => T | Promise<T>,
  timeoutMs = AI_ROUTE_TIMEOUT_MS,
): Promise<Sourced<T>> {
  const remote = getRemote();
  if (!remote) return { data: await fallback(), source: 'fallback' };
  try {
    return { data: await live(remote, timeoutMs), source: 'live' };
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    console.warn(`[ai] ${name}: using the precomputed answer.`, error instanceof Error ? error.message : error);
    return { data: await fallback(), source: 'fallback' };
  }
}

/**
 * Waits for a write at most `ms`. Past that the caller can show the change as done (optimistic UI)
 * and keep `pending` to undo it if the write fails after all.
 */
export async function settleWithin<T>(
  promise: Promise<T>,
  ms = AI_DEADLINE_MS,
): Promise<{ status: 'done'; value: T } | { status: 'late'; pending: Promise<T> }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<'late'>((resolve) => {
    timer = setTimeout(() => resolve('late'), ms);
  });
  try {
    const first = await Promise.race([promise.then((value) => ({ value })), late]);
    return first === 'late' ? { status: 'late', pending: promise } : { status: 'done', value: first.value };
  } finally {
    clearTimeout(timer);
  }
}

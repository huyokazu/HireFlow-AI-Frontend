/**
 * How the services reach the HireFlow API, injected at app start. This module (like every service)
 * stays free of React Native, Expo and build-time settings, because the backend imports the
 * services in plain Node: its seed script reads the mock data through the same fetchers. With no
 * adapter registered, every read returns the mock data and every write is a short mock delay.
 */

export type RemoteMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type RemoteRequest = {
  method?: RemoteMethod;
  body?: unknown;
  /** Defaults to the adapter's read timeout for GET and its write timeout otherwise. */
  timeoutMs?: number;
};

export type RemoteAdapter = {
  /** Calls the API as the signed-in user and returns the `data` of the response envelope. */
  request<T>(path: string, init?: RemoteRequest): Promise<T>;
  /** The workspace later requests are about; `null` lets the API pick the user's default. */
  setWorkspaceId(id: string | null): void;
};

/** A failed API call. `status` is 0 when no response came back (timeout, offline, no session). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

let adapter: RemoteAdapter | null = null;

export function setRemote(next: RemoteAdapter | null): void {
  adapter = next;
}

/** The registered adapter, or `null` in mock mode. */
export function getRemote(): RemoteAdapter | null {
  return adapter;
}

/** The adapter, for calls that only exist with a backend (Google, operations, account). */
export function requireRemote(): RemoteAdapter {
  if (!adapter) throw new ApiError(0, 'API_DISABLED', 'No backend is configured.');
  return adapter;
}

const warned = new Set<string>();

/**
 * A read that never leaves a screen waiting: in mock mode it returns the mock, and with the API it
 * falls back to the mock when the call fails or times out (warning once per read).
 */
export async function readWithFallback<T>(
  name: string,
  read: (remote: RemoteAdapter) => Promise<T>,
  mock: () => Promise<T>,
): Promise<T> {
  const remote = adapter;
  if (!remote) return mock();
  try {
    return await read(remote);
  } catch (error) {
    if (!warned.has(name)) {
      warned.add(name);
      console.warn(`[api] ${name}: showing demo data instead.`, error instanceof Error ? error.message : error);
    }
    return mock();
  }
}

/** Waits like a network call would, so the mock UI still shows its saving states. */
export function mockDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

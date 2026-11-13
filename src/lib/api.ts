import { ApiError, isRecord, setRemote, type RemoteRequest } from '../services/remote';
import { API_URL, apiEnabled } from './config';
import { supabase } from './supabase';

/** Reads give up after this long and fall back to mock data, so a slow API never holds a screen. */
export const READ_TIMEOUT_MS = 3000;
/** Writes wait longer: giving up early would leave HR unsure whether a change was saved. */
export const WRITE_TIMEOUT_MS = 10000;

let workspaceId: string | null = null;

/** Sent as `X-Workspace-Id` once known; without it the API uses the user's default workspace. */
export function setWorkspaceId(id: string | null): void {
  workspaceId = id;
}

/**
 * Calls the HireFlow API with the signed-in user's access token and unwraps the `{ data }` envelope.
 * A 401 refreshes the session once and retries, in case the token expired while the app slept.
 */
export async function apiFetch<T>(path: string, init: RemoteRequest = {}): Promise<T> {
  if (!supabase) throw new ApiError(0, 'API_DISABLED', 'No backend is configured.');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Not signed in.');

  try {
    return await request<T>(path, init, token);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    const refreshed = await supabase.auth.refreshSession();
    const nextToken = refreshed.data.session?.access_token;
    if (refreshed.error || !nextToken) throw error;
    return request<T>(path, init, nextToken);
  }
}

/** Lets the services reach the API. Called once at app start; does nothing in mock mode. */
export function registerApiRemote(): void {
  if (apiEnabled) setRemote({ request: apiFetch, setWorkspaceId });
}

async function request<T>(path: string, { method = 'GET', body, timeoutMs }: RemoteRequest, token: string) {
  const controller = new AbortController();
  const limit = timeoutMs ?? (method === 'GET' ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS);
  const timer = setTimeout(() => controller.abort(), limit);
  const headers: Record<string, string> = { Accept: 'application/json', Authorization: `Bearer ${token}` };
  if (workspaceId) headers['X-Workspace-Id'] = workspaceId;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) throw new ApiError(0, 'TIMEOUT', `${method} ${path} took longer than ${limit} ms.`);
    throw new ApiError(0, 'NETWORK', error instanceof Error ? error.message : 'The API could not be reached.');
  } finally {
    clearTimeout(timer);
  }

  const payload = await readJson(response);
  if (!response.ok) {
    const failure = isRecord(payload) && isRecord(payload.error) ? payload.error : null;
    throw new ApiError(
      response.status,
      typeof failure?.code === 'string' ? failure.code : `HTTP_${response.status}`,
      typeof failure?.message === 'string' ? failure.message : `${method} ${path} failed with ${response.status}.`,
    );
  }
  if (!isRecord(payload) || !('data' in payload)) {
    throw new ApiError(response.status, 'INVALID_RESPONSE', `${method} ${path} returned no data.`);
  }
  return payload.data as T;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** The user's Google grant is gone (revoked, expired, never connected); reconnecting fixes it. */
export class GoogleReauthRequired extends Error {
  constructor(message = 'Google access must be reconnected') {
    super(message);
    this.name = 'GoogleReauthRequired';
  }
}

/**
 * Server misconfiguration (e.g. GOOGLE_TOKEN_ENC_KEY changed so stored tokens no longer open).
 * Not the user's fault: their grant is left untouched so fixing the config restores it.
 */
export class GoogleConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleConfigError';
  }
}

/**
 * A Google call that did not succeed. `status` is 0 when no HTTP answer arrived (timeout or
 * network failure). `phase` says which request failed: `auth` (token endpoint, nothing was done
 * on the user's behalf yet) or `request` (the API call itself, which may have taken effect).
 */
export class GoogleApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string,
    message: string,
    public readonly phase: 'auth' | 'request' = 'request',
  ) {
    super(message);
    this.name = 'GoogleApiError';
  }

  /** The API request itself got no answer or a server error: it may or may not have taken effect. */
  get outcomeUnknown(): boolean {
    return this.phase === 'request' && (this.status === 0 || this.status >= 500);
  }

  static async fromResponse(res: Response, phase: 'auth' | 'request' = 'request'): Promise<GoogleApiError> {
    let reason = `HTTP_${res.status}`;
    let message = res.statusText || reason;
    try {
      const body = (await res.json()) as { error?: { status?: string; message?: string } | string; error_description?: string };
      if (typeof body.error === 'string') {
        reason = body.error;
        message = body.error_description ?? body.error;
      } else if (body.error) {
        reason = body.error.status ?? reason;
        message = body.error.message ?? message;
      }
    } catch {
      // Non-JSON error body: keep the HTTP status as the reason.
    }
    return new GoogleApiError(res.status, reason, message.slice(0, 500), phase);
  }

  static fromThrown(error: unknown, phase: 'auth' | 'request' = 'request'): GoogleApiError {
    const name = (error as { name?: string } | null)?.name;
    const timeout = name === 'TimeoutError' || name === 'AbortError';
    return new GoogleApiError(0, timeout ? 'TIMEOUT' : 'NETWORK', timeout ? 'Google did not answer in time' : String(error), phase);
  }
}

/** The action cannot run as specified (e.g. no free slot); retrying unchanged will not help. */
export class OperationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'OperationError';
  }
}

/**
 * A short, stable code that is safe to show users and store on an action. Google's raw messages
 * can echo request details, so they are logged server-side instead.
 */
export function errorCode(error: unknown): string {
  if (error instanceof GoogleReauthRequired) return 'REAUTH_REQUIRED';
  if (error instanceof GoogleConfigError) return 'GOOGLE_CONFIG';
  if (error instanceof OperationError) return error.code;
  if (error instanceof GoogleApiError) {
    if (error.phase === 'auth') return 'GOOGLE_AUTH_UNAVAILABLE';
    return error.status ? `GOOGLE_${error.status}` : `GOOGLE_${error.reason}`;
  }
  return 'INTERNAL';
}

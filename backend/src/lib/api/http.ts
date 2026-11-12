import type { NextRequest } from 'next/server';
import { z } from 'zod';

/** An error the client should see, with a stable machine-readable code. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

/**
 * Per-request phase timings, returned as a `Server-Timing` header so latency can be read in
 * DevTools or by scripts/bench.mjs without extra logging.
 */
export class Timing {
  private readonly started = performance.now();
  private readonly entries: string[] = [];

  async measure<T>(name: string, work: PromiseLike<T> | (() => PromiseLike<T>)): Promise<T> {
    const start = performance.now();
    try {
      return await (typeof work === 'function' ? work() : work);
    } finally {
      this.entries.push(`${name};dur=${(performance.now() - start).toFixed(1)}`);
    }
  }

  header(): string {
    return [...this.entries, `total;dur=${(performance.now() - this.started).toFixed(1)}`].join(', ');
  }
}

export const ok = <T>(data: T, status = 200, headers?: HeadersInit) =>
  Response.json({ data }, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

const fail = (status: number, code: string, message: string, details?: unknown) =>
  Response.json(
    { error: { code, message, ...(details !== undefined && { details }) } },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );

export async function parseJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Body must be valid JSON');
  }
}

/**
 * Postgres / PostgREST error codes that mean "the client asked for something wrong". The client
 * gets a fixed message per code: raw database messages name tables, columns and constraints.
 */
const PG_ERRORS: Record<string, [number, string, string]> = {
  PGRST116: [404, 'NOT_FOUND', 'Resource not found'],
  '42501': [403, 'FORBIDDEN', 'Not allowed'],
  '23505': [409, 'CONFLICT', 'Conflict with existing data'],
  '23503': [409, 'FK_VIOLATION', 'Refers to data that does not exist'],
  '23514': [400, 'CHECK_VIOLATION', 'A value is out of range'],
  '22P02': [400, 'INVALID_INPUT', 'A value has the wrong format'],
};

export type RouteContext<P> = { params: P; timing: Timing };

/**
 * Wraps a route handler: awaits dynamic params, maps thrown errors to the
 * `{ error: { code, message, details? } }` envelope, and attaches `Server-Timing`.
 */
export function route<P = Record<string, never>>(
  handler: (req: NextRequest, ctx: RouteContext<P>) => Promise<Response>,
) {
  return async (req: NextRequest, segment: { params: Promise<P> }): Promise<Response> => {
    const timing = new Timing();
    let res: Response;
    try {
      res = await handler(req, { params: await segment.params, timing });
    } catch (error) {
      res = toErrorResponse(error);
    }
    res.headers.set('Server-Timing', timing.header());
    return res;
  };
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof z.ZodError) return fail(400, 'VALIDATION_FAILED', 'Invalid request', z.flattenError(error));
  if (error instanceof ApiError) return fail(error.status, error.code, error.message, error.details);
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && PG_ERRORS[code]) {
    const [status, name, message] = PG_ERRORS[code];
    console.error(`[api] database rejected the request (${code})`, error);
    return fail(status, name, message);
  }
  console.error('[api] unhandled error', error);
  return fail(500, 'INTERNAL', 'Unexpected error');
}

/** Throws the Supabase error if present, otherwise returns the data. */
export function unwrap<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}

import 'server-only';

import { GoogleApiError, OperationError } from './errors';
import { GOOGLE_TIMEOUT_MS } from './oauth';
import type { Interval } from './slots';
import { getAccessToken } from './tokens';

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const CALENDAR = 'https://www.googleapis.com/calendar/v3';

async function send(token: string, url: string, method: string, body: unknown): Promise<Response> {
  try {
    return await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body !== undefined && { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    });
  } catch (error) {
    throw GoogleApiError.fromThrown(error);
  }
}

/**
 * One authorized Google REST call. A 401 means the access token was rejected before anything
 * happened, so it is refreshed and the call retried exactly once.
 */
export async function googleApi<T>(userId: string, url: string, method = 'GET', body?: unknown): Promise<T> {
  let res = await send(await getAccessToken(userId), url, method, body);
  if (res.status === 401) res = await send(await getAccessToken(userId, { force: true }), url, method, body);
  if (!res.ok) throw await GoogleApiError.fromResponse(res);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export async function gmailSend(userId: string, raw: string): Promise<{ id: string; threadId?: string }> {
  return googleApi(userId, `${GMAIL}/messages/send`, 'POST', { raw });
}

export async function freeBusy(userId: string, timeMin: string, timeMax: string, timeZone: string): Promise<Interval[]> {
  const body = await googleApi<{ calendars?: Record<string, { busy?: Interval[]; errors?: unknown[] }> }>(
    userId,
    `${CALENDAR}/freeBusy`,
    'POST',
    { timeMin, timeMax, timeZone, items: [{ id: 'primary' }] },
  );
  const primary = body.calendars?.primary;
  if (primary?.errors?.length) throw new GoogleApiError(502, 'FREEBUSY_ERROR', 'Google could not read the calendar');
  return primary?.busy ?? [];
}

export type CalendarEvent = {
  id: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  htmlLink?: string;
  hangoutLink?: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
};

export type NewEvent = {
  id: string;
  summary: string;
  description: string;
  start: string;
  end: string;
  timeZone: string;
  attendees: { email: string; displayName?: string }[];
};

/**
 * Inserts the event with a caller-chosen id plus a Meet link, and emails invitations. A 409 means
 * an earlier attempt already created this exact event, so the existing one is returned.
 */
export async function insertEventIdempotent(userId: string, event: NewEvent): Promise<CalendarEvent> {
  const url = `${CALENDAR}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`;
  try {
    return await googleApi<CalendarEvent>(userId, url, 'POST', {
      id: event.id,
      summary: event.summary,
      description: event.description,
      start: { dateTime: event.start, timeZone: event.timeZone },
      end: { dateTime: event.end, timeZone: event.timeZone },
      attendees: event.attendees,
      conferenceData: { createRequest: { requestId: event.id, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
    });
  } catch (error) {
    if (error instanceof GoogleApiError && error.status === 409) {
      const existing = await googleApi<CalendarEvent>(userId, `${CALENDAR}/calendars/primary/events/${event.id}`);
      // Someone deleted the booking in Calendar; the id stays reserved, so it cannot be re-created.
      if (existing.status === 'cancelled') throw new OperationError('EVENT_CANCELLED', 'The interview event was cancelled in Google Calendar');
      return existing;
    }
    throw error;
  }
}

export const meetLinkOf = (event: CalendarEvent) =>
  event.hangoutLink ?? event.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri;

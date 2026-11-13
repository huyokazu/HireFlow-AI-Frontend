import 'server-only';

import type { OperationsActionResult, ScheduleInterviewPayload, SendEmailPayload } from '@/lib/contracts';
import { supabaseAdmin } from '@/lib/supabase/server';

import { freeBusy, gmailSend, insertEventIdempotent, meetLinkOf } from './client';
import { DEFAULT_TIME_ZONE, googleConfig } from './config';
import { calendarEventId, sha256Hex } from './crypto';
import { OperationError } from './errors';
import { buildMime, isEmailAddress, toGmailRaw } from './mime';
import { defaultInterviewWindow, findFreeSlot, isValidTimeZone, type Interval } from './slots';

/**
 * What the Operations Agent can do with Google. `simulated` implementations never call Google.
 * `actionKey` must be unique across workspaces (the executor passes `<workspaceId>:<idempotencyKey>`):
 * it fixes the calendar event id, so two workspaces can never collide on one event.
 */
export interface GoogleOps {
  readonly simulated: boolean;
  scheduleInterview(actionKey: string, payload: ScheduleInterviewPayload): Promise<OperationsActionResult>;
  sendEmail(actionKey: string, payload: SendEmailPayload): Promise<OperationsActionResult>;
}

type Attendee = { email: string; displayName?: string };

/** Applies the demo redirect: when configured, it replaces every outbound address. */
function recipients(list: Attendee[]): { attendees: Attendee[]; deliveredTo?: string } {
  const redirect = googleConfig.redirectEmail;
  if (redirect) return { attendees: [{ email: redirect }], deliveredTo: redirect };
  const valid = list.filter((a) => isEmailAddress(a.email));
  if (valid.length === 0) throw new OperationError('MISSING_EMAIL', 'The candidate has no valid email address');
  return { attendees: valid.filter((a, i) => valid.findIndex((b) => b.email === a.email) === i) };
}

/** Shared by both modes, so simulated runs exercise the same validation and slot choice. */
function planInterview(payload: ScheduleInterviewPayload, now: Date) {
  const timeZone = isValidTimeZone(payload.timeZone) ? payload.timeZone : DEFAULT_TIME_ZONE;
  // A window that already passed (an approval that sat too long) rolls forward instead of failing.
  const window: Interval =
    new Date(payload.windowEnd).getTime() > now.getTime()
      ? { start: payload.windowStart, end: payload.windowEnd }
      : defaultInterviewWindow(now, timeZone);
  const { attendees, deliveredTo } = recipients([
    { email: payload.candidateEmail, displayName: payload.candidateName },
    ...payload.interviewers.map((email) => ({ email })),
  ]);
  return { timeZone, window, attendees, deliveredTo };
}

function chooseSlot(plan: ReturnType<typeof planInterview>, payload: ScheduleInterviewPayload, busy: Interval[], now: Date) {
  const slot = findFreeSlot({
    windowStart: plan.window.start,
    windowEnd: plan.window.end,
    durationMinutes: payload.durationMinutes,
    timeZone: plan.timeZone,
    busy,
    notBefore: now,
  });
  if (!slot) throw new OperationError('NO_FREE_SLOT', 'No free slot in working hours within the scheduling window');
  return slot;
}

function prepareEmail(payload: SendEmailPayload) {
  const { attendees, deliveredTo } = recipients([{ email: payload.to, displayName: payload.candidateName }]);
  const mime = buildMime({
    to: attendees[0].email,
    toName: deliveredTo ? undefined : payload.candidateName,
    subject: payload.subject,
    text: payload.text,
    // HTML is always rendered from the text, so what HR approved is exactly what is sent.
  });
  return { raw: toGmailRaw(mime), deliveredTo };
}

export function liveOps(userId: string): GoogleOps {
  return {
    simulated: false,
    async scheduleInterview(actionKey, payload) {
      const now = new Date();
      const plan = planInterview(payload, now);
      const busy = await freeBusy(userId, plan.window.start, plan.window.end, plan.timeZone);
      const slot = chooseSlot(plan, payload, busy, now);
      const event = await insertEventIdempotent(userId, {
        id: calendarEventId(actionKey),
        summary: payload.title,
        description: payload.description,
        start: slot.start,
        end: slot.end,
        timeZone: plan.timeZone,
        attendees: plan.attendees,
      });
      return {
        providerRef: event.id,
        // On a 409 replay the existing event's time wins over the slot computed now.
        startsAt: event.start?.dateTime ? new Date(event.start.dateTime).toISOString() : slot.start,
        endsAt: event.end?.dateTime ? new Date(event.end.dateTime).toISOString() : slot.end,
        meetLink: meetLinkOf(event),
        htmlLink: event.htmlLink,
        ...(plan.deliveredTo && { deliveredTo: plan.deliveredTo }),
      };
    },
    async sendEmail(_actionKey, payload) {
      const { raw, deliveredTo } = prepareEmail(payload);
      const sent = await gmailSend(userId, raw);
      return { providerRef: sent.id, ...(deliveredTo && { deliveredTo }) };
    },
  };
}

/** Letters a–p from hex, for readable fake Meet codes. */
const letters = (hex: string) => [...hex].map((h) => String.fromCharCode(97 + parseInt(h, 16))).join('');

export const simulatedOps: GoogleOps = {
  simulated: true,
  async scheduleInterview(actionKey, payload) {
    const now = new Date();
    const plan = planInterview(payload, now);
    const slot = chooseSlot(plan, payload, [], now);
    const id = calendarEventId(actionKey);
    const code = letters(id.slice(0, 7));
    return {
      providerRef: id,
      startsAt: slot.start,
      endsAt: slot.end,
      meetLink: `https://meet.google.com/sim-${code.slice(0, 4)}-${code.slice(4)}`,
      ...(plan.deliveredTo && { deliveredTo: plan.deliveredTo }),
    };
  },
  async sendEmail(actionKey, payload) {
    const { deliveredTo } = prepareEmail(payload);
    return { providerRef: `sim-msg-${sha256Hex(actionKey).slice(0, 16)}`, ...(deliveredTo && { deliveredTo }) };
  },
};

/**
 * `live`/`simulated` are forced by GOOGLE_MODE. `auto` is simulated only when OAuth is not
 * configured or the user never connected Google. A connection that went `needs_reauth`/`revoked`
 * stays live, so its actions block on reconnecting instead of faking success.
 */
export function modeFor(connection: string | null | undefined): 'live' | 'simulated' {
  const mode = googleConfig.mode;
  if (mode !== 'auto') return mode;
  return googleConfig.clientId && connection ? 'live' : 'simulated';
}

export async function resolveMode(userId: string): Promise<'live' | 'simulated'> {
  if (googleConfig.mode !== 'auto' || !googleConfig.clientId) return modeFor(null);
  const { data, error } = await supabaseAdmin().from('google_connections').select('status').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return modeFor(data?.status);
}

export async function googleOpsFor(userId: string): Promise<GoogleOps> {
  return (await resolveMode(userId)) === 'live' ? liveOps(userId) : simulatedOps;
}

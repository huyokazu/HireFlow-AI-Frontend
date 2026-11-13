import { requireRemote } from './remote';

/**
 * The Operations Agent books interviews in Google Calendar and sends emails from the recruiter's
 * Gmail. It never calls Google straight away: every step is an action that is proposed, approved
 * (automatically for interviews when the workspace allows it, by HR for emails such as offers),
 * then executed once by the server.
 */

export type OperationsActionKind = 'schedule_interview' | 'send_email';

export type OperationsActionStatus =
  | 'proposed'
  | 'approved'
  | 'executing'
  | 'succeeded'
  | 'failed'
  /** The request reached Google but no answer came back; a human must check before retrying. */
  | 'ambiguous'
  | 'rejected'
  /** Google access was revoked or expired; reconnecting Google re-queues the action. */
  | 'blocked_reauth';

export type ScheduleInterviewPayload = {
  candidateName: string;
  candidateEmail: string;
  /** Extra guests, e.g. the hiring manager. */
  interviewers: string[];
  title: string;
  description: string;
  durationMinutes: number;
  /** Earliest and latest acceptable start, ISO 8601. The agent picks the first free slot. */
  windowStart: string;
  windowEnd: string;
  timeZone: string;
};

export type SendEmailPayload = {
  candidateName: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** What the email is for, so the activity feed can say "offer sent". */
  purpose: 'offer' | 'interview_follow_up' | 'general';
};

export type OperationsActionResult = {
  /** Calendar event id or Gmail message id. */
  providerRef?: string;
  startsAt?: string;
  endsAt?: string;
  meetLink?: string;
  htmlLink?: string;
  /** Recipient after the demo redirect, if one is configured. */
  deliveredTo?: string;
};

type ActionBase = {
  id: string;
  status: OperationsActionStatus;
  requiresApproval: boolean;
  campaignId: string | null;
  candidateId: string | null;
  /** True when Google was not called (no connection, or GOOGLE_MODE=simulated). */
  simulated: boolean;
  result: OperationsActionResult | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OperationsAction = ActionBase &
  (
    | { kind: 'schedule_interview'; payload: ScheduleInterviewPayload }
    | { kind: 'send_email'; payload: SendEmailPayload }
  );

export type GoogleConnectionStatus = {
  connected: boolean;
  status: 'active' | 'needs_reauth' | 'revoked' | null;
  email: string | null;
  scopes: string[];
  connectedAt: string | null;
  /** live: real Google calls; simulated: never calls Google; auto: live when connected. */
  mode: 'live' | 'simulated' | 'auto';
};

/** Recent Operations Agent actions, newest first. */
export function fetchOperationsActions(limit = 20): Promise<OperationsAction[]> {
  return requireRemote().request<OperationsAction[]>(`/api/operations/actions?limit=${limit}`);
}

/** Approves a proposed action. The server executes it in the background and reports over Realtime. */
export function approveOperationsAction(actionId: string): Promise<OperationsAction> {
  return requireRemote().request<OperationsAction>(`/api/operations/actions/${encodeURIComponent(actionId)}/approve`, {
    method: 'POST',
  });
}

export function rejectOperationsAction(actionId: string): Promise<OperationsAction> {
  return requireRemote().request<OperationsAction>(`/api/operations/actions/${encodeURIComponent(actionId)}/reject`, {
    method: 'POST',
  });
}

/** Queues a failed or reconnect-blocked action again. */
export function retryOperationsAction(actionId: string): Promise<OperationsAction> {
  return requireRemote().request<OperationsAction>(`/api/operations/actions/${encodeURIComponent(actionId)}/retry`, {
    method: 'POST',
  });
}

export function fetchGoogleConnection(): Promise<GoogleConnectionStatus> {
  return requireRemote().request<GoogleConnectionStatus>('/api/integrations/google');
}

/**
 * Starts connecting Google. `returnTo` is where the server sends the browser afterwards, with
 * `?google=connected|denied|missing_scopes|account_mismatch|error`; it must be on the server's allow list.
 */
export async function startGoogleConnect(returnTo: string): Promise<string> {
  const { url } = await requireRemote().request<{ url: string }>('/api/integrations/google/start', {
    method: 'POST',
    body: { returnTo },
  });
  if (!/^https?:\/\//.test(url)) throw new Error('The server returned an unexpected sign-in address.');
  return url;
}

/** Revokes the Google token at Google and forgets it. Actions fall back to simulated mode. */
export async function disconnectGoogle(): Promise<void> {
  await requireRemote().request<{ disconnected: boolean }>('/api/integrations/google', { method: 'DELETE' });
}

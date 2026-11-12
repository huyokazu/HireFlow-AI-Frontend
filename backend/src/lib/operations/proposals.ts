import 'server-only';

import { z } from 'zod';

import { ApiError } from '@/lib/api/http';
import type { AgentEvent, Localized, OperationsAction, OperationsActionKind } from '@/lib/contracts';
import { recordAgentEvents } from '@/lib/events';
import { DEFAULT_TIME_ZONE } from '@/lib/google/config';
import { resolveMode } from '@/lib/google/ops';
import { defaultInterviewWindow, isValidTimeZone } from '@/lib/google/slots';
import type { Json } from '@/lib/supabase/database.types';
import { supabaseAdmin } from '@/lib/supabase/server';

import { toOperationsAction } from './actions';
import { defaultKey } from './keys';

const email = z.email().max(254);
const text = (max: number) => z.string().trim().min(1).max(max);

export const scheduleInterviewSchema = z.object({
  candidateName: text(200),
  // May be empty: the executor fails clearly unless a demo redirect address is configured.
  candidateEmail: z.union([email, z.literal('')]),
  interviewers: z.array(email).max(10),
  title: text(200),
  description: z.string().max(5000),
  durationMinutes: z.number().int().min(15).max(240),
  windowStart: z.iso.datetime({ offset: true }),
  windowEnd: z.iso.datetime({ offset: true }),
  timeZone: z.string().refine(isValidTimeZone, 'Unknown time zone'),
});

export const sendEmailSchema = z.object({
  candidateName: text(200),
  to: z.union([email, z.literal('')]),
  subject: text(250),
  text: text(20_000),
  // No `html`: the server renders it from `text`, so approvers see exactly what is sent.
  purpose: z.enum(['offer', 'interview_follow_up', 'general']),
});

export type ProposeInput = {
  workspaceId: string;
  /** Whose Google account will execute the action. */
  userId: string;
  kind: OperationsActionKind;
  candidateId: string;
  campaignId?: string;
  /** Overrides from a client. Any override means a human must approve what was written. */
  payload?: Record<string, unknown>;
  /** A client-chosen key; stored as `client:<key>` so it can never collide with the agent's own keys. */
  clientKey?: string;
};

/** Agent keys (`interview:…`, `offer:…`) are reserved; clients get their own namespace. */
export const isReservedKey = (key: string) => /^(interview|offer):/i.test(key);

export type Proposal = { action: OperationsAction; created: boolean; events: AgentEvent[] };

type Context = { name: string; email: string; role: string; recruiter: string; timeZone: string };

function defaultPayload(kind: OperationsActionKind, c: Context, now: Date) {
  if (kind === 'schedule_interview') {
    const window = defaultInterviewWindow(now, c.timeZone);
    return {
      candidateName: c.name,
      candidateEmail: c.email,
      interviewers: [],
      title: `Interview: ${c.name} – ${c.role}`,
      description: `Interview with ${c.name} for the ${c.role} position.\nScheduled by HireFlow AI on behalf of ${c.recruiter}.`,
      durationMinutes: 45,
      windowStart: window.start,
      windowEnd: window.end,
      timeZone: c.timeZone,
    };
  }
  return {
    candidateName: c.name,
    to: c.email,
    subject: `Offer: ${c.role} – ${c.name}`,
    text:
      `Dear ${c.name},\n\nWe are delighted to offer you the ${c.role} position. ` +
      `Please reply to this email to confirm, or let us know if you have any questions.\n\nBest regards,\n${c.recruiter}`,
    purpose: 'offer' as const,
  };
}

/**
 * Proposes an action for a candidate's application. Idempotent: a second proposal with the same
 * key returns the existing row (`created: false`) and changes nothing. Interviews skip approval
 * when the workspace allows it; emails always wait for HR.
 */
export async function proposeAction(input: ProposeInput): Promise<Proposal> {
  const db = supabaseAdmin();
  let applications = db
    .from('applications')
    .select('id, campaign_id, campaign:campaigns(title)')
    .eq('workspace_id', input.workspaceId)
    .eq('candidate_id', input.candidateId);
  if (input.campaignId) applications = applications.eq('campaign_id', input.campaignId);

  const [candidate, application, workspace, profile] = await Promise.all([
    db.from('candidates').select('name, email').eq('id', input.candidateId).eq('workspace_id', input.workspaceId).maybeSingle(),
    applications.order('stage_entered_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('workspaces').select('auto_approve_interviews').eq('id', input.workspaceId).single(),
    db.from('profiles').select('display_name, timezone').eq('id', input.userId).maybeSingle(),
  ]);
  for (const result of [candidate, application, workspace, profile]) if (result.error) throw result.error;
  if (!workspace.data) throw new ApiError(404, 'NOT_FOUND', 'Workspace not found');
  if (!candidate.data) throw new ApiError(404, 'NOT_FOUND', 'Candidate not found');
  if (!application.data) throw new ApiError(404, 'NOT_FOUND', 'The candidate has no application in this campaign');

  const campaign = application.data.campaign as { title: Localized } | null;
  const zone = profile.data?.timezone;
  const context: Context = {
    name: candidate.data.name,
    email: candidate.data.email ?? '',
    role: campaign?.title.en ?? 'open',
    recruiter: profile.data?.display_name || 'the HireFlow team',
    timeZone: zone && isValidTimeZone(zone) ? zone : DEFAULT_TIME_ZONE,
  };
  const merged = { ...defaultPayload(input.kind, context, new Date()), ...input.payload };
  const payload = (input.kind === 'schedule_interview' ? scheduleInterviewSchema : sendEmailSchema).parse(merged);
  if ('windowEnd' in payload && new Date(payload.windowEnd) <= new Date(payload.windowStart)) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'windowEnd must be after windowStart');
  }

  const edited = input.payload !== undefined && Object.keys(input.payload).length > 0;
  const requiresApproval = edited || input.kind === 'send_email' || !workspace.data.auto_approve_interviews;
  const key = input.clientKey ? `client:${input.clientKey}` : defaultKey(input.kind, application.data.id);
  const inserted = await db
    .from('agent_actions')
    .upsert(
      {
        workspace_id: input.workspaceId,
        requested_by: input.userId,
        kind: input.kind,
        idempotency_key: key,
        campaign_id: application.data.campaign_id,
        candidate_id: input.candidateId,
        application_id: application.data.id,
        payload: payload as NonNullable<Json>,
        requires_approval: requiresApproval,
        status: requiresApproval ? 'proposed' : 'approved',
        approved_at: requiresApproval ? null : new Date().toISOString(),
      },
      { onConflict: 'workspace_id,idempotency_key', ignoreDuplicates: true },
    )
    .select('*');
  if (inserted.error) throw inserted.error;

  if (inserted.data.length === 0) {
    const existing = await db
      .from('agent_actions')
      .select('*')
      .eq('workspace_id', input.workspaceId)
      .eq('idempotency_key', key)
      .single();
    if (existing.error) throw existing.error;
    if (existing.data.kind !== input.kind || existing.data.candidate_id !== input.candidateId) {
      throw new ApiError(409, 'CONFLICT', 'This idempotency key already belongs to a different action');
    }
    return { action: toOperationsAction(existing.data), created: false, events: [] };
  }

  const action = toOperationsAction(inserted.data[0]);
  const events =
    action.kind === 'send_email' && action.payload.purpose === 'offer'
      ? await recordAgentEvents(input.workspaceId, [
          {
            kind: 'offerDrafted',
            actor: 'offer',
            campaignId: application.data.campaign_id,
            candidateId: input.candidateId,
            candidate: context.name,
            actionId: action.id,
            simulated: (await resolveMode(input.userId)) === 'simulated',
          },
        ])
      : [];
  return { action, created: true, events };
}

/** A freshly proposed action that skipped approval should run now. */
export const shouldExecute = (proposal: Proposal) => proposal.created && proposal.action.status === 'approved';

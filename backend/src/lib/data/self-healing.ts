import 'server-only';

import { ApiError, unwrap, type Timing } from '@/lib/api/http';
import type { AgentEvent, AlertWithDecision } from '@/lib/contracts';
import { toAgentEvent } from '@/lib/events';
import type { Json, Tables } from '@/lib/supabase/database.types';
import { supabaseAdmin, type WorkspaceContext } from '@/lib/supabase/server';

import { ensureChannelRows } from './campaigns';
import { ALERT_COLUMNS, toAlert, toSetup, type AlertContent, type HealingContent } from './mappers';
import { rowsOf } from './result';
import { campaignDraftSchema } from './schemas';

type AlertStatus = AlertWithDecision['status'];

/** 404 when the alert is not in the workspace, otherwise 409: it was not in the expected state. */
async function notInState(ctx: WorkspaceContext, alertId: string, expected: AlertStatus): Promise<never> {
  const existing = unwrap(
    await ctx.supabase
      .from('bottleneck_alerts')
      .select('status')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', alertId)
      .maybeSingle(),
  );
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Alert not found');
  throw new ApiError(409, 'CONFLICT', `The alert is ${existing.status}, not ${expected}`);
}

/**
 * Dismisses or reopens with the member's token. The status filter makes it atomic (of two
 * concurrent decisions only one matches); a database trigger stamps who decided and when.
 */
async function transition(
  ctx: WorkspaceContext,
  alertId: string,
  from: AlertStatus,
  to: AlertStatus,
): Promise<AlertWithDecision> {
  const rows = rowsOf(
    await ctx.supabase
      .from('bottleneck_alerts')
      .update({ status: to })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', alertId)
      .eq('status', from)
      .select(ALERT_COLUMNS),
  );
  return rows[0] ? toAlert(rows[0]) : notInState(ctx, alertId, from);
}

export const dismissAlert = (ctx: WorkspaceContext, alertId: string) => transition(ctx, alertId, 'open', 'dismissed');

/** Undoes a dismissal; an approved fix cannot be taken back this way. */
export const reopenAlert = (ctx: WorkspaceContext, alertId: string) => transition(ctx, alertId, 'dismissed', 'open');

type Approval = { alert: Tables<'bottleneck_alerts'>; event: Tables<'agent_events'> } | null;

/**
 * Approves one of an open alert's suggested fixes. Deciding the alert, applying the fix's setup
 * change, the audit record and the `fixApplied` event are one database transaction
 * (`approve_alert_fix`), so a failure leaves the alert open and nothing applied.
 */
export async function approveFix(
  ctx: WorkspaceContext,
  alertId: string,
  fixId: string,
  timing: Timing,
): Promise<{ alert: AlertWithDecision; events: AgentEvent[] }> {
  const found = unwrap(
    await timing.measure(
      'db',
      ctx.supabase
        .from('bottleneck_alerts')
        .select('id, campaign_id, status, content, campaign:campaigns(setup)')
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', alertId)
        .maybeSingle(),
    ),
  );
  if (!found) throw new ApiError(404, 'NOT_FOUND', 'Alert not found');
  if (found.status !== 'open') throw new ApiError(409, 'CONFLICT', `The alert is already ${found.status}`);
  const content = found.content as AlertContent;
  const fix = content.suggestedFixes.find((item) => item.id === fixId);
  if (!fix) throw new ApiError(400, 'VALIDATION_FAILED', 'This alert has no such fix', { fixId });

  // Checked before anything is written, so a fix that no longer fits the setup changes nothing.
  const setup = toSetup(found.campaign?.setup ?? null);
  const patched = setup && fix.patch ? campaignDraftSchema.safeParse({ ...setup, ...fix.patch }) : null;
  if (patched && !patched.success) {
    throw new ApiError(409, 'CONFLICT', 'The fix no longer applies to the campaign setup');
  }

  const { current, label } = content.metric;
  const record: HealingContent = {
    campaignName: content.campaignName,
    issue: content.title,
    fix: fix.actionLabel,
    // While the fix is in progress, `after` is the forecast.
    result: { label, before: current, after: Math.min(100, current + fix.expectedLift) },
  };
  // Server write after the membership check above; the function only touches this workspace.
  const approval = unwrap(
    await timing.measure(
      'db_approve',
      supabaseAdmin().rpc('approve_alert_fix', {
        ws: ctx.workspaceId,
        alert_id: alertId,
        fix_id: fix.id,
        fix_label: fix.actionLabel as Json,
        setup_patch: (patched?.success ? fix.patch : null) as Json,
        record: record as Json,
        actor: ctx.userId,
      }),
    ),
  ) as Approval;
  if (!approval) return notInState(ctx, alertId, 'open');

  // Zero result rows for channels the fix added; idempotent, and not part of the decision.
  if (patched?.success && fix.patch?.channels) {
    await timing.measure('db_channels', ensureChannelRows(ctx.workspaceId, found.campaign_id, fix.patch.channels));
  }
  return { alert: toAlert(approval.alert), events: [toAgentEvent(approval.event)] };
}

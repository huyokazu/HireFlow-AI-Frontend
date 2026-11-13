import { z } from 'zod';

import { ok, parseJson, route } from '@/lib/api/http';
import { ACTION_STATUSES, listActions } from '@/lib/operations/actions';
import { executeInBackground } from '@/lib/operations/executor';
import { requireFreshWorkspace } from '@/lib/operations/auth';
import { isReservedKey, proposeAction, scheduleInterviewSchema, sendEmailSchema, shouldExecute } from '@/lib/operations/proposals';
import { requireWorkspace } from '@/lib/supabase/server';

const listQuery = z.object({
  status: z.enum(ACTION_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const id = z.string().trim().min(1).max(100);
const clientKey = z
  .string()
  .trim()
  .min(1)
  .max(190)
  .refine((key) => !isReservedKey(key), 'Keys starting with interview: or offer: are reserved for the agent')
  .optional();
const proposeBody = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('schedule_interview'),
    candidateId: id,
    campaignId: id.optional(),
    payload: scheduleInterviewSchema.partial().optional(),
    idempotencyKey: clientKey,
  }),
  z.object({
    kind: z.literal('send_email'),
    candidateId: id,
    campaignId: id.optional(),
    payload: sendEmailSchema.partial().optional(),
    idempotencyKey: clientKey,
  }),
]);

export const GET = route(async (req, { timing }) => {
  const ws = await requireWorkspace(req, timing);
  const params = req.nextUrl.searchParams;
  const query = listQuery.parse({ status: params.get('status') ?? undefined, limit: params.get('limit') ?? undefined });
  return ok(await timing.measure('db', listActions(ws.supabase, ws.workspaceId, query.status, query.limit)));
});

/**
 * 201 for a new action, 200 when the idempotency key already existed (nothing changes then), 409
 * when the key belongs to a different action. A client-edited payload always waits for approval.
 */
export const POST = route(async (req, { timing }) => {
  const ws = await requireFreshWorkspace(req, timing);
  const { idempotencyKey, ...body } = proposeBody.parse(await parseJson(req));
  const proposal = await timing.measure(
    'propose',
    proposeAction({ ...body, clientKey: idempotencyKey, workspaceId: ws.workspaceId, userId: ws.userId }),
  );
  if (shouldExecute(proposal)) executeInBackground(proposal.action.id);
  return ok(proposal.action, proposal.created ? 201 : 200);
});

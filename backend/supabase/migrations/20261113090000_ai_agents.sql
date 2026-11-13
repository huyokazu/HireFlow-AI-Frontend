-- AI agents (the ai/ module, called from the API).
--
-- applications.ai_details: the Talent Agent's rubric behind match_score (Proof-of-Skill: points per
--   part, matched and missing skills, reasons) and whether Gemini or the precomputed rubric graded
--   it. Agent-owned like match_score, so only the secret key writes it.
-- applications.hr_decision: HR's call in the review deck. 'skipped' keeps the candidate out of that
--   campaign's deck; they stay on the board. Members write it with their token (grant below), and
--   the existing applications_update policy limits them to rows in their workspaces.
alter table public.applications
  add column ai_details jsonb,
  add column hr_decision text check (hr_decision in ('skipped'));

-- POST /api/campaigns/:id/candidates/:candidateId/skip.
grant update (hr_decision) on public.applications to authenticated;

// Chuyển JSON của AI sang đúng kiểu dữ liệu mà Frontend đang dùng
// (xem HireFlow-AI-Frontend/src/services/candidates.ts và selfHealing.ts).

/** -> kiểu `Candidate` của Frontend. */
export function toCandidate({ id, profile, match, role }) {
  return {
    id,
    name: profile.full_name ?? 'Chưa rõ tên',
    role: role ?? profile.current_title ?? '',
    location: profile.location ?? '',
    yearsOfExperience: profile.years_of_experience ?? 0,
    matchScore: match.score,
    skills: profile.skills.map((s) => s.name),
    aiAssessment: match.summary,
  };
}

/** -> kiểu `BottleneckAlert` của Frontend. `campaign` là object chiến dịch gốc. */
export function toBottleneckAlert({ id, result, campaign, detectedAt = new Date().toISOString() }) {
  const kpi = Number(campaign.kpi_cv_per_week) || 0;
  const actual = Number(campaign.actual_cv_per_week) || 0;
  const percent = kpi > 0 ? Math.round((actual / kpi) * 100) : 0;
  const slug = (i) => `${id}_${i + 1}`;
  return {
    id,
    severity: percent < 50 ? 'critical' : 'warning',
    title: `Lượng CV chỉ đạt ${percent}% KPI (${actual}/${kpi} CV/tuần)`,
    campaignName: campaign.title ?? '',
    detectedAt,
    metric: { label: 'Tỷ lệ đạt KPI CV/tuần', current: Math.min(percent, 100), target: 100 },
    rootCause: {
      summary: result.diagnosis,
      confidence: result.confidence,
      factors: result.root_causes.map((c, i) => ({ id: `cause_${slug(i)}`, label: c.label, detail: c.detail, impact: c.impact })),
    },
    suggestedFixes: result.suggested_fixes.map((f, i) => ({
      id: `fix_${slug(i)}`,
      actionLabel: f.action_label,
      description: f.description,
      expectedImpact: f.expected_impact,
      recommended: f.recommended,
    })),
  };
}

export type AlertSeverity = 'critical' | 'warning';

export type ImpactLevel = 'high' | 'medium' | 'low';

export type RootCauseFactor = {
  id: string;
  label: string;
  detail: string;
  impact: ImpactLevel;
};

export type SuggestedFix = {
  id: string;
  /** Short verb phrase used on the approve button, e.g. "Expand Salary Range". */
  actionLabel: string;
  description: string;
  /** Forecast from the Hiring Digital Twin, e.g. "+22% match rate". */
  expectedImpact: string;
  recommended?: boolean;
};

export type BottleneckAlert = {
  id: string;
  severity: AlertSeverity;
  title: string;
  campaignName: string;
  /** ISO timestamp. */
  detectedAt: string;
  metric: {
    label: string;
    /** Percentages, 0–100. */
    current: number;
    target: number;
  };
  rootCause: {
    summary: string;
    /** 0–100. */
    confidence: number;
    factors: RootCauseFactor[];
  };
  suggestedFixes: SuggestedFix[];
};

const MOCK_ALERTS: BottleneckAlert[] = [
  {
    id: 'alert_matching_rate',
    severity: 'critical',
    title: 'Candidate matching rate is 30% below target',
    campaignName: 'Senior Frontend Engineer',
    detectedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    metric: { label: 'Candidate match rate', current: 42, target: 60 },
    rootCause: {
      summary:
        'Strong applicants are dropping out at the offer-fit stage. The salary band and experience bar are filtering out most of the qualified pool.',
      confidence: 87,
      factors: [
        {
          id: 'salary',
          label: 'Salary range below market',
          detail: 'Top of band is 18% under the median for this role and region.',
          impact: 'high',
        },
        {
          id: 'experience',
          label: 'Experience requirement too strict',
          detail: '"7+ years" removes 45% of otherwise qualified applicants.',
          impact: 'medium',
        },
        {
          id: 'channels',
          label: 'Limited sourcing channels',
          detail: 'The job is live on 2 of the 5 channels that performed best last quarter.',
          impact: 'low',
        },
      ],
    },
    suggestedFixes: [
      {
        id: 'fix_salary',
        actionLabel: 'Expand Salary Range',
        description: 'Raise the band from $115k–$135k to $130k–$155k.',
        expectedImpact: '+22% match rate',
        recommended: true,
      },
      {
        id: 'fix_experience',
        actionLabel: 'Relax Experience Requirement',
        description: 'Lower the requirement from 7+ to 5+ years.',
        expectedImpact: '+15% match rate',
      },
      {
        id: 'fix_channels',
        actionLabel: 'Add Sourcing Channels',
        description: 'Publish to LinkedIn and Wellfound in addition to current boards.',
        expectedImpact: '+8% match rate',
      },
    ],
  },
];

/**
 * Open alerts raised by the Self-Healing monitor for a campaign.
 * Mock implementation: replace with a Supabase query, or subscribe to inserts on the alerts
 * table with Realtime so new bottlenecks pop up as soon as the Orchestrator Agent detects them.
 */
export async function fetchActiveBottleneckAlerts(_campaignId: string): Promise<BottleneckAlert[]> {
  return MOCK_ALERTS;
}

/**
 * Tells the Orchestrator Agent to apply the fix HR approved.
 * Mock implementation: replace with a call to the Orchestrator Agent API.
 */
export async function approveSuggestedFix(_alertId: string, _fixId: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 1200));
}

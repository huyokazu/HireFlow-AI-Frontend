import { loadBootstrap } from './bootstrap';
import { fetchMatchedCandidates, type Candidate } from './candidates';
import { getRemote, mockDelay, readWithFallback } from './remote';

export type PipelineStage = 'applied' | 'screening' | 'interview' | 'offer' | 'hired';

/** Board columns, left to right. */
export const PIPELINE_STAGES: readonly PipelineStage[] = ['applied', 'screening', 'interview', 'offer', 'hired'];

/** A candidate on the hiring board: which campaign, which stage, and for how long. */
export type PipelineCandidate = Candidate & {
  campaignId: string;
  stage: PipelineStage;
  /** Whole days since the candidate entered the current stage. */
  daysInStage: number;
  /** HR skipped them in the campaign's review deck, so the deck no longer offers them. */
  skipped?: boolean;
};

/** A card left in one stage longer than this is flagged as stalled. */
export const STALLED_AFTER_DAYS = 5;

const FEATURED_CAMPAIGN_ID = 'senior-frontend-engineer';

// The Matching Agent's ranked candidates are still in screening; this is how long each has waited.
const MATCHED_DAYS_IN_STAGE: Record<string, number> = {
  cand_001: 1,
  cand_002: 2,
  cand_003: 6,
  cand_004: 3,
  cand_005: 7,
  cand_006: 4,
};

const OTHER_CANDIDATES: PipelineCandidate[] = [
  {
    id: 'cand_101',
    campaignId: FEATURED_CAMPAIGN_ID,
    stage: 'interview',
    daysInStage: 2,
    name: 'Linh Pham',
    role: { en: 'Senior Frontend Engineer', vi: 'Kỹ sư Frontend cấp cao' },
    location: { en: 'Hanoi', vi: 'Hà Nội' },
    yearsOfExperience: 8,
    matchScore: 91,
    skills: ['React', 'TypeScript', 'Micro-frontends', 'Webpack', 'Cypress'],
    aiAssessment: {
      en: 'Architected a micro-frontend platform used by 40 teams. Halfway through the interview loop, with a strong system design signal so far.',
      vi: 'Thiết kế nền tảng micro-frontend được 40 nhóm sử dụng. Đã đi được nửa vòng phỏng vấn, tín hiệu về thiết kế hệ thống rất tốt.',
    },
  },
  {
    id: 'cand_102',
    campaignId: FEATURED_CAMPAIGN_ID,
    stage: 'applied',
    daysInStage: 0,
    name: 'Hannah Kim',
    role: { en: 'Frontend Engineer', vi: 'Kỹ sư Frontend' },
    location: { en: 'Seoul, South Korea', vi: 'Seoul, Hàn Quốc' },
    yearsOfExperience: 4,
    matchScore: 72,
    skills: ['React', 'TypeScript', 'Zustand', 'Vite'],
    aiAssessment: {
      en: 'Solid product engineering background at a fintech scale-up. CV parsed and waiting for the Matching Agent to score it.',
      vi: 'Nền tảng phát triển sản phẩm vững tại một công ty fintech đang tăng trưởng. CV đã được phân tích, đang chờ Agent So khớp chấm điểm.',
    },
  },
  {
    id: 'cand_103',
    campaignId: FEATURED_CAMPAIGN_ID,
    stage: 'applied',
    daysInStage: 1,
    name: 'Tomás Silva',
    role: { en: 'Junior Frontend Developer', vi: 'Lập trình viên Frontend (Junior)' },
    location: { en: 'Lisbon, Portugal', vi: 'Lisbon, Bồ Đào Nha' },
    yearsOfExperience: 2,
    matchScore: 58,
    skills: ['React', 'CSS', 'Jest'],
    aiAssessment: {
      en: 'Promising fundamentals but well below the seniority bar. Likely a better fit for the graduate programme.',
      vi: 'Nền tảng hứa hẹn nhưng còn xa so với yêu cầu thâm niên. Có lẽ phù hợp hơn với chương trình tuyển sinh viên mới tốt nghiệp.',
    },
  },
  {
    id: 'cand_201',
    campaignId: 'product-designer',
    stage: 'interview',
    daysInStage: 3,
    name: 'Maya Patel',
    role: { en: 'Product Designer', vi: 'Nhà thiết kế sản phẩm' },
    location: { en: 'London, UK', vi: 'London, Anh' },
    yearsOfExperience: 6,
    matchScore: 89,
    skills: ['Figma', 'Prototyping', 'Design Systems', 'User Research'],
    aiAssessment: {
      en: 'Owned a B2B onboarding redesign end to end that lifted activation by 21%. Panel interview booked for Friday.',
      vi: 'Làm chủ toàn bộ dự án thiết kế lại onboarding B2B, giúp tăng 21% tỷ lệ kích hoạt. Đã đặt lịch phỏng vấn hội đồng vào thứ Sáu.',
    },
  },
  {
    id: 'cand_202',
    campaignId: 'product-designer',
    stage: 'interview',
    daysInStage: 6,
    name: 'Khoa Le',
    role: { en: 'UX/UI Designer', vi: 'Nhà thiết kế UX/UI' },
    location: { en: 'Da Nang', vi: 'Đà Nẵng' },
    yearsOfExperience: 4,
    matchScore: 77,
    skills: ['Figma', 'Motion Design', 'Usability Testing'],
    aiAssessment: {
      en: "Strong visual craft and motion work. The hiring manager's feedback has been pending for 6 days.",
      vi: 'Tay nghề thị giác và motion tốt. Phản hồi của quản lý tuyển dụng đã treo 6 ngày.',
    },
  },
  {
    id: 'cand_203',
    campaignId: 'product-designer',
    stage: 'offer',
    daysInStage: 1,
    name: 'Elena Rossi',
    role: { en: 'Senior Product Designer', vi: 'Nhà thiết kế sản phẩm cấp cao' },
    location: { en: 'Milan, Italy', vi: 'Milan, Ý' },
    yearsOfExperience: 9,
    matchScore: 93,
    skills: ['Figma', 'Design Systems', 'Workshop Facilitation', 'Accessibility'],
    aiAssessment: {
      en: 'Top scores in every interview. The offer sits inside the approved band and acceptance looks likely.',
      vi: 'Điểm cao nhất ở mọi vòng phỏng vấn. Offer nằm trong khung lương đã duyệt và khả năng nhận việc cao.',
    },
  },
  {
    id: 'cand_204',
    campaignId: 'product-designer',
    stage: 'screening',
    daysInStage: 2,
    name: 'Arjun Mehta',
    role: { en: 'Product Designer', vi: 'Nhà thiết kế sản phẩm' },
    location: { en: 'Pune, India', vi: 'Pune, Ấn Độ' },
    yearsOfExperience: 3,
    matchScore: 66,
    skills: ['Figma', 'Illustration', 'Webflow'],
    aiAssessment: {
      en: 'Good visual range, lighter on research and systems thinking. Worth a portfolio review before deciding.',
      vi: 'Phong cách thị giác đa dạng nhưng còn mỏng về nghiên cứu người dùng và tư duy hệ thống. Nên xem kỹ portfolio trước khi quyết định.',
    },
  },
  {
    id: 'cand_301',
    campaignId: 'data-engineer',
    stage: 'applied',
    daysInStage: 2,
    name: 'Chloé Martin',
    role: { en: 'Data Engineer', vi: 'Kỹ sư dữ liệu' },
    location: { en: 'Paris, France', vi: 'Paris, Pháp' },
    yearsOfExperience: 5,
    matchScore: 74,
    skills: ['Python', 'Spark', 'Airflow', 'dbt'],
    aiAssessment: {
      en: 'Built batch and streaming pipelines for a marketplace. Salary expectation sits above the current band.',
      vi: 'Đã xây dựng pipeline batch và streaming cho một sàn thương mại. Mức lương kỳ vọng cao hơn khung hiện tại.',
    },
  },
  {
    id: 'cand_302',
    campaignId: 'data-engineer',
    stage: 'applied',
    daysInStage: 4,
    name: 'Quang Vu',
    role: { en: 'Analytics Engineer', vi: 'Kỹ sư phân tích dữ liệu' },
    location: { en: 'Ho Chi Minh City', vi: 'TP. Hồ Chí Minh' },
    yearsOfExperience: 3,
    matchScore: 61,
    skills: ['SQL', 'dbt', 'BigQuery', 'Looker'],
    aiAssessment: {
      en: 'Strong SQL and data modelling; limited exposure to orchestration and streaming.',
      vi: 'Giỏi SQL và mô hình hóa dữ liệu; ít kinh nghiệm về điều phối pipeline và xử lý streaming.',
    },
  },
  {
    id: 'cand_401',
    campaignId: 'customer-success-lead',
    stage: 'offer',
    daysInStage: 2,
    name: 'Grace Owusu',
    role: { en: 'Customer Success Manager', vi: 'Quản lý Chăm sóc khách hàng' },
    location: { en: 'Accra · Remote', vi: 'Accra · Làm từ xa' },
    yearsOfExperience: 7,
    matchScore: 86,
    skills: ['SaaS Onboarding', 'Churn Analysis', 'HubSpot'],
    aiAssessment: {
      en: 'Cut churn by 30% across a 200-account book. Negotiating a start date; the Offer Agent sees no blockers.',
      vi: 'Giảm 30% tỷ lệ rời bỏ trên danh mục 200 khách hàng. Đang thống nhất ngày bắt đầu; Agent Offer không thấy trở ngại nào.',
    },
  },
  {
    id: 'cand_402',
    campaignId: 'customer-success-lead',
    stage: 'hired',
    daysInStage: 1,
    name: 'Mai Hoang',
    role: { en: 'Customer Success Lead', vi: 'Trưởng nhóm Chăm sóc khách hàng' },
    location: { en: 'Ho Chi Minh City', vi: 'TP. Hồ Chí Minh' },
    yearsOfExperience: 8,
    matchScore: 90,
    skills: ['Account Management', 'Salesforce', 'Coaching'],
    aiAssessment: {
      en: 'Accepted the offer yesterday. The Orchestrator has started the onboarding handoff.',
      vi: 'Đã nhận offer hôm qua. Agent Điều phối đã bắt đầu bàn giao quy trình onboarding.',
    },
  },
  {
    id: 'cand_501',
    campaignId: 'backend-engineer-go',
    stage: 'interview',
    daysInStage: 2,
    name: 'Lukas Novak',
    role: { en: 'Backend Engineer', vi: 'Kỹ sư Backend' },
    location: { en: 'Prague · Remote', vi: 'Praha · Làm từ xa' },
    yearsOfExperience: 6,
    matchScore: 84,
    skills: ['Go', 'PostgreSQL', 'gRPC', 'Kubernetes'],
    aiAssessment: {
      en: 'Built a payments ledger in Go handling 2k requests per second. System-design round booked for Thursday.',
      vi: 'Xây dựng sổ cái thanh toán bằng Go xử lý 2.000 yêu cầu mỗi giây. Đã đặt lịch vòng thiết kế hệ thống vào thứ Năm.',
    },
  },
  {
    id: 'cand_502',
    campaignId: 'backend-engineer-go',
    stage: 'screening',
    daysInStage: 1,
    name: 'Duc Nguyen',
    role: { en: 'Software Engineer', vi: 'Kỹ sư phần mềm' },
    location: { en: 'Da Nang', vi: 'Đà Nẵng' },
    yearsOfExperience: 4,
    matchScore: 76,
    skills: ['Go', 'Redis', 'Docker'],
    aiAssessment: {
      en: 'Solid Go services experience; the Matching Agent is checking depth on distributed systems.',
      vi: 'Có kinh nghiệm vững với dịch vụ Go; Agent So khớp đang đánh giá chiều sâu về hệ thống phân tán.',
    },
  },
  {
    id: 'cand_601',
    campaignId: 'hr-business-partner',
    stage: 'offer',
    daysInStage: 3,
    name: 'Thu Nguyen',
    role: { en: 'HR Business Partner', vi: 'Chuyên viên HRBP' },
    location: { en: 'Hanoi · Hybrid', vi: 'Hà Nội · Kết hợp' },
    yearsOfExperience: 9,
    matchScore: 88,
    skills: ['Employee Relations', 'Org Design', 'Vietnamese Labour Law'],
    aiAssessment: {
      en: 'Partnered with a 400-person engineering org through two reorganisations. Offer sent; awaiting reply.',
      vi: 'Từng đồng hành cùng khối kỹ thuật 400 người qua hai lần tái cấu trúc. Đã gửi offer, đang chờ phản hồi.',
    },
  },
  {
    id: 'cand_602',
    campaignId: 'hr-business-partner',
    stage: 'interview',
    daysInStage: 6,
    name: 'Isabel Ruiz',
    role: { en: 'People Partner', vi: 'Chuyên viên Nhân sự' },
    location: { en: 'Singapore', vi: 'Singapore' },
    yearsOfExperience: 7,
    matchScore: 79,
    skills: ['Performance Management', 'Coaching', 'Workday'],
    aiAssessment: {
      en: 'Strong coaching background. The panel interview has been waiting on the hiring manager for 6 days.',
      vi: 'Nền tảng coaching tốt. Vòng phỏng vấn hội đồng đã chờ quản lý tuyển dụng 6 ngày.',
    },
  },
];

/**
 * The hiring board: the candidates the AI agents put in front of HR, best match first. That is the
 * Matching Agent's ranked CVs, the ones that need a human call, and everyone still in the running from
 * interview on. A campaign's other applicants (its `candidates` on the dashboard count them all) are
 * still with the agents, were screened out, or left.
 */
export async function fetchPipeline(): Promise<PipelineCandidate[]> {
  return readWithFallback('pipeline', async (remote) => (await loadBootstrap(remote)).pipeline, mockPipeline);
}

async function mockPipeline(): Promise<PipelineCandidate[]> {
  const matched = await fetchMatchedCandidates(FEATURED_CAMPAIGN_ID);
  const inScreening: PipelineCandidate[] = matched.map((candidate) => ({
    ...candidate,
    campaignId: FEATURED_CAMPAIGN_ID,
    stage: 'screening',
    daysInStage: MATCHED_DAYS_IN_STAGE[candidate.id] ?? 1,
  }));
  return [...inScreening, ...OTHER_CANDIDATES].sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Saves a stage change. The board updates optimistically, so this resolves without a value and
 * rejects when the change was not saved. The Orchestrator then hands the candidate to the next agent
 * (on the server, e.g. the Operations Agent books an interview), and that shows up over Realtime.
 */
export async function saveCandidateStage(candidateId: string, stage: PipelineStage, campaignId?: string): Promise<void> {
  const remote = getRemote();
  if (!remote) return mockDelay(300);
  await remote.request<PipelineCandidate>(`/api/pipeline/${encodeURIComponent(candidateId)}`, {
    method: 'PATCH',
    body: { stage, campaignId },
  });
}

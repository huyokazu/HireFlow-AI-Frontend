// In kích thước từng prompt (không cần API Key). Dùng khi tối ưu token: sửa prompt -> chạy lại -> so sánh.
// Số token ở đây là ƯỚC LƯỢNG (ký tự / 3 với tiếng Việt). Số thật xem ở `npm run test:live`.
import { AGENTS } from '../prompts/index.js';
import { sample, sampleJson } from './env.js';

const inputs = {
  orchestrator: { request: 'Chiến dịch Marketing chỉ đạt 2/20 CV tuần này' },
  cvExtraction: { cvText: sample('cv_good.txt'), today: '2026-11-10' },
  talentMatching: { jdText: sample('jd_marketing.txt'), cvText: sample('cv_good.txt') },
  selfHealing: { campaign: sampleJson('campaign_marketing.json') },
};

const est = (s) => Math.round(s.length / 3);
console.log('Agent'.padEnd(16), 'System(ký tự)'.padStart(14), '≈token'.padStart(8), 'Input mẫu ≈token'.padStart(18), 'Max output'.padStart(11));
for (const [key, agent] of Object.entries(AGENTS)) {
  const req = agent.build(inputs[key]);
  const input = typeof req.input === 'string' ? req.input : JSON.stringify(req.input);
  console.log(
    key.padEnd(16),
    String(req.system.length).padStart(14),
    String(est(req.system)).padStart(8),
    String(est(input)).padStart(18),
    String(req.maxOutputTokens).padStart(11),
  );
}

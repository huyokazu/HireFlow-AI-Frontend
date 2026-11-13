// TÍNH TRƯỚC kết quả Self-Healing cho buổi demo.
//
// Vì sao: khi Google quá tải, gói miễn phí có thể mất 5-20 giây mới trả lời. Trong sản phẩm thật,
// cảnh báo Self-Healing cũng được tạo NỀN khi hệ thống phát hiện điểm nghẽn (app chỉ đọc danh sách
// cảnh báo có sẵn), nên tính trước là đúng luồng sản phẩm.
//
// Script gọi AI với thời gian chờ dài, chỉ lưu khi kết quả đạt yêu cầu, cho 2 chiến dịch:
//   marketing -> samples/demo_self_healing_live.json
//                Kịch bản thuyết trình (KPI 20 CV/tuần, thực tế 2). Gồm result, alert (kiểu app nhánh main),
//                backendAlert ({ severity, content }). Backend seed CHƯA có chiến dịch này.
//   senior    -> samples/backend_alert_senior.json
//                Chiến dịch senior-frontend-engineer CÓ SẴN trong seed backend: { campaignId, severity, content }
//                chèn thẳng vào bảng bottleneck_alerts; phương án đã có `patch` khớp đúng số AI ghi.
//
// Cách dùng:  npm run precompute                       (cả 2 chiến dịch, gọi AI)
//             npm run precompute -- --only senior      (1 chiến dịch: marketing | senior)
//             npm run precompute -- --rebuild          (không gọi AI: dựng lại phần alert từ kết quả đã lưu)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { requireKey, sampleJson, ROOT } from './env.js';
import { diagnoseCampaign } from '../lib/agents.js';
import { toBottleneckAlert } from '../lib/mappers.js';
import { alertFromDiagnosis, campaignInputFromBackend, patchFromFix, fixKind } from '../lib/backend.js';

const MAX_TRIES = 6;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const marketing = sampleJson('campaign_marketing.json');
const senior = sampleJson('backend_campaign_senior.json');
const allText = (d) => [d.proposed_action, ...d.suggested_fixes.map((f) => `${f.action_label} ${f.description}`)].join(' ');

const TARGETS = {
  marketing: {
    out: join(ROOT, 'samples', 'demo_self_healing_live.json'),
    input: () => marketing,
    checks: {
      'status = bottleneck': (d) => d.status === 'bottleneck',
      'chẩn đoán nhắc tới lương và kinh nghiệm': (d) => /lương/i.test(d.diagnosis) && /kinh nghiệm/i.test(d.diagnosis),
      'giảm kinh nghiệm xuống 1 năm, đứng trước "HOẶC"': (d) =>
        /HOẶC/.test(d.proposed_action) && /1 năm/.test(d.proposed_action.split('HOẶC')[0]),
      'tăng lương lên 12 triệu': (d) => /12 triệu/.test(d.proposed_action),
      'đúng 1 phương án khuyến nghị': (d) => d.suggested_fixes.filter((f) => f.recommended).length === 1,
      'JD mới không còn "3 năm kinh nghiệm"': (d) => d.updated_jd_draft && !/3 năm kinh nghiệm/i.test(d.updated_jd_draft),
    },
    build(result) {
      const c = marketing;
      const percent = Math.round((c.actual_cv_per_week / c.kpi_cv_per_week) * 100);
      const backend = alertFromDiagnosis(result, {
        campaignName: { en: 'Marketing Executive', vi: c.title },
        title: {
          en: `CV intake is at ${percent}% of KPI (${c.actual_cv_per_week}/${c.kpi_cv_per_week} CVs per week)`,
          vi: `Lượng CV chỉ đạt ${percent}% KPI (${c.actual_cv_per_week}/${c.kpi_cv_per_week} CV/tuần)`,
        },
        metric: { label: { en: 'CVs per week vs KPI', vi: 'Số CV/tuần so với KPI' }, current: Math.min(percent, 100), target: 100 },
        idPrefix: 'demo',
      });
      return {
        alert: toBottleneckAlert({ id: 'alert_marketing_demo', result, campaign: c }),
        backendAlert: { severity: backend.severity, content: backend.content },
      };
    },
  },
  senior: {
    out: join(ROOT, 'samples', 'backend_alert_senior.json'),
    input: () => campaignInputFromBackend(senior),
    checks: {
      'status = bottleneck': (d) => d.status === 'bottleneck',
      'đúng 1 phương án khuyến nghị': (d) => d.suggested_fixes.filter((f) => f.recommended).length === 1,
      'không hạ kinh nghiệm xuống 1-2 năm cho vị trí senior': (d) => !/\b[12] năm/.test(allText(d)),
      'tăng lương tối đa 20% (≤ 132 nghìn USD/năm)': (d) =>
        [...allText(d).matchAll(/(\d+(?:[.,]\d+)?)\s*(?:nghìn|k)\b/gi)].every((m) => Number(m[1].replace(',', '.')) <= 132),
      'phương án kinh nghiệm/lương nào cũng dựng được patch (để nút Duyệt sửa được setup)': (d) =>
        d.suggested_fixes
          .filter((f) => ['experience', 'salary'].includes(fixKind(f)))
          .every((f) => patchFromFix(f, senior.setup)),
    },
    build(result) {
      const alert = alertFromDiagnosis(result, {
        campaignName: senior.title,
        matchRate: senior.matchRate,
        targetMatchRate: senior.targetMatchRate,
        idPrefix: 'ai',
        enrichFix: (f) => {
          const patch = patchFromFix(f, senior.setup);
          return patch ? { patch } : undefined;
        },
      });
      return {
        campaignId: senior.campaignId,
        note: 'Trước khi insert: expectedLift của mỗi fix có patch = matchRateLift(setup, fix.patch) (src/services/digitalTwin.ts). Xem ai/docs/backend-integration.md mục 5.3.',
        severity: alert.severity,
        content: alert.content,
      };
    },
  },
};

const onlyIdx = process.argv.indexOf('--only');
const names = onlyIdx > 0 ? [process.argv[onlyIdx + 1]] : Object.keys(TARGETS);
for (const n of names) if (!TARGETS[n]) throw new Error(`Không có chiến dịch "${n}". Chọn: ${Object.keys(TARGETS).join(', ')}`);

if (process.argv.includes('--rebuild')) {
  for (const n of names) {
    const t = TARGETS[n];
    if (!existsSync(t.out)) { console.log(`[${n}] chưa có ${t.out}, bỏ qua.`); continue; }
    const saved = JSON.parse(readFileSync(t.out, 'utf8'));
    writeFileSync(t.out, `${JSON.stringify({ generatedAt: saved.generatedAt, model: saved.model, result: saved.result, ...t.build(saved.result) }, null, 2)}\n`);
    console.log(`[${n}] Đã dựng lại phần alert trong ${t.out} (không gọi AI).`);
  }
  process.exit(0);
}

requireKey();
let failedTargets = 0;
for (const n of names) {
  const t = TARGETS[n];
  console.log(`\n=== ${n} ===`);
  let done = false;
  for (let i = 1; i <= MAX_TRIES && !done; i += 1) {
    process.stdout.write(`Lần ${i}/${MAX_TRIES}: `);
    try {
      const { data, meta } = await diagnoseCampaign({ campaign: t.input() }, { timeoutMs: 60000 });
      const failed = Object.entries(t.checks).filter(([, fn]) => !fn(data)).map(([label]) => label);
      if (failed.length) {
        console.log(`AI trả lời (${meta.latencyMs}ms) nhưng chưa đạt: ${failed.join('; ')}. Thử lại...`);
        continue;
      }
      const record = { generatedAt: new Date().toISOString(), model: meta.model, result: data, ...t.build(data) };
      writeFileSync(t.out, `${JSON.stringify(record, null, 2)}\n`);
      console.log(`OK (${meta.latencyMs}ms, ${meta.model})`);
      console.log(`diagnosis:       ${data.diagnosis}`);
      console.log(`proposed_action: ${data.proposed_action}`);
      console.log(`Đã lưu: ${t.out}`);
      done = true;
    } catch (err) {
      console.log(`Google chưa trả lời được (${err.message.slice(0, 120)}). Đợi 20 giây rồi thử lại...`);
      await sleep(20000);
    }
  }
  if (!done) {
    failedTargets += 1;
    console.log(`[${n}] Chưa lấy được kết quả đạt yêu cầu. Đợi 15 phút rồi chạy lại: npm run precompute -- --only ${n}`);
  }
}
process.exit(failedTargets ? 1 : 0);

// Chạy Self-Healing nhiều lần với ĐÚNG cấu hình lúc demo trên sân khấu
// (tổng 4,5 giây, model chính tối đa 3,2 giây rồi chuyển model dự phòng).
// Lần nào không kịp -> trên sân khấu sẽ hiện kết quả soạn sẵn (samples/demo_self_healing_fallback.json).
// Cách dùng:  npm run demo            (5 lần)
//             npm run demo -- 10      (10 lần)
import { requireKey, sampleJson } from './env.js';
import { diagnoseCampaign } from '../lib/agents.js';

requireKey();
const runs = Number(process.argv[2]) || 5;
const campaign = sampleJson('campaign_marketing.json');
const latencies = [];
let switched = 0;
let failed = 0;

for (let i = 1; i <= runs; i += 1) {
  try {
    const { data, meta } = await diagnoseCampaign({ campaign });
    latencies.push(meta.latencyMs);
    if (meta.warnings.length) switched += 1;
    console.log(`\n--- Lần ${i}: ${meta.latencyMs}ms | model ${meta.model} | token vào ${meta.usage.input}, ra ${meta.usage.output}`);
    for (const w of meta.warnings) console.log(`    ! ${w}`);
    if (i === 1) console.log(JSON.stringify(data, null, 2));
    else console.log(`diagnosis: ${data.diagnosis}\nproposed_action: ${data.proposed_action}`);
  } catch (err) {
    failed += 1;
    console.log(`\n--- Lần ${i}: KHÔNG KỊP -> trên sân khấu sẽ hiện kết quả dự phòng. (${err.message})`);
  }
}

console.log('\n================ TỔNG KẾT ================');
if (latencies.length) {
  const max = Math.max(...latencies);
  const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  console.log(`Độ trễ: trung bình ${avg}ms, chậm nhất ${max}ms`);
}
console.log(`AI trả lời kịp: ${runs - failed}/${runs} lần | phải chuyển model dự phòng: ${switched} lần | dùng kết quả soạn sẵn: ${failed} lần`);
console.log(
  failed === 0
    ? 'ĐẠT: mọi lần đều dưới 4,5 giây.'
    : 'CHƯA ỔN ĐỊNH: có lần không kịp -> thử mạng khác, rút ngắn prompt, hoặc đặt model ổn định hơn lên đầu GEMINI_MODEL_FAST.',
);

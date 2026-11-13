# Nối AI vào backend (dành cho Thành viên 3)

Tài liệu này dựa trên nhánh `feature/backend-supabase` (Next.js 16 + Supabase) tại commit `0640c1b`.
Thư mục `ai/` nằm ở nhánh `feature/ai-prompts` (tách từ `main`). Khi 2 nhánh được gộp, backend dùng được `ai/` ngay.

## 1. Import thẳng, không cần viết lại

`backend/next.config.ts` đặt `turbopack.root` và `outputFileTracingRoot` là **gốc repo**, giống cách backend đang import `../src` qua alias `@app/*`. Vì vậy `ai/` (cũng nằm ở gốc repo) import được trực tiếp.

1. `backend/tsconfig.json` → `compilerOptions.paths`: thêm `"@ai/*": ["../ai/*"]`.
   `allowJs: true` đã bật sẵn; kết quả có kiểu `any`, nên kiểm tra bằng zod ở chỗ nhận kết quả nếu cần.
2. `backend/vitest.config.mts` → `resolve.alias`: thêm `'@ai': path.resolve(__dirname, '../ai')`.
3. Chỉ import `@ai/...` trong code **server** (`backend/src/**`), không import trong app Expo (`src/`), để API Key không lọt ra client.
4. Vercel: giữ "Include files outside the root directory" (đã bật cho `../src`).

## 2. Biến môi trường

Thêm khối sau vào `backend/.env.example` và `.env.local` / Vercel:

```
# --- Gemini (AI agents) ---
GEMINI_API_KEY=
# Tuỳ chọn: chuỗi model dự phòng, cách nhau dấu phẩy (mặc định đã hợp lý)
# GEMINI_MODEL_FAST=gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-2.5-flash-lite
# GEMINI_MODEL_SMART=gemini-3.8-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-2.5-flash-lite
```

`ai/lib/gemini.js` đọc thẳng `process.env`, không cần sửa `backend/src/lib/env.ts`. Không có key → các hàm ném lỗi rõ ràng (`Thiếu GEMINI_API_KEY`).

## 3. Các hàm dùng được

| Hàm (`@ai/lib/agents.js`) | Đầu vào | Thời gian | Agent tương ứng trong app |
|---|---|---|---|
| `extractCv({ cvText })` hoặc `({ pdfBase64 })` | CV thô | 2–6 s | `sourcing` |
| `scoreCv({ jdText, cvText })` | JD + CV dạng chữ | 2–12 s | `matching` |
| `diagnoseCampaign({ campaign }, { fallback? })` | xem mục 5 | ≤ 4,5 s, nếu không kịp thì trả `fallback` | `selfHealing` |
| `routeRequest({ request })` | câu HR gõ | 1–5 s | `orchestrator` |

Mỗi hàm trả `{ data, meta }`; `meta.model` là model thực sự đã trả lời, `meta.warnings` ghi các lần chuyển model dự phòng.
Lưu ý: route của backend chạy tối đa 60 s (`vercel.json`), và app đặt `WRITE_TIMEOUT_MS = 10000` trong `src/lib/api.ts`, nên với API gọi AI cần truyền `timeoutMs` lớn hơn (vd 30000) hoặc chạy nền bằng `runInBackground`.

Bộ chuyển đổi dữ liệu nằm trong `@ai/lib/backend.js` (có test trong `ai/tests/offline.test.js`):

| Hàm | Dùng để |
|---|---|
| `campaignInputFromBackend({ title, matchRate, targetMatchRate, applicants, setup, channelResults, createdAt })` | dòng `campaigns` + `setup` + `campaign_channel_results` → đầu vào `diagnoseCampaign` |
| `alertFromDiagnosis(result, { campaignName, matchRate, targetMatchRate, enrichFix })` | kết quả AI → `{ severity, content }` cho bảng `bottleneck_alerts` (đúng kiểu `AlertContent`) |
| `candidateRowsFromAi(profile, match)` | kết quả `extractCv` + `scoreCv` → dữ liệu chèn vào `candidates` và `applications` (email sai định dạng → `null`, đúng CHECK của bảng) |
| `patchFromFix(fix, setup)` | đọc **chính con số AI ghi** trong phương án → `Partial<CampaignDraft>` (`minExperience`, `salaryMin`/`salaryMax` nghìn USD/năm); không chắc → `undefined` |
| `fixKind(fix)` | phân loại phương án: `experience` / `salary` / `channels` / `skills` / `other` |
| `toLocalized(text)` | chuỗi → `{ en, vi }` |

## 4. Những điểm backend hiện chưa có (cần chú ý)

- **Mọi giá trị "AI" hiện là dữ liệu seed.** `match_score`, `ai_assessment`, `match_rate`, cảnh báo Self-Healing đều được `backend/scripts/seed-demo.ts` chép từ mock. Chưa có code nào tính chúng.
- **Ghi bằng `supabaseAdmin()`.** Thành viên không được ghi các cột do agent sở hữu (`20261111120000_column_privileges.sql`). Kiểm tra quyền bằng `requireWorkspace` trước, rồi ghi bằng `supabaseAdmin()` (giống `launchCampaign` trong `backend/src/lib/data/campaigns.ts`).
- **Chữ hai ngôn ngữ.** Cột `ai_assessment` và `bottleneck_alerts.content` lưu `Localized = { en, vi }`. Gemini chỉ trả tiếng Việt, nên `toLocalized` chép cùng một câu cho cả `en` và `vi`. Muốn có tiếng Anh thật thì phải gọi thêm một lượt dịch.
- **Chưa có cột cho dữ liệu chi tiết.** Các trường `match_reasons`, `missing_skills`, `score_breakdown`, số điện thoại, kinh nghiệm/học vấn chi tiết chưa có cột. Nếu cần hiển thị, thêm migration, ví dụ `applications.ai_details jsonb` và `candidates.profile jsonb`.
- **Chưa có JD dạng chữ.** `CampaignDraft` chỉ có `skills` và `minExperience`. Muốn chấm điểm, dựng JD từ setup, ví dụ: `"Vị trí ${title}, ${seniority}. Yêu cầu ${minExperience} năm. Kỹ năng: ${skills.join(', ')}. Lương ${salaryMin}-${salaryMax} nghìn USD/năm."`
- **Phương án sửa cần `patch` và `expectedLift`.** AI chỉ trả lời bằng chữ. Để nút "Duyệt" sửa được `setup` và thẻ không hiện "+0%", truyền `enrichFix` vào `alertFromDiagnosis`:

  ```js
  import { matchRateLift } from '@app/services/digitalTwin';
  enrichFix: (fix) => {
    const patch = patchFromFix(fix, setup);
    return patch ? { patch, expectedLift: matchRateLift(setup, patch) } : undefined;
  }
  ```

  **Đừng** lấy patch từ `suggestForecastFixes` của Digital Twin. Số của nó (vd lương 130–155) khác số AI ghi trên thẻ (vd 110–130), nên HR duyệt sẽ bị áp con số khác với con số đã thấy. `approveFix` kiểm tra lại `{ ...setup, ...patch }` bằng `campaignDraftSchema`.
- **App chỉ đọc cảnh báo lúc bootstrap.** Realtime chỉ phát `agent_event` và `action_updated`, không phát dòng cảnh báo. Bootstrap được nhớ trong app cho tới khi đăng nhập lại (`resetBootstrap`). Vì vậy cảnh báo mới chỉ hiện sau khi tải lại hẳn app hoặc đăng nhập lại. Vẫn nên ghi sự kiện `bottleneckFlagged` (actor `selfHealing`, kèm `issue: Localized`) để dòng hoạt động trên trang Agents hiện ngay.

## 5. Gợi ý 3 API

Theo đúng mẫu `route()` + `requireWorkspace` + zod trong `backend/src/lib/data/schemas.ts`.

### 5.1 Nhận CV mới → trích xuất + chấm điểm
`POST /api/campaigns/[campaignId]/candidates`, body `{ cvText, channel }`:

1. Đọc `campaigns.setup` và dựng JD (mục 4).
2. `extractCv({ cvText })`. Nếu `!data.is_cv` thì trả 422.
3. `scoreCv({ jdText, cvText })`.
4. `candidateRowsFromAi(profile, match)`, rồi insert `candidates` và `applications` (thêm `workspace_id`, `campaign_id`, `candidate_id`) bằng `supabaseAdmin()`.
5. `recordAgentEvents(ws, [{ kind: 'cvsImported', actor: 'sourcing', count: 1, channel, campaignId }, { kind: 'cvsScored', actor: 'matching', count: 1, campaignId }])`.

### 5.2 Chẩn đoán chiến dịch → tạo cảnh báo Self-Healing
`POST /api/self-healing/campaigns/[campaignId]/diagnose`:

1. Bỏ qua nếu `match_rate >= target_match_rate`, nếu chiến dịch đã có cảnh báo `open`, hoặc nếu agent `selfHealing` đang tạm dừng (`agent_settings.paused`).
2. `diagnoseCampaign({ campaign: campaignInputFromBackend({...}) }, { timeoutMs: 30000 })`. Chạy nền thì không cần giới hạn 4,5 s.
3. `alertFromDiagnosis(data, {...})`. Nếu ra `null` (AI kết luận không nghẽn) thì không tạo gì.
4. Insert `bottleneck_alerts { workspace_id, campaign_id, severity, content }` bằng `supabaseAdmin()`, rồi ghi sự kiện `bottleneckFlagged`.
5. Có thể cho cron `/api/operations/run` gọi việc này mỗi ngày cho mọi chiến dịch dưới mục tiêu.

### 5.3 Cho buổi demo trên sân khấu
Không chờ AI lúc bấm. Chạy trước `cd ai && npm run precompute`. Lệnh này lưu sẵn câu trả lời thật của AI cho 2 chiến dịch:

| File | Chiến dịch | Dùng khi |
|---|---|---|
| `ai/samples/backend_alert_senior.json` | `senior-frontend-engineer`, **có sẵn trong seed** | Chèn thẳng vào backend hiện tại. Đã có `campaignId`, `severity`, `content`, và `patch` khớp số trên thẻ |
| `ai/samples/demo_self_healing_live.json` (`backendAlert`) | "Chuyên viên Marketing" theo kịch bản thuyết trình (2/20 CV/tuần) | Chỉ dùng được nếu seed thêm một chiến dịch Marketing. Seed hiện không có chiến dịch này, và `DepartmentKey` cũng không có `marketing` |

Chèn cảnh báo senior trong `backend/scripts/seed-demo.ts`, thay cho cảnh báo mock của chiến dịch đó:

```ts
import senior from '../../ai/samples/backend_alert_senior.json';
import { matchRateLift } from '../../src/services/digitalTwin';

const content = {
  ...senior.content,
  suggestedFixes: senior.content.suggestedFixes.map((f) =>
    f.patch ? { ...f, expectedLift: matchRateLift(setup, f.patch) } : f), // setup = campaigns.setup của chiến dịch đó
};
await admin.from('bottleneck_alerts').insert({ workspace_id, campaign_id: senior.campaignId, severity: senior.severity, content });
```

Muốn dùng đúng kịch bản Marketing trên app thật: thêm chiến dịch Marketing (kèm `setup`) vào seed, rồi chèn `backendAlert` với `campaign_id` của chiến dịch đó. Lưu ý chỉ số của cảnh báo này là "Số CV/tuần so với KPI", trong khi thẻ trong app mặc định ghi "+x% tỷ lệ phù hợp".

## 6. Kiểm thử

- **Không cần mạng.** `ai/lib/gemini.js` nhận `opts.fetch`. Có thể dùng mẫu `vi.stubGlobal('fetch', …)` như `backend/tests/google-live.test.ts`, hoặc truyền `{ generate: async () => ({ data, usage: {}, latencyMs: 1, model: 'fake' }) }` vào các hàm trong `agents.js`.
- **Bộ test của AI:** `cd ai && npm test` (53 ca, không cần key) và `npm run test:live` (gọi Gemini thật).

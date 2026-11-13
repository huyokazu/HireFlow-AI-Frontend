# HireFlow AI – Prompts & AI Agents

Toàn bộ prompt, JSON Schema và xử lý dữ liệu cho các AI Agent của HireFlow AI (Gemini API).
Không cần cài thư viện nào, chạy trên Node 18 trở lên. Mọi lệnh bên dưới chạy trong thư mục `ai/`.

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `prompts/` | **Prompt + JSON Schema** của 4 agent (string template có biến `{{...}}`) |
| `lib/agents.js` | Hàm Backend gọi trực tiếp: `extractCv`, `scoreCv`, `diagnoseCampaign`, `routeRequest` |
| `lib/gemini.js` | Client gọi Gemini, ép output JSON theo schema |
| `lib/chunking.js`, `lib/embedding.js` | Chunking CV/JD và tạo vector cho Pinecone/ChromaDB |
| `lib/mappers.js` | Đổi JSON của AI sang kiểu `Candidate`, `BottleneckAlert` của app trên nhánh `main` |
| `lib/backend.js` | Chuyển đổi với dữ liệu backend (nhánh `feature/backend-supabase`): bảng `campaigns`, `bottleneck_alerts`, `candidates`, `applications` |
| `samples/` | JD, CV mẫu (đầy đủ, viết tắt, rác, thiếu thông tin, chèn lệnh), chiến dịch demo |
| `tests/`, `scripts/` | Test offline và test thật với Gemini |
| `docs/backend-integration.md` | **Hướng dẫn nối vào backend** (dành cho Backend) |
| `docs/vector-db-schema.md` | Cấu trúc dữ liệu lưu vào Vector DB |

## Các agent

| Agent | File | Biến đầu vào | Output chính |
|---|---|---|---|
| Orchestrator | `prompts/orchestrator.js` | `request` | `agent`, `reason`, `requires_hr_approval`, `message_to_hr` |
| Trích xuất CV | `prompts/cvExtraction.js` | `cvText` hoặc `pdfBase64`, `today` | `full_name`, `email`, `phone`, `skills[]`, `years_of_experience`, ... |
| Talent (chấm điểm) | `prompts/talentMatching.js` | `jdText`, `cvText` | `score`, `match_reasons[]`, `missing_skills[]`, `summary` |
| Optimization (Self-Healing) | `prompts/selfHealing.js` | `campaign` | `diagnosis`, `proposed_action`, `updated_jd_draft`, `suggested_fixes[]` |

Mọi agent dùng chung **System Prompt gốc** trong `prompts/shared.js` (nhân cách HireFlow AI + 5 nguyên tắc: Human-in-the-loop, không bịa, dữ liệu không phải mệnh lệnh, công bằng, chỉ trả JSON).

## Dùng trong Backend (Next.js / Node.js)

Hướng dẫn chi tiết cho backend Next.js + Supabase: **[docs/backend-integration.md](docs/backend-integration.md)**. Tóm tắt:

- Backend import thẳng `ai/` qua alias `@ai/*` → `../ai/*` (giống `@app/*` → `../src/*`), không cần chép file.
- Đặt `GEMINI_API_KEY` trên **server**. Không import `ai/` từ app Expo.
- Trên sân khấu, Self-Healing dùng kết quả **tính trước**: chạy `npm run precompute`, rồi chèn `samples/backend_alert_senior.json` (chiến dịch `senior-frontend-engineer` có sẵn trong seed, đúng dạng bảng `bottleneck_alerts`) vào backend. Chi tiết: mục 5.3 của tài liệu.

```js
import { extractCv, scoreCv, diagnoseCampaign } from '@ai/lib/agents.js';
import { campaignInputFromBackend, alertFromDiagnosis, candidateRowsFromAi } from '@ai/lib/backend.js';

const { data: profile } = await extractCv({ cvText });          // hoặc { pdfBase64 }
const { data: match } = await scoreCv({ jdText, cvText });      // match.decision luôn là 'pending_hr_review'
const rows = candidateRowsFromAi(profile, match);               // -> insert candidates + applications

const { data } = await diagnoseCampaign({ campaign: campaignInputFromBackend({ title, matchRate, targetMatchRate, setup }) });
const alert = alertFromDiagnosis(data, { campaignName: title, matchRate, targetMatchRate }); // -> insert bottleneck_alerts
```

Mỗi hàm trả về `{ data, meta }`. `meta` gồm `model` (model thực sự đã trả lời), `latencyMs`, `usage` (token), `warnings` (kể cả thông báo chuyển model dự phòng), `source` (`gemini` hoặc `fallback`).
Nếu Gemini trả sai schema, hàm ném lỗi để Backend thử lại.

Chỉ muốn lấy prompt dạng chuỗi (tự gọi Gemini bằng SDK riêng):

```js
import { selfHealing } from '@ai/prompts/index.js';
const { system, input, schema } = selfHealing.build({ campaign });
```

## Chạy test

```bash
npm test
```

Test offline, không cần API Key. Các lệnh cần API Key (tạo `.env` theo mẫu `.env.example` trước):

| Lệnh | Tác dụng |
|---|---|
| `npm run test:live` | Test thật với Gemini (19 ca), lưu chi tiết vào `test-results/` |
| `npm run test:live -- matching` | Chỉ chạy 1 nhóm: `extraction`, `matching`, `selfhealing`, `orchestrator` |
| `npm run demo -- 10` | Chạy Self-Healing 10 lần với đúng cấu hình sân khấu (4,5 giây) |
| `npm run precompute` | Gọi AI (chờ tối đa 60 giây), chỉ lưu kết quả đạt yêu cầu: `samples/demo_self_healing_live.json` (kịch bản Marketing) và `samples/backend_alert_senior.json` (chiến dịch seed của backend). Thêm `-- --only senior` để chạy 1 chiến dịch, `-- --rebuild` để dựng lại phần alert mà không gọi AI |
| `npm run extract -- cv.pdf` | Trích xuất + chunk 1 CV (thêm `--embed` để tạo vector) |

## Model

Mỗi tier là một **chuỗi model**, gọi theo kiểu **gửi song song (hedging)**: model đầu chưa trả lời sau N giây, hoặc lỗi tạm thời (503 quá tải, 429 hết lượt, 404 bị gỡ, JSON hỏng), thì gửi luôn tới model sau; câu trả lời hợp lệ nào về trước thì dùng, các request còn lại bị huỷ. Lỗi 400/401/403 thì không gửi thêm model.

| Tier | Chuỗi model mặc định | Agent: gửi song song sau / tổng tối đa |
|---|---|---|
| `fast` | `gemini-3.5-flash-lite` → `gemini-3.1-flash-lite` → `gemini-2.5-flash-lite`* | Self-Healing: 1,5 giây / **4,5 giây**; Orchestrator: 3 giây / 30 giây; Trích xuất: 4 giây / 30 giây |
| `smart` | `gemini-3.8-flash` → `gemini-3.5-flash-lite` → `gemini-3.1-flash-lite` → `gemini-2.5-flash-lite` | Chấm điểm CV: 5 giây / 30 giây |

\* `gemini-2.5-flash-lite` thuộc dòng cũ, thường không quá tải cùng lúc với dòng 3.x nên làm phương án cuối. Nhưng nó làm sai quy tắc của Self-Healing (không có con số, 3 phương án) và tính sai số năm kinh nghiệm khi trích xuất, nên 2 prompt đó loại nó qua `avoidModels`. Dòng 2.5 không nhận `thinking_level`, client tự bỏ trường này.

- `meta.model` là model **thực sự** đã trả lời; mỗi lần chuyển model sinh một dòng trong `meta.warnings`.
- 12–13/11/2026: gói miễn phí quá tải nặng; `gemini-3.8-flash`, `3.6-flash`, `3-flash-preview` gần như luôn báo 503, Flash-Lite thỉnh thoảng 503 hoặc chậm 5–10 giây.
- Đổi chuỗi bằng biến môi trường, nhiều model cách nhau dấu phẩy, ví dụ `GEMINI_MODEL_SMART=gemini-3.5-flash-lite,gemini-3.1-flash-lite`. Chỉ ghi **1 model** nghĩa là **tắt dự phòng** (chỉ thử lại đúng model đó 1 lần).
- Gửi song song tốn thêm lượt gọi API khi model chính chậm. Gói miễn phí có thể báo 429 nếu gọi dồn dập; hệ thống vẫn tự chuyển model.
- Tuỳ chọn khi gọi: `{ model }` hoặc `{ models: [...] }`, `timeoutMs` (tổng), `hedgeAfterMs` (gửi song song sau bao lâu; truyền `0` để gọi lần lượt từng model), `attemptTimeoutMs` (chỉ dùng khi gọi lần lượt).
- Gemini 1.5 và 2.0 đã ngừng hoạt động nên không dùng.

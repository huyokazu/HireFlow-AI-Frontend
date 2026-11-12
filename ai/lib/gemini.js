// Client gọi Gemini API bằng fetch (không cần cài thư viện, chạy được trên Node 18+).
// Mặc định dùng Interactions API (API chính của Gemini hiện nay).
// Đặt GEMINI_API_MODE=generate_content nếu muốn dùng API cũ generateContent.

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const API_REVISION = '2026-05-20';

// Mỗi tier là một CHUỖI model: model đầu bị quá tải (503/429) hoặc treo thì tự chuyển sang model sau.
// (11/2026: gemini-3.8-flash và 3.6-flash thường xuyên báo 503 "high demand"; Flash-Lite ổn định.)
// 13/11/2026: gemini-2.5-flash-lite thuộc dòng cũ nên thường KHÔNG quá tải cùng lúc với dòng 3.x -> phương án cuối.
// Nhưng nó làm sai quy tắc ở Self-Healing và trích xuất, nên 2 prompt đó loại nó ra (xem avoidModels trong prompts/).
const DEFAULT_MODELS = {
  fast: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'], // trích xuất, điều phối, Self-Healing
  smart: ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'], // chấm điểm CV
};

/** Thời gian chờ tối đa cho MỖI lần thử một model, trước khi chuyển sang model dự phòng. */
const DEFAULT_ATTEMPT_TIMEOUT_MS = { fast: 8000, smart: 10000 };

const TRANSIENT_STATUSES = [408, 429, 500, 502, 503, 504];

/**
 * Lấy chuỗi model theo "tier". Ghi đè bằng biến môi trường, nhiều model cách nhau dấu phẩy:
 *   GEMINI_MODEL_SMART=gemini-3.8-flash,gemini-3.5-flash-lite
 */
export function resolveModels(tier = 'fast') {
  const env = tier === 'smart' ? process.env.GEMINI_MODEL_SMART : process.env.GEMINI_MODEL_FAST;
  const list = String(env || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  return list.length ? list : DEFAULT_MODELS[tier === 'smart' ? 'smart' : 'fast'];
}

/** Model chính của một tier (giữ lại cho tương thích). */
export function resolveModel(tier = 'fast') {
  return resolveModels(tier)[0];
}

/**
 * Mỗi model nhận một bộ thinking_level khác nhau:
 * Flash-Lite nhận minimal|low|medium|high; Flash (3.6+/3.8) KHÔNG nhận "minimal" -> đổi thành "low".
 */
export function thinkingLevelFor(model, level) {
  if (!level) return level;
  // Dòng 2.5 dùng 'thinking budget' riêng; gửi thinking_level sẽ bị lỗi 400 -> bỏ hẳn (2.5-flash-lite mặc định không suy nghĩ).
  if (/^gemini-2\./.test(model)) return undefined;
  if (level === 'minimal' && !/flash-lite/.test(model)) return 'low';
  return level;
}

export class GeminiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
    this.body = body;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Đổi input (string hoặc mảng part) về dạng mảng part chuẩn. */
function toParts(input) {
  return typeof input === 'string' ? [{ type: 'text', text: input }] : input;
}

function buildInteractionsRequest({ system, input, schema, model, thinkingLevel, maxOutputTokens, seed }) {
  const generation_config = {};
  if (thinkingLevel) generation_config.thinking_level = thinkingLevel;
  if (maxOutputTokens) generation_config.max_output_tokens = maxOutputTokens;
  if (seed !== undefined) generation_config.seed = seed;
  return {
    url: `${BASE_URL}/interactions`,
    body: {
      model,
      system_instruction: system,
      input,
      generation_config,
      // Ép Gemini trả JSON đúng schema.
      response_format: { type: 'text', mime_type: 'application/json', schema },
      // Không lưu CV (dữ liệu cá nhân) trên máy chủ Google.
      store: false,
    },
  };
}

function parseInteractionsResponse(json) {
  const text = (json.steps || [])
    .filter((s) => s.type === 'model_output')
    .flatMap((s) => s.content || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('');
  const u = json.usage || {};
  return {
    text,
    status: json.status,
    usage: {
      input: u.total_input_tokens ?? null,
      output: u.total_output_tokens ?? null,
      thought: u.total_thought_tokens ?? null,
      total: u.total_tokens ?? null,
    },
  };
}

function buildGenerateContentRequest({ system, input, schema, model, thinkingLevel, maxOutputTokens, seed }) {
  const parts = toParts(input).map((p) =>
    p.type === 'text' ? { text: p.text } : { inlineData: { mimeType: p.mime_type, data: p.data } },
  );
  const generationConfig = { responseMimeType: 'application/json', responseJsonSchema: schema };
  if (maxOutputTokens) generationConfig.maxOutputTokens = maxOutputTokens;
  if (seed !== undefined) generationConfig.seed = seed;
  if (thinkingLevel) generationConfig.thinkingConfig = { thinkingLevel };
  return {
    url: `${BASE_URL}/models/${model}:generateContent`,
    body: {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts }],
      generationConfig,
    },
  };
}

function parseGenerateContentResponse(json) {
  const candidate = (json.candidates || [])[0] || {};
  const text = ((candidate.content || {}).parts || [])
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('');
  const u = json.usageMetadata || {};
  return {
    text,
    status: candidate.finishReason === 'STOP' ? 'completed' : candidate.finishReason,
    usage: {
      input: u.promptTokenCount ?? null,
      output: u.candidatesTokenCount ?? null,
      thought: u.thoughtsTokenCount ?? null,
      total: u.totalTokenCount ?? null,
    },
  };
}

/**
 * Gửi 1 request, có timeout. Lỗi HTTP -> GeminiError có `status`; timeout -> status 408.
 * `cancelSignal` (tuỳ chọn): huỷ request từ bên ngoài, vd khi một model khác đã trả lời trước.
 */
async function postOnce(url, body, apiKey, timeoutMs, fetchImpl, cancelSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const cancel = () => controller.abort();
  if (cancelSignal) {
    if (cancelSignal.aborted) controller.abort();
    else cancelSignal.addEventListener('abort', cancel, { once: true });
  }
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
        'Api-Revision': API_REVISION,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await res.text();
    if (!res.ok) {
      throw new GeminiError(`Gemini trả lỗi HTTP ${res.status}: ${raw.slice(0, 300)}`, { status: res.status, body: raw });
    }
    try {
      return JSON.parse(raw);
    } catch {
      throw new GeminiError(`Gemini trả response không đọc được: ${raw.slice(0, 200)}`, { status: 502, body: raw });
    }
  } catch (err) {
    if (err.name === 'AbortError') throw new GeminiError(`Gemini không phản hồi sau ${timeoutMs}ms (timeout)`, { status: 408 });
    if (err instanceof GeminiError) throw err;
    throw new GeminiError(`Lỗi mạng khi gọi Gemini: ${err.message}`, { status: 503 }); // mất mạng, DNS...
  } finally {
    clearTimeout(timer);
    if (cancelSignal) cancelSignal.removeEventListener('abort', cancel);
  }
}

/** Parse JSON, chịu được trường hợp model bọc trong ```json ... ```. */
export function parseJsonText(text) {
  const cleaned = String(text || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  if (!cleaned) throw new GeminiError('Gemini trả về rỗng');
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new GeminiError(`Gemini trả về không phải JSON hợp lệ: ${cleaned.slice(0, 200)}`);
  }
}

/**
 * Lỗi có nên chuyển sang model/lần thử tiếp theo không.
 * - 408/429/5xx: quá tải, giới hạn tốc độ, treo -> có.
 * - 404: model đã bị gỡ hoặc đổi tên -> có (thử model khác).
 * - Model trả rỗng / JSON hỏng (thường do bị cắt giữa chừng) -> có.
 * - 400/401/403: sai request hoặc sai API Key -> không (đổi model cũng không hết lỗi).
 */
function shouldTryNext(err) {
  if (!(err instanceof GeminiError)) return false;
  if (err.status === undefined) return true; // lỗi nội dung (rỗng / không phải JSON)
  return err.status === 404 || TRANSIENT_STATUSES.includes(err.status);
}

/** Một lần gọi tới đúng một model. */
async function callModel(req, model, { apiKey, legacy, timeoutMs, opts, cancelSignal }) {
  const params = {
    system: req.system,
    input: req.input,
    schema: req.schema,
    model,
    thinkingLevel: thinkingLevelFor(model, opts.thinkingLevel || req.thinkingLevel),
    maxOutputTokens: opts.maxOutputTokens || req.maxOutputTokens,
    seed: opts.seed,
  };
  const { url, body } = legacy ? buildGenerateContentRequest(params) : buildInteractionsRequest(params);
  const json = await postOnce(url, body, apiKey, timeoutMs, opts.fetch || fetch, cancelSignal);
  const { text, status, usage } = legacy ? parseGenerateContentResponse(json) : parseInteractionsResponse(json);
  if (!text) throw new GeminiError(`Gemini không trả nội dung (status: ${status})`);
  return { data: parseJsonText(text), usage };
}

/**
 * Gọi Gemini và nhận về object JSON đúng schema.
 * Model chính lỗi tạm thời (quá tải, treo, hết lượt) thì tự chuyển sang model dự phòng trong cùng tier.
 *
 * @param {object} req  Kết quả của hàm build() trong prompts/*.js
 *   { system, input, schema, modelTier, thinkingLevel, maxOutputTokens }
 * @param {object} [opts]
 *   model           ép dùng đúng 1 model (bỏ chuỗi dự phòng)
 *   models          ép dùng chuỗi model này
 *   timeoutMs       tổng thời gian tối đa cho cả lần gọi, kể cả chuyển model (mặc định 30000)
 *   attemptTimeoutMs thời gian tối đa cho mỗi model trước khi chuyển (mặc định 8000 fast / 10000 smart)
 *   retries         số lần thử lại khi chỉ có 1 model (mặc định 1)
 *   hedgeAfterMs    GỬI SONG SONG: model trước chưa trả lời sau từng này ms thì gửi luôn tới model sau,
 *                   lấy câu trả lời về trước (giảm độ trễ khi Gemini thỉnh thoảng treo; tốn thêm lượt gọi)
 *   apiKey, apiMode, thinkingLevel, maxOutputTokens, seed, fetch
 * @returns {Promise<{ data, usage, latencyMs, model, fallbacks: {model, error}[] }>}
 */
export async function generateJson(req, opts = {}) {
  const apiKey = opts.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiError('Thiếu GEMINI_API_KEY: tạo file .env theo mẫu .env.example');

  const tier = req.modelTier === 'smart' ? 'smart' : 'fast';
  // Prompt có thể loại một số model làm sai quy tắc của nó (req.avoidModels); không bao giờ loại hết.
  const chain = opts.models || resolveModels(tier);
  const allowed = chain.filter((m) => !(req.avoidModels || []).includes(m));
  const models = opts.model ? [opts.model] : allowed.length ? allowed : chain;
  const plan = models.length > 1 ? models : Array(1 + (opts.retries ?? 1)).fill(models[0]);
  const legacy = (opts.apiMode || process.env.GEMINI_API_MODE || 'interactions') === 'generate_content';
  const totalTimeoutMs = opts.timeoutMs ?? 30000;
  const attemptTimeoutMs = opts.attemptTimeoutMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS[tier];

  const started = Date.now();
  if (opts.hedgeAfterMs && new Set(plan).size > 1) {
    return generateHedged(req, plan, { apiKey, legacy, opts, started, totalTimeoutMs, hedgeAfterMs: opts.hedgeAfterMs });
  }
  const fallbacks = [];
  let lastError;
  for (let i = 0; i < plan.length; i += 1) {
    if (i > 0 && plan[i] === plan[i - 1]) {
      // Thử lại cùng model: chờ chút (thời gian chờ cũng tính vào tổng timeoutMs).
      await sleep(Math.min(400 * i, (totalTimeoutMs - (Date.now() - started)) / 4));
    }
    const remaining = totalTimeoutMs - (Date.now() - started);
    if (remaining < 300) break;
    const isLast = i === plan.length - 1;
    const timeoutMs = Math.max(1, Math.floor(isLast ? remaining : Math.min(attemptTimeoutMs, remaining)));
    try {
      const { data, usage } = await callModel(req, plan[i], { apiKey, legacy, timeoutMs, opts });
      return { data, usage, latencyMs: Date.now() - started, model: plan[i], fallbacks };
    } catch (err) {
      lastError = err;
      fallbacks.push({ model: plan[i], error: err.status ? `HTTP ${err.status}` : err.message.slice(0, 80) });
      if (!shouldTryNext(err)) throw err;
    }
  }
  throw allFailedError(totalTimeoutMs, fallbacks, lastError);
}

function allFailedError(totalTimeoutMs, fallbacks, lastError) {
  const tried = fallbacks.map((f) => `${f.model} (${f.error})`).join(', ');
  const error = new GeminiError(
    `Không model nào trả lời được trong ${totalTimeoutMs}ms. Đã thử: ${tried || 'không kịp thử'}. Lỗi cuối: ${lastError?.message ?? 'hết thời gian'}`,
    { status: lastError?.status ?? 408 },
  );
  error.fallbacks = fallbacks;
  return error;
}

/**
 * Chế độ gửi song song (hedging): gửi model 1; sau `hedgeAfterMs` mà chưa có kết quả, hoặc model 1 lỗi,
 * thì gửi tiếp model 2 (vẫn giữ model 1 chạy)... Lấy câu trả lời ĐẦU TIÊN hợp lệ, huỷ các request còn lại.
 */
function generateHedged(req, plan, { apiKey, legacy, opts, started, totalTimeoutMs, hedgeAfterMs }) {
  return new Promise((resolve, reject) => {
    const cancelAll = new AbortController();
    const failures = []; // { idx, model, error } - các request đã lỗi
    const inFlight = new Map(); // idx -> model, các request đang chạy
    let next = 0;
    let done = false;
    let lastError;
    let fatalError; // lỗi 400/401/403: không gửi thêm model, nhưng vẫn chờ request đang chạy
    let hedgeTimer;

    const describe = (err) => (err.status ? `HTTP ${err.status}` : err.message.slice(0, 80));
    const finish = (settle) => {
      if (done) return;
      done = true;
      clearTimeout(hedgeTimer);
      clearTimeout(deadlineTimer);
      cancelAll.abort(); // huỷ các request còn đang chạy
      settle();
    };
    /** Danh sách đã thử, theo đúng thứ tự gửi; request còn chạy lúc kết thúc ghi là `stillRunning`. */
    const tried = (beforeIdx, stillRunning) => {
      const list = failures.map((f) => ({ idx: f.idx, model: f.model, error: f.error }));
      for (const [idx, model] of inFlight) list.push({ idx, model, error: stillRunning });
      return list
        .filter((f) => f.idx < beforeIdx)
        .sort((x, y) => x.idx - y.idx)
        .map(({ model, error }) => ({ model, error }));
    };
    const rejectAll = () => {
      const fallbacks = tried(Infinity, `HTTP 408 (quá ${totalTimeoutMs}ms)`);
      finish(() => reject(fatalError || allFailedError(totalTimeoutMs, fallbacks, lastError)));
    };
    const settleIfIdle = () => {
      if (inFlight.size === 0 && (fatalError || next >= plan.length)) rejectAll();
    };
    const launch = () => {
      clearTimeout(hedgeTimer);
      if (done || fatalError || next >= plan.length) return;
      const remaining = totalTimeoutMs - (Date.now() - started);
      if (remaining < 300) return; // không đủ thời gian; deadlineTimer sẽ kết thúc
      const idx = next;
      const model = plan[idx];
      next += 1;
      inFlight.set(idx, model);
      if (next < plan.length) hedgeTimer = setTimeout(launch, hedgeAfterMs);
      callModel(req, model, { apiKey, legacy, timeoutMs: Math.floor(remaining), opts, cancelSignal: cancelAll.signal }).then(
        ({ data, usage }) => {
          if (done) return;
          // Chỉ báo các model đứng TRƯỚC model thắng (model sau chỉ là gửi song song, không phải "chuyển").
          const fallbacks = tried(idx, `chưa trả lời sau ${hedgeAfterMs}ms`);
          inFlight.delete(idx);
          finish(() => resolve({ data, usage, latencyMs: Date.now() - started, model, fallbacks }));
        },
        (err) => {
          inFlight.delete(idx);
          if (done) return;
          lastError = err;
          failures.push({ idx, model, error: describe(err) });
          if (!shouldTryNext(err)) fatalError = fatalError || err;
          else if (next < plan.length) launch(); // lỗi sớm -> gửi model sau ngay, không chờ hết hedgeAfterMs
          settleIfIdle();
        },
      );
    };
    const deadlineTimer = setTimeout(rejectAll, Math.max(0, totalTimeoutMs - (Date.now() - started)));
    launch();
  });
}

// Xuất ra để test offline kiểm tra định dạng request.
export const _internal = { buildInteractionsRequest, buildGenerateContentRequest, parseInteractionsResponse, parseGenerateContentResponse, shouldTryNext };

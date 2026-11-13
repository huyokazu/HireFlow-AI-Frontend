// Tạo vector (embedding) cho các chunk và đóng gói thành bản ghi Pinecone / ChromaDB.
import { GeminiError } from './gemini.js';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
export const EMBEDDING_MODEL = 'gemini-embedding-2';
export const EMBEDDING_DIMENSION = 768; // phải khớp với dimension khi tạo index Pinecone

/**
 * gemini-embedding-2 không dùng task_type; thay vào đó thêm tiền tố vào text.
 * - Tài liệu (CV/JD lưu vào DB): "title: ... | text: ..."
 * - Câu truy vấn (lúc tìm kiếm):  "task: search result | query: ..."
 */
export function withTaskPrefix(text, kind = 'document', title = 'none') {
  return kind === 'query' ? `task: search result | query: ${text}` : `title: ${title} | text: ${text}`;
}

/**
 * @param {string[]} texts
 * @param {{ kind?: 'document' | 'query', title?: string, apiKey?: string, dimension?: number }} [opts]
 * @returns {Promise<number[][]>}
 */
export async function embedTexts(texts, opts = {}) {
  const apiKey = opts.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiError('Thiếu GEMINI_API_KEY: tạo file .env theo mẫu .env.example');
  const model = process.env.GEMINI_EMBEDDING_MODEL || EMBEDDING_MODEL;
  const res = await fetch(`${BASE_URL}/models/${model}:batchEmbedContents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${model}`,
        content: { parts: [{ text: withTaskPrefix(text, opts.kind, opts.title) }] },
        output_dimensionality: opts.dimension || EMBEDDING_DIMENSION,
      })),
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new GeminiError(`Embedding lỗi HTTP ${res.status}: ${raw.slice(0, 500)}`, { status: res.status, body: raw });
  return JSON.parse(raw).embeddings.map((e) => e.values);
}

/** -> bản ghi cho Pinecone: index.upsert(records) */
export function toPineconeRecords(chunks, vectors) {
  return chunks.map((chunk, i) => ({ id: chunk.id, values: vectors[i], metadata: chunk.metadata }));
}

/** -> tham số cho ChromaDB: collection.add(batch). Chroma chỉ nhận metadata dạng đơn, nên mảng được nối bằng dấu phẩy. */
export function toChromaBatch(chunks, vectors) {
  return {
    ids: chunks.map((c) => c.id),
    embeddings: vectors,
    documents: chunks.map((c) => c.text),
    metadatas: chunks.map(({ metadata }) => {
      const { text, ...rest } = metadata;
      return Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v]));
    }),
  };
}

// Thử trích xuất + chunking trên 1 file CV thật (.pdf hoặc .txt).
// Cách dùng:  npm run extract -- duong/dan/cv.pdf
//             npm run extract -- duong/dan/cv.pdf --embed    (tạo luôn vector để thử)
import { readFileSync } from 'node:fs';
import { requireKey } from './env.js';
import { extractCv } from '../lib/agents.js';
import { chunkCvProfile, chunkCvText } from '../lib/chunking.js';
import { embedTexts, toPineconeRecords } from '../lib/embedding.js';

const file = process.argv[2];
if (!file) {
  console.error('Thiếu đường dẫn file. Ví dụ: npm run extract -- samples/cv_good.txt');
  process.exit(1);
}
requireKey();

const isPdf = file.toLowerCase().endsWith('.pdf');
const vars = isPdf ? { pdfBase64: readFileSync(file).toString('base64') } : { cvText: readFileSync(file, 'utf8') };

const { data: profile, meta } = await extractCv(vars);
console.log(`\n=== HỒ SƠ TRÍCH XUẤT (${meta.latencyMs}ms, ${meta.model}) ===`);
console.log(JSON.stringify(profile, null, 2));
if (meta.warnings.length) console.log('CẢNH BÁO:', meta.warnings);

const chunks = [
  ...chunkCvProfile(profile, { candidateId: 'demo' }),
  // Với file text, chunk thêm từ văn bản gốc để so sánh hai cách.
  ...(isPdf ? [] : chunkCvText(vars.cvText, { candidateId: 'demo-raw', candidateName: profile.full_name, yearsOfExperience: profile.years_of_experience })),
];
console.log(`\n=== ${chunks.length} CHUNK ===`);
for (const c of chunks) console.log(`\n[${c.id}] (${c.text.length} ký tự)\n${c.text}`);

if (process.argv.includes('--embed')) {
  const vectors = await embedTexts(chunks.map((c) => c.text), { kind: 'document', title: 'CV' });
  const records = toPineconeRecords(chunks, vectors);
  console.log(`\n=== EMBEDDING: ${records.length} vector, mỗi vector ${records[0].values.length} chiều ===`);
}

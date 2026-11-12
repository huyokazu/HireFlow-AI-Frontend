# Cấu trúc dữ liệu Vector DB (đề xuất để chốt với Backend)

## 1. Luồng dữ liệu

```
CV (PDF/text) --extractCv()--> hồ sơ JSON --chunkCvProfile()--> chunk --embedTexts()--> vector --> Pinecone/ChromaDB
JD (text)     ------------------------------chunkJdText()----> chunk --embedTexts()--> vector --> Pinecone/ChromaDB
```

Hồ sơ JSON đầy đủ (kể cả email, số điện thoại) lưu ở database chính (Supabase).
Vector DB chỉ lưu chunk đã **che email và số điện thoại**.

## 2. Một bản ghi

```json
{
  "id": "cv:cand_001#profile-0",
  "values": [0.012, -0.034, "... 768 số ..."],
  "metadata": {
    "doc_type": "cv",
    "doc_id": "cand_001",
    "section": "profile",
    "chunk_index": 0,
    "candidate_id": "cand_001",
    "campaign_id": "marketing-2026",
    "years_of_experience": 3,
    "skills": ["Facebook Ads", "SEO"],
    "text": "CV | Trần Quốc Bảo | Marketing Executive | Tổng kinh nghiệm: 3 năm | Mục: Hồ sơ tóm tắt\n..."
  }
}
```

| Trường | Ý nghĩa |
|---|---|
| `id` | `{doc_type}:{doc_id}#{section}-{chunk_index}`. Upsert lại cùng `id` sẽ ghi đè, không tạo bản trùng |
| `doc_type` | `cv` hoặc `jd` |
| `doc_id` | ID ứng viên (với CV) hoặc ID chiến dịch (với JD) trong database chính |
| `section` | CV: `profile`, `experience`, `education`, ... JD: `responsibilities`, `requirements`, `benefits` |
| `years_of_experience` | Số. Không có thì **bỏ hẳn khoá** (Vector DB không nhận `null`) |
| `skills` | Mảng chuỗi (Pinecone). Với ChromaDB được nối thành chuỗi `"Facebook Ads, SEO"` |
| `text` | Nội dung chunk, dùng để hiển thị và đưa lại cho Gemini |

## 3. Quy tắc chunking

1. Cắt theo **mục** của CV/JD, không cắt theo số ký tự cố định.
2. Mỗi công việc nằm trọn trong 1 chunk.
3. Mọi chunk bắt đầu bằng 1 dòng ngữ cảnh: tên, chức danh, tổng số năm kinh nghiệm, tên mục.
4. Chunk `profile` gộp **tất cả kỹ năng kèm số năm** và tổng số năm kinh nghiệm vào cùng 1 chunk.
5. Tối đa 1000 ký tự mỗi chunk; đoạn dài hơn bị cắt theo dòng/câu, gối đầu tối đa 150 ký tự.

## 4. Embedding

| Mục | Giá trị |
|---|---|
| Model | `gemini-embedding-2` |
| Số chiều | `768` (index Pinecone phải tạo đúng số này) |
| Metric | `cosine` |
| Khi lưu tài liệu | `embedTexts(texts, { kind: 'document', title })` |
| Khi tìm kiếm | `embedTexts([cauHoi], { kind: 'query' })` |

Hai hàm đóng gói sẵn: `toPineconeRecords(chunks, vectors)` và `toChromaBatch(chunks, vectors)` trong `lib/embedding.js`.

## 5. Tìm ứng viên cho một JD

1. Embed phần `requirements` của JD với `kind: 'query'`.
2. Query Vector DB, lọc `doc_type = "cv"` và `campaign_id` tương ứng, lấy top 20 chunk.
3. Gom theo `candidate_id`, lấy top 5–10 ứng viên.
4. Gọi `scoreCv()` cho từng ứng viên để có điểm và lý do; HR duyệt kết quả.

## 6. Cần chốt với Backend

- [ ] Dùng Pinecone hay ChromaDB
- [ ] Tên index / collection, có tách namespace theo chiến dịch không
- [ ] `doc_id` lấy từ bảng nào của database chính
- [ ] Số chiều 768, metric cosine
- [ ] Khi CV bị xoá ở database chính thì xoá vector theo tiền tố `cv:{candidate_id}#`

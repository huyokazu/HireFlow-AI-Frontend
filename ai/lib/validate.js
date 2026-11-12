// Bộ kiểm tra JSON Schema tối giản (đủ dùng cho các schema trong prompts/).
// Gemini đã ép schema ở phía server; lớp này là "chốt chặn thứ hai" ở Backend.

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value; // string | boolean | object
}

function matchesType(value, type) {
  const actual = typeOf(value);
  return actual === type || (type === 'number' && actual === 'integer');
}

/**
 * @returns {string[]} danh sách lỗi; mảng rỗng nghĩa là hợp lệ.
 */
export function validate(value, schema, path = '$') {
  const errors = [];
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (schema.type && !types.some((t) => matchesType(value, t))) {
    return [`${path}: cần kiểu ${types.join('|')}, nhận ${typeOf(value)}`];
  }
  if (value === null) return errors;

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: "${value}" không thuộc [${schema.enum.join(', ')}]`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: nhỏ hơn ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: lớn hơn ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path}: nhiều hơn ${schema.maxItems} phần tử`);
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}: ít hơn ${schema.minItems} phần tử`);
    if (schema.items) value.forEach((item, i) => errors.push(...validate(item, schema.items, `${path}[${i}]`)));
  } else if (typeof value === 'object') {
    for (const key of schema.required || []) {
      if (!(key in value)) errors.push(`${path}.${key}: thiếu trường bắt buộc`);
    }
    for (const [key, sub] of Object.entries(schema.properties || {})) {
      if (key in value) errors.push(...validate(value[key], sub, `${path}.${key}`));
    }
  }
  return errors;
}

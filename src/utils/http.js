export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function parseCode(value, label = 'Mã') {
  const str = typeof value === 'string' ? value.trim() : '';
  if (!str) {
    throw httpError(400, `Vui lòng nhập ${label.toLowerCase()}`);
  }
  if (str.length > 20) {
    throw httpError(400, `${label} không được vượt quá 20 ký tự`);
  }
  return str;
}

export function parseRequiredText(value, label = 'Thông tin', maxLen = 255) {
  const str = typeof value === 'string' ? value.trim() : '';
  if (!str) {
    throw httpError(400, `Vui lòng nhập ${label.toLowerCase()}`);
  }
  if (str.length > maxLen) {
    throw httpError(400, `${label} không được vượt quá ${maxLen} ký tự`);
  }
  return str;
}

export function parseIsoDate(value, label = 'Ngày', { nullable = false } = {}) {
  if (value === null || value === undefined || String(value).trim() === '') {
    if (nullable) return null;
    throw httpError(400, `Vui lòng chọn ${label.toLowerCase()}`);
  }
  const str = String(value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (!match) {
    throw httpError(400, `${label} không đúng định dạng YYYY-MM-DD`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() + 1 !== month ||
    dt.getUTCDate() !== day
  ) {
    throw httpError(400, `${label} không tồn tại trên lịch`);
  }
  return str;
}

export function formatDateOnly(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(str) ? str.slice(0, 10) : str;
}

export function parseNumber(
  value,
  label = 'Giá trị',
  { min = 0, max = Infinity, exclusiveMin = false, integer = false } = {}
) {
  if (value === null || value === undefined || typeof value === 'boolean' || String(value).trim() === '') {
    throw httpError(400, `Vui lòng nhập ${label.toLowerCase()} hợp lệ`);
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw httpError(400, `${label} phải là số hợp lệ`);
  }
  if (integer && !Number.isInteger(num)) {
    throw httpError(400, `${label} phải là số nguyên`);
  }
  if (exclusiveMin ? num <= min : num < min) {
    throw httpError(
      400,
      exclusiveMin ? `${label} phải lớn hơn ${min}` : `${label} phải từ ${min} trở lên`
    );
  }
  if (num > max) {
    throw httpError(400, `${label} không được vượt quá ${max}`);
  }
  return num;
}

export function unwrapCallRows(result) {
  if (Array.isArray(result?.[0])) return result[0];
  return Array.isArray(result) ? result : [];
}

export function computeTotalSalary({ luong_can_ban, he_so_luong, so_ngay_lam_viec, phu_cap }) {
  return Math.round(
    (Number(luong_can_ban) * Number(he_so_luong) * Number(so_ngay_lam_viec)) / 26 + Number(phu_cap)
  );
}

export function mapDbError(err, messages = {}) {
  const code = err?.code;
  const errno = err?.errno;

  if (code === 'ER_DUP_ENTRY' || errno === 1062) {
    return httpError(409, messages.duplicate || 'Mã hoặc tên dữ liệu đã tồn tại trong hệ thống');
  }
  if (code === 'ER_ROW_IS_REFERENCED_2' || errno === 1451) {
    return httpError(
      409,
      messages.referenced || 'Không thể xóa bản ghi này vì đang có dữ liệu liên quan'
    );
  }
  if (code === 'ER_NO_REFERENCED_ROW_2' || errno === 1452) {
    return httpError(
      400,
      messages.foreignKey || 'Dữ liệu tham chiếu (phòng ban, chức vụ, nhân viên...) không tồn tại'
    );
  }
  if (code === 'ER_CHECK_CONSTRAINT_VIOLATED' || errno === 3819) {
    return httpError(400, messages.check || 'Dữ liệu không thỏa điều kiện kiểm tra');
  }
  return err;
}

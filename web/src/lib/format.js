const vndFormatter = new Intl.NumberFormat('vi-VN');

export function formatCurrency(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return '0 ₫';
  return `${vndFormatter.format(Math.round(num))} ₫`;
}

export function formatDate(isoDate) {
  if (!isoDate) return '—';
  const str = String(isoDate).trim().slice(0, 10);
  const parts = str.split('-');
  if (parts.length !== 3) return str;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function todayIsoDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function suggestNextCode(prefix, codes = [], pad = 2) {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}(\\d+)$`, 'i');
  let maxNum = 0;
  for (const code of codes) {
    const match = pattern.exec(String(code || '').trim());
    if (match) {
      const n = Number(match[1]);
      if (n > maxNum) maxNum = n;
    }
  }
  const next = String(maxNum + 1);
  return `${prefix}${next.padStart(Math.max(pad, next.length), '0')}`;
}

export function calculateSalaryTotal({ luongCanBan, heSoLuong, soNgayLamViec, phuCap }) {
  const base = Number(luongCanBan || 0);
  const coef = Number(heSoLuong || 0);
  const days = Number(soNgayLamViec || 0);
  const allowance = Number(phuCap || 0);
  if (!Number.isFinite(base) || !Number.isFinite(coef) || !Number.isFinite(days) || !Number.isFinite(allowance)) {
    return 0;
  }
  return Math.round((base * coef * days) / 26 + allowance);
}

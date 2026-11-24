import { Router } from 'express';
import { query as defaultQuery, withTransaction as defaultWithTransaction } from '../db/index.js';
import { requireAuth, requireRole } from '../auth.js';
import {
  computeTotalSalary,
  httpError,
  mapDbError,
  parseCode,
  parseNumber,
} from '../utils/http.js';

const SELECT_ATTENDANCE_SQL = `
  SELECT
    cc.ma_cham_cong,
    cc.ma_nhan_vien,
    nv.ten_nhan_vien,
    pb.ma_phong_ban,
    pb.ten_phong_ban,
    cv.ten_chuc_vu,
    cv.he_so_luong,
    cc.so_ngay_lam_viec,
    cc.so_ngay_nghi,
    l.ma_luong,
    l.thang_tinh_luong,
    l.nam_tinh_luong
  FROM cham_cong cc
  JOIN nhan_vien nv ON cc.ma_nhan_vien = nv.ma_nhan_vien
  JOIN phong_ban pb ON nv.ma_phong_ban = pb.ma_phong_ban
  JOIN chuc_vu cv ON nv.ma_chuc_vu = cv.ma_chuc_vu
  LEFT JOIN luong l ON cc.ma_cham_cong = l.ma_cham_cong
`;

function normalizeAttendance(r) {
  return {
    ma_cham_cong: r.ma_cham_cong,
    ma_nhan_vien: r.ma_nhan_vien,
    ten_nhan_vien: r.ten_nhan_vien,
    ma_phong_ban: r.ma_phong_ban,
    ten_phong_ban: r.ten_phong_ban,
    ten_chuc_vu: r.ten_chuc_vu,
    he_so_luong: Number(r.he_so_luong),
    so_ngay_lam_viec: Number(r.so_ngay_lam_viec),
    so_ngay_nghi: Number(r.so_ngay_nghi || 0),
    ma_luong: r.ma_luong || null,
    thang_tinh_luong: r.thang_tinh_luong != null ? Number(r.thang_tinh_luong) : null,
    nam_tinh_luong: r.nam_tinh_luong != null ? Number(r.nam_tinh_luong) : null,
  };
}

function validateAttendancePayload(body) {
  const ma_nhan_vien = parseCode(body?.ma_nhan_vien, 'Nhân viên');
  const so_ngay_lam_viec = parseNumber(body?.so_ngay_lam_viec, 'Số ngày làm việc', {
    min: 0,
    max: 31,
    integer: true,
  });
  const rawNghi = body?.so_ngay_nghi === undefined || body?.so_ngay_nghi === '' ? 0 : body?.so_ngay_nghi;
  const so_ngay_nghi = parseNumber(rawNghi, 'Số ngày nghỉ', {
    min: 0,
    max: 31,
    integer: true,
  });

  if (so_ngay_lam_viec + so_ngay_nghi > 31) {
    throw httpError(400, 'Tổng số ngày làm việc và số ngày nghỉ không được vượt quá 31 ngày');
  }

  return { ma_nhan_vien, so_ngay_lam_viec, so_ngay_nghi };
}

export function createAttendanceRouter({
  query = defaultQuery,
  withTransaction = defaultWithTransaction,
} = {}) {
  const router = Router();
  router.use(requireAuth);

  async function fetchOne(ma_cham_cong) {
    const rows = await query(`${SELECT_ATTENDANCE_SQL} WHERE cc.ma_cham_cong = ? LIMIT 1`, [
      ma_cham_cong,
    ]);
    return rows[0] ? normalizeAttendance(rows[0]) : null;
  }

  router.get('/', async (req, res, next) => {
    try {
      const maPhongBan = String(req.query.ma_phong_ban || '').trim();
      const chuaTinhLuong = String(req.query.chua_tinh_luong || '').trim();
      const keyword = String(req.query.q || '').trim().toLowerCase();

      const rows = await query(`${SELECT_ATTENDANCE_SQL} ORDER BY cc.ma_cham_cong`);
      let items = rows.map(normalizeAttendance);

      if (maPhongBan) {
        items = items.filter((cc) => cc.ma_phong_ban === maPhongBan);
      }
      if (chuaTinhLuong === '1' || chuaTinhLuong === 'true') {
        items = items.filter((cc) => !cc.ma_luong);
      } else if (chuaTinhLuong === '0' || chuaTinhLuong === 'false') {
        items = items.filter((cc) => Boolean(cc.ma_luong));
      }
      if (keyword) {
        items = items.filter(
          (cc) =>
            cc.ma_cham_cong.toLowerCase().includes(keyword) ||
            cc.ma_nhan_vien.toLowerCase().includes(keyword) ||
            (cc.ten_nhan_vien || '').toLowerCase().includes(keyword)
        );
      }

      res.json(items);
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const ma_cham_cong = parseCode(req.body?.ma_cham_cong, 'Mã chấm công');
      const data = validateAttendancePayload(req.body);

      await query(
        `INSERT INTO cham_cong (ma_cham_cong, ma_nhan_vien, so_ngay_lam_viec, so_ngay_nghi)
         VALUES (?, ?, ?, ?)`,
        [ma_cham_cong, data.ma_nhan_vien, data.so_ngay_lam_viec, data.so_ngay_nghi]
      );

      const created = await fetchOne(ma_cham_cong);
      res.status(201).json(created || { ma_cham_cong, ...data });
    } catch (err) {
      next(
        mapDbError(err, {
          duplicate: 'Mã chấm công đã tồn tại trong hệ thống',
          foreignKey: 'Nhân viên được chọn không tồn tại',
        })
      );
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const ma_cham_cong = parseCode(req.params.id, 'Mã chấm công');
      const data = validateAttendancePayload(req.body);

      await withTransaction(async (q) => {
        const result = await q(
          `UPDATE cham_cong
           SET ma_nhan_vien = ?, so_ngay_lam_viec = ?, so_ngay_nghi = ?
           WHERE ma_cham_cong = ?`,
          [data.ma_nhan_vien, data.so_ngay_lam_viec, data.so_ngay_nghi, ma_cham_cong]
        );
        if (!result?.affectedRows) {
          throw httpError(404, 'Không tìm thấy bản ghi chấm công');
        }

        const salaryRows = await q(
          'SELECT ma_luong, luong_can_ban, phu_cap FROM luong WHERE ma_cham_cong = ? LIMIT 1',
          [ma_cham_cong]
        );
        if (salaryRows[0]) {
          const empRows = await q(
            `SELECT cv.he_so_luong
             FROM nhan_vien nv
             JOIN chuc_vu cv ON nv.ma_chuc_vu = cv.ma_chuc_vu
             WHERE nv.ma_nhan_vien = ?
             LIMIT 1`,
            [data.ma_nhan_vien]
          );
          if (empRows[0]) {
            const newTotal = computeTotalSalary({
              luong_can_ban: salaryRows[0].luong_can_ban,
              he_so_luong: empRows[0].he_so_luong,
              so_ngay_lam_viec: data.so_ngay_lam_viec,
              phu_cap: salaryRows[0].phu_cap,
            });
            await q('UPDATE luong SET tong_luong = ? WHERE ma_cham_cong = ?', [
              newTotal,
              ma_cham_cong,
            ]);
          }
        }
      });

      const updated = await fetchOne(ma_cham_cong);
      res.json(updated || { ma_cham_cong, ...data });
    } catch (err) {
      next(
        mapDbError(err, {
          foreignKey: 'Nhân viên được chọn không tồn tại',
        })
      );
    }
  });

  router.delete('/:id', requireRole('Admin'), async (req, res, next) => {
    try {
      const ma_cham_cong = parseCode(req.params.id, 'Mã chấm công');
      const result = await query('DELETE FROM cham_cong WHERE ma_cham_cong = ?', [ma_cham_cong]);
      if (!result?.affectedRows) {
        throw httpError(404, 'Không tìm thấy bản ghi chấm công');
      }
      res.json({ ok: true });
    } catch (err) {
      next(
        mapDbError(err, {
          referenced: 'Không thể xóa bản ghi chấm công đã tính lương',
        })
      );
    }
  });

  return router;
}

export default createAttendanceRouter();

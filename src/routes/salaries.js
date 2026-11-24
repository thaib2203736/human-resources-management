import { Router } from 'express';
import { query as defaultQuery } from '../db/index.js';
import { requireAuth, requireRole } from '../auth.js';
import {
  computeTotalSalary,
  httpError,
  mapDbError,
  parseCode,
  parseNumber,
} from '../utils/http.js';

const SELECT_SALARIES_SQL = `
  SELECT
    l.ma_luong,
    l.ma_cham_cong,
    l.thang_tinh_luong,
    l.nam_tinh_luong,
    l.luong_can_ban,
    l.phu_cap,
    l.tong_luong,
    nv.ma_nhan_vien,
    nv.ten_nhan_vien,
    pb.ma_phong_ban,
    pb.ten_phong_ban,
    cv.ten_chuc_vu,
    cv.he_so_luong,
    cc.so_ngay_lam_viec,
    cc.so_ngay_nghi
  FROM luong l
  JOIN cham_cong cc ON l.ma_cham_cong = cc.ma_cham_cong
  JOIN nhan_vien nv ON cc.ma_nhan_vien = nv.ma_nhan_vien
  JOIN phong_ban pb ON nv.ma_phong_ban = pb.ma_phong_ban
  JOIN chuc_vu cv ON nv.ma_chuc_vu = cv.ma_chuc_vu
`;

function normalizeSalary(r) {
  return {
    ma_luong: r.ma_luong,
    ma_cham_cong: r.ma_cham_cong,
    thang_tinh_luong: Number(r.thang_tinh_luong),
    nam_tinh_luong: Number(r.nam_tinh_luong),
    luong_can_ban: Number(r.luong_can_ban),
    phu_cap: Number(r.phu_cap || 0),
    tong_luong: Number(r.tong_luong),
    ma_nhan_vien: r.ma_nhan_vien,
    ten_nhan_vien: r.ten_nhan_vien,
    ma_phong_ban: r.ma_phong_ban,
    ten_phong_ban: r.ten_phong_ban,
    ten_chuc_vu: r.ten_chuc_vu,
    he_so_luong: Number(r.he_so_luong),
    so_ngay_lam_viec: Number(r.so_ngay_lam_viec),
    so_ngay_nghi: Number(r.so_ngay_nghi || 0),
  };
}

function validateSalaryPayload(body) {
  const ma_cham_cong = parseCode(body?.ma_cham_cong, 'Mã chấm công');
  const thang_tinh_luong = parseNumber(body?.thang_tinh_luong, 'Tháng tính lương', {
    min: 1,
    max: 12,
    integer: true,
  });
  const nam_tinh_luong = parseNumber(body?.nam_tinh_luong, 'Năm tính lương', {
    min: 2000,
    max: 2100,
    integer: true,
  });
  const luong_can_ban = parseNumber(body?.luong_can_ban, 'Lương căn bản', {
    min: 0,
    max: 9999999999.99,
  });
  const rawPhuCap = body?.phu_cap === undefined || body?.phu_cap === '' ? 0 : body?.phu_cap;
  const phu_cap = parseNumber(rawPhuCap, 'Phụ cấp', {
    min: 0,
    max: 9999999999.99,
  });

  return { ma_cham_cong, thang_tinh_luong, nam_tinh_luong, luong_can_ban, phu_cap };
}

export function createSalariesRouter({ query = defaultQuery } = {}) {
  const router = Router();
  router.use(requireAuth);

  async function fetchOne(ma_luong) {
    const rows = await query(`${SELECT_SALARIES_SQL} WHERE l.ma_luong = ? LIMIT 1`, [ma_luong]);
    return rows[0] ? normalizeSalary(rows[0]) : null;
  }

  async function resolveTotalSalary(data) {
    const refRows = await query(
      `SELECT cc.so_ngay_lam_viec, cv.he_so_luong
       FROM cham_cong cc
       JOIN nhan_vien nv ON cc.ma_nhan_vien = nv.ma_nhan_vien
       JOIN chuc_vu cv ON nv.ma_chuc_vu = cv.ma_chuc_vu
       WHERE cc.ma_cham_cong = ?
       LIMIT 1`,
      [data.ma_cham_cong]
    );
    if (!refRows[0]) {
      throw httpError(400, 'Bản ghi chấm công được chọn không tồn tại');
    }
    return computeTotalSalary({
      luong_can_ban: data.luong_can_ban,
      he_so_luong: refRows[0].he_so_luong,
      so_ngay_lam_viec: refRows[0].so_ngay_lam_viec,
      phu_cap: data.phu_cap,
    });
  }

  router.get('/', async (req, res, next) => {
    try {
      const thang = String(req.query.thang || '').trim();
      const nam = String(req.query.nam || '').trim();
      const maPhongBan = String(req.query.ma_phong_ban || '').trim();
      const keyword = String(req.query.q || '').trim().toLowerCase();

      const rows = await query(
        `${SELECT_SALARIES_SQL} ORDER BY l.nam_tinh_luong DESC, l.thang_tinh_luong DESC, l.ma_luong`
      );
      let items = rows.map(normalizeSalary);

      if (thang) {
        items = items.filter((l) => l.thang_tinh_luong === Number(thang));
      }
      if (nam) {
        items = items.filter((l) => l.nam_tinh_luong === Number(nam));
      }
      if (maPhongBan) {
        items = items.filter((l) => l.ma_phong_ban === maPhongBan);
      }
      if (keyword) {
        items = items.filter(
          (l) =>
            l.ma_luong.toLowerCase().includes(keyword) ||
            l.ma_cham_cong.toLowerCase().includes(keyword) ||
            (l.ma_nhan_vien || '').toLowerCase().includes(keyword) ||
            (l.ten_nhan_vien || '').toLowerCase().includes(keyword)
        );
      }

      res.json(items);
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const ma_luong = parseCode(req.body?.ma_luong, 'Mã lương');
      const data = validateSalaryPayload(req.body);
      const tong_luong = await resolveTotalSalary(data);

      await query(
        `INSERT INTO luong (
          ma_luong, ma_cham_cong, thang_tinh_luong, nam_tinh_luong,
          luong_can_ban, phu_cap, tong_luong
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          ma_luong,
          data.ma_cham_cong,
          data.thang_tinh_luong,
          data.nam_tinh_luong,
          data.luong_can_ban,
          data.phu_cap,
          tong_luong,
        ]
      );

      const created = await fetchOne(ma_luong);
      res.status(201).json(created || { ma_luong, ...data, tong_luong });
    } catch (err) {
      next(
        mapDbError(err, {
          duplicate: 'Bản ghi chấm công này đã được lập bảng lương hoặc trùng mã lương',
          foreignKey: 'Bản ghi chấm công được chọn không tồn tại',
        })
      );
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const ma_luong = parseCode(req.params.id, 'Mã lương');
      const data = validateSalaryPayload(req.body);
      const tong_luong = await resolveTotalSalary(data);

      const result = await query(
        `UPDATE luong
         SET ma_cham_cong = ?, thang_tinh_luong = ?, nam_tinh_luong = ?,
             luong_can_ban = ?, phu_cap = ?, tong_luong = ?
         WHERE ma_luong = ?`,
        [
          data.ma_cham_cong,
          data.thang_tinh_luong,
          data.nam_tinh_luong,
          data.luong_can_ban,
          data.phu_cap,
          tong_luong,
          ma_luong,
        ]
      );
      if (!result?.affectedRows) {
        throw httpError(404, 'Không tìm thấy bảng lương');
      }

      const updated = await fetchOne(ma_luong);
      res.json(updated || { ma_luong, ...data, tong_luong });
    } catch (err) {
      next(
        mapDbError(err, {
          duplicate: 'Bản ghi chấm công này đã được gắn với một bảng lương khác',
          foreignKey: 'Bản ghi chấm công được chọn không tồn tại',
        })
      );
    }
  });

  router.delete('/:id', requireRole('Admin'), async (req, res, next) => {
    try {
      const ma_luong = parseCode(req.params.id, 'Mã lương');
      const result = await query('DELETE FROM luong WHERE ma_luong = ?', [ma_luong]);
      if (!result?.affectedRows) {
        throw httpError(404, 'Không tìm thấy bảng lương');
      }
      res.json({ ok: true });
    } catch (err) {
      next(mapDbError(err));
    }
  });

  return router;
}

export default createSalariesRouter();

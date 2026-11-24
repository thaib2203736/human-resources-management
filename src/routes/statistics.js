import { Router } from 'express';
import { query as defaultQuery } from '../db/index.js';
import { requireAuth } from '../auth.js';
import { parseNumber, unwrapCallRows } from '../utils/http.js';

export function createStatisticsRouter({ query = defaultQuery } = {}) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req, res, next) => {
    try {
      const rawNam = String(req.query.nam || '').trim();
      const namParam = rawNam
        ? parseNumber(rawNam, 'Năm thống kê', { min: 1970, max: 2100, integer: true })
        : null;
      const maPhongBanParam = String(req.query.ma_phong_ban || '').trim() || null;

      const [yearRows, empRows, depRows, contractRows, payrollRows, spRaw] = await Promise.all([
        query('SELECT DISTINCT nam_tinh_luong FROM luong ORDER BY nam_tinh_luong DESC'),
        query(
          `SELECT
             COUNT(*) AS tong_nhan_vien,
             COALESCE(SUM(trang_thai = 'Đang làm việc'), 0) AS dang_lam_viec,
             COALESCE(SUM(trang_thai = 'Nghỉ việc'), 0) AS nghi_viec
           FROM nhan_vien
           WHERE (? IS NULL OR ma_phong_ban = ?)`,
          [maPhongBanParam, maPhongBanParam]
        ),
        query(
          'SELECT COUNT(*) AS tong_phong_ban FROM phong_ban WHERE (? IS NULL OR ma_phong_ban = ?)',
          [maPhongBanParam, maPhongBanParam]
        ),
        query(
          `SELECT
             COALESCE(SUM(hd.ngay_ket_thuc IS NULL), 0) AS hop_dong_hieu_luc,
             COALESCE(SUM(hd.ngay_ket_thuc IS NOT NULL), 0) AS hop_dong_ket_thuc
           FROM hop_dong hd
           JOIN nhan_vien nv ON hd.ma_nhan_vien = nv.ma_nhan_vien
           WHERE (? IS NULL OR nv.ma_phong_ban = ?)`,
          [maPhongBanParam, maPhongBanParam]
        ),
        query(
          `SELECT
             COALESCE(SUM(l.tong_luong), 0) AS tong_quy_luong,
             COALESCE(ROUND(AVG(l.tong_luong), 0), 0) AS luong_trung_binh
           FROM luong l
           JOIN cham_cong cc ON l.ma_cham_cong = cc.ma_cham_cong
           JOIN nhan_vien nv ON cc.ma_nhan_vien = nv.ma_nhan_vien
           WHERE (? IS NULL OR l.nam_tinh_luong = ?)
             AND (? IS NULL OR nv.ma_phong_ban = ?)`,
          [namParam, namParam, maPhongBanParam, maPhongBanParam]
        ),
        query('CALL sp_thong_ke_luong(?, ?)', [namParam, maPhongBanParam]),
      ]);

      const emp = empRows[0] || {};
      const dep = depRows[0] || {};
      const ct = contractRows[0] || {};
      const pr = payrollRows[0] || {};

      const byDepartment = unwrapCallRows(spRaw).map((r) => ({
        ma_phong_ban: r.ma_phong_ban,
        ten_phong_ban: r.ten_phong_ban,
        so_nhan_vien: Number(r.so_nhan_vien || 0),
        so_ky_luong: Number(r.so_ky_luong || 0),
        tong_quy_luong: Number(r.tong_quy_luong || 0),
        luong_trung_binh: Number(r.luong_trung_binh || 0),
        luong_cao_nhat: Number(r.luong_cao_nhat || 0),
        luong_thap_nhat: Number(r.luong_thap_nhat || 0),
      }));

      res.json({
        years: yearRows.map((r) => Number(r.nam_tinh_luong)),
        summary: {
          tong_nhan_vien: Number(emp.tong_nhan_vien || 0),
          dang_lam_viec: Number(emp.dang_lam_viec || 0),
          nghi_viec: Number(emp.nghi_viec || 0),
          tong_phong_ban: Number(dep.tong_phong_ban || 0),
          hop_dong_hieu_luc: Number(ct.hop_dong_hieu_luc || 0),
          hop_dong_ket_thuc: Number(ct.hop_dong_ket_thuc || 0),
          tong_quy_luong: Number(pr.tong_quy_luong || 0),
          luong_trung_binh: Number(pr.luong_trung_binh || 0),
        },
        byDepartment,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export default createStatisticsRouter();

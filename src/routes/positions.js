import { Router } from 'express';
import { query as defaultQuery } from '../db/index.js';
import { requireAuth, requireRole } from '../auth.js';
import {
  httpError,
  mapDbError,
  parseCode,
  parseNumber,
  parseRequiredText,
} from '../utils/http.js';

export function createPositionsRouter({ query = defaultQuery } = {}) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (_req, res, next) => {
    try {
      const rows = await query(
        `SELECT cv.ma_chuc_vu, cv.ten_chuc_vu, cv.he_so_luong, COUNT(nv.ma_nhan_vien) AS so_nhan_vien
         FROM chuc_vu cv
         LEFT JOIN nhan_vien nv ON cv.ma_chuc_vu = nv.ma_chuc_vu
         GROUP BY cv.ma_chuc_vu, cv.ten_chuc_vu, cv.he_so_luong
         ORDER BY cv.ma_chuc_vu`
      );
      res.json(
        rows.map((r) => ({
          ma_chuc_vu: r.ma_chuc_vu,
          ten_chuc_vu: r.ten_chuc_vu,
          he_so_luong: Number(r.he_so_luong),
          so_nhan_vien: Number(r.so_nhan_vien || 0),
        }))
      );
    } catch (err) {
      next(err);
    }
  });

  router.post('/', requireRole('Admin'), async (req, res, next) => {
    try {
      const ma_chuc_vu = parseCode(req.body?.ma_chuc_vu, 'Mã chức vụ');
      const ten_chuc_vu = parseRequiredText(req.body?.ten_chuc_vu, 'Tên chức vụ', 100);
      const he_so_luong = parseNumber(req.body?.he_so_luong, 'Hệ số lương', {
        min: 0,
        max: 999.99,
        exclusiveMin: true,
      });

      await query(
        'INSERT INTO chuc_vu (ma_chuc_vu, ten_chuc_vu, he_so_luong) VALUES (?, ?, ?)',
        [ma_chuc_vu, ten_chuc_vu, he_so_luong]
      );
      res.status(201).json({ ma_chuc_vu, ten_chuc_vu, he_so_luong, so_nhan_vien: 0 });
    } catch (err) {
      next(
        mapDbError(err, {
          duplicate: 'Mã chức vụ hoặc tên chức vụ đã tồn tại',
        })
      );
    }
  });

  router.put('/:id', requireRole('Admin'), async (req, res, next) => {
    try {
      const ma_chuc_vu = parseCode(req.params.id, 'Mã chức vụ');
      const ten_chuc_vu = parseRequiredText(req.body?.ten_chuc_vu, 'Tên chức vụ', 100);
      const he_so_luong = parseNumber(req.body?.he_so_luong, 'Hệ số lương', {
        min: 0,
        max: 999.99,
        exclusiveMin: true,
      });

      const result = await query(
        'UPDATE chuc_vu SET ten_chuc_vu = ?, he_so_luong = ? WHERE ma_chuc_vu = ?',
        [ten_chuc_vu, he_so_luong, ma_chuc_vu]
      );
      if (!result?.affectedRows) {
        throw httpError(404, 'Không tìm thấy chức vụ');
      }
      res.json({ ma_chuc_vu, ten_chuc_vu, he_so_luong });
    } catch (err) {
      next(
        mapDbError(err, {
          duplicate: 'Tên chức vụ đã tồn tại',
        })
      );
    }
  });

  router.delete('/:id', requireRole('Admin'), async (req, res, next) => {
    try {
      const ma_chuc_vu = parseCode(req.params.id, 'Mã chức vụ');
      const result = await query('DELETE FROM chuc_vu WHERE ma_chuc_vu = ?', [ma_chuc_vu]);
      if (!result?.affectedRows) {
        throw httpError(404, 'Không tìm thấy chức vụ');
      }
      res.json({ ok: true });
    } catch (err) {
      next(
        mapDbError(err, {
          referenced: 'Không thể xóa chức vụ đang có nhân viên đảm nhiệm',
        })
      );
    }
  });

  return router;
}

export default createPositionsRouter();

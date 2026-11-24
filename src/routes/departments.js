import { Router } from 'express';
import { query as defaultQuery } from '../db/index.js';
import { requireAuth, requireRole } from '../auth.js';
import { httpError, mapDbError, parseCode, parseRequiredText } from '../utils/http.js';

export function createDepartmentsRouter({ query = defaultQuery } = {}) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (_req, res, next) => {
    try {
      const rows = await query(
        `SELECT pb.ma_phong_ban, pb.ten_phong_ban, COUNT(nv.ma_nhan_vien) AS so_nhan_vien
         FROM phong_ban pb
         LEFT JOIN nhan_vien nv ON pb.ma_phong_ban = nv.ma_phong_ban
         GROUP BY pb.ma_phong_ban, pb.ten_phong_ban
         ORDER BY pb.ma_phong_ban`
      );
      res.json(
        rows.map((r) => ({
          ma_phong_ban: r.ma_phong_ban,
          ten_phong_ban: r.ten_phong_ban,
          so_nhan_vien: Number(r.so_nhan_vien || 0),
        }))
      );
    } catch (err) {
      next(err);
    }
  });

  router.post('/', requireRole('Admin'), async (req, res, next) => {
    try {
      const ma_phong_ban = parseCode(req.body?.ma_phong_ban, 'Mã phòng ban');
      const ten_phong_ban = parseRequiredText(req.body?.ten_phong_ban, 'Tên phòng ban', 100);

      await query('INSERT INTO phong_ban (ma_phong_ban, ten_phong_ban) VALUES (?, ?)', [
        ma_phong_ban,
        ten_phong_ban,
      ]);
      res.status(201).json({ ma_phong_ban, ten_phong_ban, so_nhan_vien: 0 });
    } catch (err) {
      next(
        mapDbError(err, {
          duplicate: 'Mã phòng ban hoặc tên phòng ban đã tồn tại',
        })
      );
    }
  });

  router.put('/:id', requireRole('Admin'), async (req, res, next) => {
    try {
      const ma_phong_ban = parseCode(req.params.id, 'Mã phòng ban');
      const ten_phong_ban = parseRequiredText(req.body?.ten_phong_ban, 'Tên phòng ban', 100);

      const result = await query(
        'UPDATE phong_ban SET ten_phong_ban = ? WHERE ma_phong_ban = ?',
        [ten_phong_ban, ma_phong_ban]
      );
      if (!result?.affectedRows) {
        throw httpError(404, 'Không tìm thấy phòng ban');
      }
      res.json({ ma_phong_ban, ten_phong_ban });
    } catch (err) {
      next(
        mapDbError(err, {
          duplicate: 'Tên phòng ban đã tồn tại',
        })
      );
    }
  });

  router.delete('/:id', requireRole('Admin'), async (req, res, next) => {
    try {
      const ma_phong_ban = parseCode(req.params.id, 'Mã phòng ban');
      const result = await query('DELETE FROM phong_ban WHERE ma_phong_ban = ?', [ma_phong_ban]);
      if (!result?.affectedRows) {
        throw httpError(404, 'Không tìm thấy phòng ban');
      }
      res.json({ ok: true });
    } catch (err) {
      next(
        mapDbError(err, {
          referenced: 'Không thể xóa phòng ban đang có nhân viên trực thuộc',
        })
      );
    }
  });

  return router;
}

export default createDepartmentsRouter();

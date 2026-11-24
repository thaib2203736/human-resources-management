import { Router } from 'express';
import { query as defaultQuery } from '../db/index.js';
import { requireAuth, requireRole } from '../auth.js';
import {
  formatDateOnly,
  httpError,
  mapDbError,
  parseCode,
  parseIsoDate,
  parseRequiredText,
} from '../utils/http.js';

const SELECT_CONTRACTS_SQL = `
  SELECT
    hd.ma_hop_dong,
    hd.ma_nhan_vien,
    nv.ten_nhan_vien,
    pb.ten_phong_ban,
    nv.trang_thai AS trang_thai_nhan_vien,
    hd.loai_hop_dong,
    hd.ngay_ky,
    hd.ngay_ket_thuc
  FROM hop_dong hd
  JOIN nhan_vien nv ON hd.ma_nhan_vien = nv.ma_nhan_vien
  JOIN phong_ban pb ON nv.ma_phong_ban = pb.ma_phong_ban
`;

function normalizeContract(r) {
  return {
    ma_hop_dong: r.ma_hop_dong,
    ma_nhan_vien: r.ma_nhan_vien,
    ten_nhan_vien: r.ten_nhan_vien,
    ten_phong_ban: r.ten_phong_ban,
    trang_thai_nhan_vien: r.trang_thai_nhan_vien,
    loai_hop_dong: r.loai_hop_dong,
    ngay_ky: formatDateOnly(r.ngay_ky),
    ngay_ket_thuc: formatDateOnly(r.ngay_ket_thuc),
  };
}

function validateContractPayload(body) {
  const ma_nhan_vien = parseCode(body?.ma_nhan_vien, 'Nhân viên');
  const loai_hop_dong = parseRequiredText(body?.loai_hop_dong, 'Loại hợp đồng', 50);
  const ngay_ky = parseIsoDate(body?.ngay_ky, 'Ngày ký');
  const ngay_ket_thuc = parseIsoDate(body?.ngay_ket_thuc, 'Ngày kết thúc', { nullable: true });

  if (ngay_ket_thuc && ngay_ket_thuc < ngay_ky) {
    throw httpError(400, 'Ngày kết thúc phải lớn hơn hoặc bằng ngày ký');
  }

  return { ma_nhan_vien, loai_hop_dong, ngay_ky, ngay_ket_thuc };
}

export function createContractsRouter({ query = defaultQuery } = {}) {
  const router = Router();
  router.use(requireAuth);

  async function fetchOne(ma_hop_dong) {
    const rows = await query(`${SELECT_CONTRACTS_SQL} WHERE hd.ma_hop_dong = ? LIMIT 1`, [
      ma_hop_dong,
    ]);
    return rows[0] ? normalizeContract(rows[0]) : null;
  }

  router.get('/', async (req, res, next) => {
    try {
      const maNhanVien = String(req.query.ma_nhan_vien || '').trim();
      const loaiHopDong = String(req.query.loai_hop_dong || '').trim();
      const hieuLuc = String(req.query.hieu_luc || '').trim();
      const keyword = String(req.query.q || '').trim().toLowerCase();

      const rows = await query(`${SELECT_CONTRACTS_SQL} ORDER BY hd.ma_hop_dong`);
      let items = rows.map(normalizeContract);

      if (maNhanVien) {
        items = items.filter((hd) => hd.ma_nhan_vien === maNhanVien);
      }
      if (loaiHopDong) {
        items = items.filter((hd) => hd.loai_hop_dong === loaiHopDong);
      }
      if (hieuLuc === 'active') {
        items = items.filter((hd) => !hd.ngay_ket_thuc);
      } else if (hieuLuc === 'ended') {
        items = items.filter((hd) => Boolean(hd.ngay_ket_thuc));
      }
      if (keyword) {
        items = items.filter(
          (hd) =>
            hd.ma_hop_dong.toLowerCase().includes(keyword) ||
            hd.ma_nhan_vien.toLowerCase().includes(keyword) ||
            (hd.ten_nhan_vien || '').toLowerCase().includes(keyword) ||
            hd.loai_hop_dong.toLowerCase().includes(keyword)
        );
      }

      res.json(items);
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const ma_hop_dong = parseCode(req.body?.ma_hop_dong, 'Mã hợp đồng');
      const data = validateContractPayload(req.body);

      await query(
        `INSERT INTO hop_dong (ma_hop_dong, ma_nhan_vien, loai_hop_dong, ngay_ky, ngay_ket_thuc)
         VALUES (?, ?, ?, ?, ?)`,
        [ma_hop_dong, data.ma_nhan_vien, data.loai_hop_dong, data.ngay_ky, data.ngay_ket_thuc]
      );

      const created = await fetchOne(ma_hop_dong);
      res.status(201).json(created || { ma_hop_dong, ...data });
    } catch (err) {
      next(
        mapDbError(err, {
          duplicate: 'Mã hợp đồng đã tồn tại trong hệ thống',
          foreignKey: 'Nhân viên được chọn không tồn tại',
        })
      );
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const ma_hop_dong = parseCode(req.params.id, 'Mã hợp đồng');
      const data = validateContractPayload(req.body);

      const result = await query(
        `UPDATE hop_dong
         SET ma_nhan_vien = ?, loai_hop_dong = ?, ngay_ky = ?, ngay_ket_thuc = ?
         WHERE ma_hop_dong = ?`,
        [data.ma_nhan_vien, data.loai_hop_dong, data.ngay_ky, data.ngay_ket_thuc, ma_hop_dong]
      );
      if (!result?.affectedRows) {
        throw httpError(404, 'Không tìm thấy hợp đồng');
      }

      const updated = await fetchOne(ma_hop_dong);
      res.json(updated || { ma_hop_dong, ...data });
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
      const ma_hop_dong = parseCode(req.params.id, 'Mã hợp đồng');
      const result = await query('DELETE FROM hop_dong WHERE ma_hop_dong = ?', [ma_hop_dong]);
      if (!result?.affectedRows) {
        throw httpError(404, 'Không tìm thấy hợp đồng');
      }
      res.json({ ok: true });
    } catch (err) {
      next(mapDbError(err));
    }
  });

  return router;
}

export default createContractsRouter();

import { Router } from 'express';
import { query as defaultQuery } from '../db/index.js';
import { requireAuth, requireRole } from '../auth.js';
import {
  formatDateOnly,
  httpError,
  mapDbError,
  parseCode,
  parseIsoDate,
  parseNumber,
  parseRequiredText,
  unwrapCallRows,
} from '../utils/http.js';

const VALID_STATUSES = ['Đang làm việc', 'Nghỉ việc'];

const SELECT_EMPLOYEES_SQL = `
  SELECT
    nv.ma_nhan_vien,
    nv.ten_nhan_vien,
    nv.ngay_sinh,
    nv.dia_chi,
    nv.so_dien_thoai,
    pb.ma_phong_ban,
    pb.ten_phong_ban,
    cv.ma_chuc_vu,
    cv.ten_chuc_vu,
    cv.he_so_luong,
    nv.nam_vao_lam,
    fn_so_nam_lam_viec(nv.ma_nhan_vien) AS so_nam_lam_viec,
    nv.trang_thai
  FROM nhan_vien nv
  JOIN phong_ban pb ON nv.ma_phong_ban = pb.ma_phong_ban
  JOIN chuc_vu cv ON nv.ma_chuc_vu = cv.ma_chuc_vu
`;

function normalizeEmployee(r) {
  return {
    ma_nhan_vien: r.ma_nhan_vien,
    ten_nhan_vien: r.ten_nhan_vien,
    ngay_sinh: formatDateOnly(r.ngay_sinh),
    dia_chi: r.dia_chi,
    so_dien_thoai: r.so_dien_thoai,
    ma_phong_ban: r.ma_phong_ban,
    ten_phong_ban: r.ten_phong_ban,
    ma_chuc_vu: r.ma_chuc_vu,
    ten_chuc_vu: r.ten_chuc_vu,
    he_so_luong: Number(r.he_so_luong),
    nam_vao_lam: Number(r.nam_vao_lam),
    so_nam_lam_viec: Number(r.so_nam_lam_viec || 0),
    trang_thai: r.trang_thai,
  };
}

function validateEmployeePayload(body) {
  const ten_nhan_vien = parseRequiredText(body?.ten_nhan_vien, 'Họ và tên nhân viên', 100);
  const ngay_sinh = parseIsoDate(body?.ngay_sinh, 'Ngày sinh');
  const dia_chi = parseRequiredText(body?.dia_chi, 'Địa chỉ', 255);
  const so_dien_thoai = parseRequiredText(body?.so_dien_thoai, 'Số điện thoại');
  if (!/^[0-9]{10,11}$/.test(so_dien_thoai)) {
    throw httpError(400, 'Số điện thoại phải gồm từ 10 đến 11 chữ số');
  }
  const ma_phong_ban = parseCode(body?.ma_phong_ban, 'Phòng ban');
  const ma_chuc_vu = parseCode(body?.ma_chuc_vu, 'Chức vụ');
  const nam_vao_lam = parseNumber(body?.nam_vao_lam, 'Năm vào làm', {
    min: 1970,
    max: 2100,
    integer: true,
  });
  const birthYear = Number(ngay_sinh.slice(0, 4));
  if (nam_vao_lam <= birthYear) {
    throw httpError(400, 'Năm vào làm phải lớn hơn năm sinh');
  }
  const trang_thai = body?.trang_thai ? String(body.trang_thai).trim() : 'Đang làm việc';
  if (!VALID_STATUSES.includes(trang_thai)) {
    throw httpError(400, 'Trạng thái làm việc không hợp lệ');
  }

  return {
    ten_nhan_vien,
    ngay_sinh,
    dia_chi,
    so_dien_thoai,
    ma_phong_ban,
    ma_chuc_vu,
    nam_vao_lam,
    trang_thai,
  };
}

export function createEmployeesRouter({ query = defaultQuery } = {}) {
  const router = Router();
  router.use(requireAuth);

  async function fetchOne(ma_nhan_vien) {
    const rows = await query(`${SELECT_EMPLOYEES_SQL} WHERE nv.ma_nhan_vien = ? LIMIT 1`, [
      ma_nhan_vien,
    ]);
    return rows[0] ? normalizeEmployee(rows[0]) : null;
  }

  router.get('/', async (req, res, next) => {
    try {
      const tenPhongBan = String(req.query.ten_phong_ban || '').trim();
      const maPhongBan = String(req.query.ma_phong_ban || '').trim();
      const trangThai = String(req.query.trang_thai || '').trim();
      const keyword = String(req.query.q || '').trim().toLowerCase();

      let rows;
      if (tenPhongBan) {
        const spResult = await query('CALL sp_nv_theo_phong_ban(?)', [tenPhongBan]);
        rows = unwrapCallRows(spResult);
      } else {
        rows = await query(`${SELECT_EMPLOYEES_SQL} ORDER BY nv.ma_nhan_vien`);
      }

      let items = rows.map(normalizeEmployee);
      if (maPhongBan) {
        items = items.filter((nv) => nv.ma_phong_ban === maPhongBan);
      }
      if (trangThai) {
        items = items.filter((nv) => nv.trang_thai === trangThai);
      }
      if (keyword) {
        items = items.filter(
          (nv) =>
            nv.ma_nhan_vien.toLowerCase().includes(keyword) ||
            nv.ten_nhan_vien.toLowerCase().includes(keyword) ||
            nv.so_dien_thoai.toLowerCase().includes(keyword) ||
            nv.dia_chi.toLowerCase().includes(keyword)
        );
      }

      res.json(items);
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const ma_nhan_vien = parseCode(req.body?.ma_nhan_vien, 'Mã nhân viên');
      const data = validateEmployeePayload(req.body);

      await query(
        `INSERT INTO nhan_vien (
          ma_nhan_vien, ten_nhan_vien, ngay_sinh, dia_chi, so_dien_thoai,
          ma_phong_ban, ma_chuc_vu, nam_vao_lam, trang_thai
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ma_nhan_vien,
          data.ten_nhan_vien,
          data.ngay_sinh,
          data.dia_chi,
          data.so_dien_thoai,
          data.ma_phong_ban,
          data.ma_chuc_vu,
          data.nam_vao_lam,
          data.trang_thai,
        ]
      );

      const created = await fetchOne(ma_nhan_vien);
      res.status(201).json(created || { ma_nhan_vien, ...data });
    } catch (err) {
      next(
        mapDbError(err, {
          duplicate: 'Mã nhân viên đã tồn tại trong hệ thống',
          foreignKey: 'Phòng ban hoặc chức vụ được chọn không tồn tại',
        })
      );
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const ma_nhan_vien = parseCode(req.params.id, 'Mã nhân viên');
      const data = validateEmployeePayload(req.body);

      const result = await query(
        `UPDATE nhan_vien
         SET ten_nhan_vien = ?, ngay_sinh = ?, dia_chi = ?, so_dien_thoai = ?,
             ma_phong_ban = ?, ma_chuc_vu = ?, nam_vao_lam = ?, trang_thai = ?
         WHERE ma_nhan_vien = ?`,
        [
          data.ten_nhan_vien,
          data.ngay_sinh,
          data.dia_chi,
          data.so_dien_thoai,
          data.ma_phong_ban,
          data.ma_chuc_vu,
          data.nam_vao_lam,
          data.trang_thai,
          ma_nhan_vien,
        ]
      );
      if (!result?.affectedRows) {
        throw httpError(404, 'Không tìm thấy nhân viên');
      }

      const updated = await fetchOne(ma_nhan_vien);
      res.json(updated || { ma_nhan_vien, ...data });
    } catch (err) {
      next(
        mapDbError(err, {
          foreignKey: 'Phòng ban hoặc chức vụ được chọn không tồn tại',
        })
      );
    }
  });

  router.delete('/:id', requireRole('Admin'), async (req, res, next) => {
    try {
      const ma_nhan_vien = parseCode(req.params.id, 'Mã nhân viên');
      const result = await query('DELETE FROM nhan_vien WHERE ma_nhan_vien = ?', [ma_nhan_vien]);
      if (!result?.affectedRows) {
        throw httpError(404, 'Không tìm thấy nhân viên');
      }
      res.json({ ok: true });
    } catch (err) {
      next(
        mapDbError(err, {
          referenced:
            'Không thể xóa nhân viên đã phát sinh bảng lương; hãy chuyển trạng thái sang Nghỉ việc hoặc xóa bảng lương trước',
        })
      );
    }
  });

  return router;
}

export default createEmployeesRouter();

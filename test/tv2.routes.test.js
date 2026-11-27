import test from 'node:test';
import assert from 'node:assert/strict';
import { createContractsRouter } from '../src/routes/contracts.js';
import { createAttendanceRouter } from '../src/routes/attendance.js';
import { ADMIN_TOKEN, HR_TOKEN, buildTestApp, withServer } from './helpers.js';

test('contracts router validates date ordering, invalid calendar dates, and filtering', async () => {
  const mockQuery = async (sql) => {
    if (sql.includes('FROM hop_dong')) {
      return [
        {
          ma_hop_dong: 'HD01',
          ma_nhan_vien: 'NV01',
          ten_nhan_vien: 'Nguyễn Văn An',
          ten_phong_ban: 'Kỹ thuật',
          trang_thai_nhan_vien: 'Đang làm việc',
          loai_hop_dong: 'Không thời hạn',
          ngay_ky: '2020-03-01',
          ngay_ket_thuc: null,
        },
        {
          ma_hop_dong: 'HD06',
          ma_nhan_vien: 'NV06',
          ten_nhan_vien: 'Đặng Thu Hà',
          ten_phong_ban: 'Kinh doanh',
          trang_thai_nhan_vien: 'Nghỉ việc',
          loai_hop_dong: 'Thử việc',
          ngay_ky: '2024-02-01',
          ngay_ket_thuc: '2026-10-31',
        },
      ];
    }
    return { affectedRows: 1 };
  };

  const app = buildTestApp((a) => {
    a.use('/api/v1/contracts', createContractsRouter({ query: mockQuery }));
  });

  await withServer(app, async (req) => {
    const endedList = await req('/api/v1/contracts?hieu_luc=ended', { token: HR_TOKEN });
    assert.equal(endedList.status, 200);
    assert.equal(endedList.data.length, 1);
    assert.equal(endedList.data[0].ma_hop_dong, 'HD06');

    const badOrder = await req('/api/v1/contracts', {
      method: 'POST',
      token: HR_TOKEN,
      body: {
        ma_hop_dong: 'HD07',
        ma_nhan_vien: 'NV01',
        loai_hop_dong: 'Có thời hạn',
        ngay_ky: '2024-02-01',
        ngay_ket_thuc: '2024-01-01',
      },
    });
    assert.equal(badOrder.status, 400);

    const badCalendar = await req('/api/v1/contracts', {
      method: 'POST',
      token: HR_TOKEN,
      body: {
        ma_hop_dong: 'HD07',
        ma_nhan_vien: 'NV01',
        loai_hop_dong: 'Có thời hạn',
        ngay_ky: '2024-02-30',
        ngay_ket_thuc: null,
      },
    });
    assert.equal(badCalendar.status, 400);

    const okNullEnd = await req('/api/v1/contracts', {
      method: 'POST',
      token: HR_TOKEN,
      body: {
        ma_hop_dong: 'HD07',
        ma_nhan_vien: 'NV01',
        loai_hop_dong: 'Không thời hạn',
        ngay_ky: '2024-02-01',
        ngay_ket_thuc: null,
      },
    });
    assert.equal(okNullEnd.status, 201);
  });
});

test('attendance router validates day sum <= 31 and recalculates linked salary inside transaction', async () => {
  const txCalls = [];
  const mockQuery = async (sql) => {
    if (sql.includes('FROM cham_cong cc')) {
      return [
        {
          ma_cham_cong: 'CC02',
          ma_nhan_vien: 'NV02',
          ten_nhan_vien: 'Trần Thị Bình',
          ma_phong_ban: 'PB01',
          ten_phong_ban: 'Kỹ thuật',
          ten_chuc_vu: 'Chuyên viên',
          he_so_luong: '1.60',
          so_ngay_lam_viec: 26,
          so_ngay_nghi: 0,
          ma_luong: 'L02',
          thang_tinh_luong: 10,
          nam_tinh_luong: 2026,
        },
      ];
    }
    return { affectedRows: 1 };
  };

  const mockWithTransaction = async (fn) => {
    const q = async (sql, params) => {
      txCalls.push({ sql, params });
      if (sql.trimStart().startsWith('UPDATE cham_cong')) {
        return { affectedRows: 1 };
      }
      if (sql.trimStart().startsWith('UPDATE luong')) {
        return { affectedRows: 1 };
      }
      return [];
    };
    return fn(q);
  };

  const app = buildTestApp((a) => {
    a.use(
      '/api/v1/attendance',
      createAttendanceRouter({ query: mockQuery, withTransaction: mockWithTransaction })
    );
  });

  await withServer(app, async (req) => {
    const tooManyDays = await req('/api/v1/attendance', {
      method: 'POST',
      token: HR_TOKEN,
      body: {
        ma_cham_cong: 'CC07',
        ma_nhan_vien: 'NV02',
        so_ngay_lam_viec: 25,
        so_ngay_nghi: 10,
      },
    });
    assert.equal(tooManyDays.status, 400);

    const updated = await req('/api/v1/attendance/CC02', {
      method: 'PUT',
      token: HR_TOKEN,
      body: {
        ma_nhan_vien: 'NV02',
        so_ngay_lam_viec: 26,
        so_ngay_nghi: 0,
      },
    });
    assert.equal(updated.status, 200);
    const salaryUpdate = txCalls.find((c) => c.sql.trimStart().startsWith('UPDATE luong'));
    assert.ok(salaryUpdate, 'expected linked salary to be recalculated');
    assert.match(salaryUpdate.sql, /fn_tinh_tong_luong\s*\(/);
    assert.deepEqual(salaryUpdate.params, ['CC02']);
  });
});

test('DELETE /attendance/:id enforces Admin role and returns 409 when referenced by salary', async () => {
  const mockQuery = async () => {
    const err = new Error('FK');
    err.code = 'ER_ROW_IS_REFERENCED_2';
    throw err;
  };
  const app = buildTestApp((a) => {
    a.use('/api/v1/attendance', createAttendanceRouter({ query: mockQuery }));
  });

  await withServer(app, async (req) => {
    const hrDel = await req('/api/v1/attendance/CC01', { method: 'DELETE', token: HR_TOKEN });
    assert.equal(hrDel.status, 403);

    const adminDel = await req('/api/v1/attendance/CC01', { method: 'DELETE', token: ADMIN_TOKEN });
    assert.equal(adminDel.status, 409);
    assert.match(adminDel.data.error, /lương/);
  });
});

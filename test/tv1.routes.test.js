import test from 'node:test';
import assert from 'node:assert/strict';
import { createDepartmentsRouter } from '../src/routes/departments.js';
import { createPositionsRouter } from '../src/routes/positions.js';
import { createEmployeesRouter } from '../src/routes/employees.js';
import { ADMIN_TOKEN, HR_TOKEN, buildTestApp, withServer } from './helpers.js';

test('departments & positions enforce Admin role on writes while allowing HR reads', async () => {
  const calls = [];
  const mockQuery = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('FROM phong_ban')) {
      return [{ ma_phong_ban: 'PB01', ten_phong_ban: 'Kỹ thuật', so_nhan_vien: '2' }];
    }
    if (sql.includes('FROM chuc_vu')) {
      return [{ ma_chuc_vu: 'CV01', ten_chuc_vu: 'Trưởng phòng', he_so_luong: '2.50', so_nhan_vien: '1' }];
    }
    return { affectedRows: 1 };
  };

  const app = buildTestApp((a) => {
    a.use('/api/v1/departments', createDepartmentsRouter({ query: mockQuery }));
    a.use('/api/v1/positions', createPositionsRouter({ query: mockQuery }));
  });

  await withServer(app, async (req) => {
    const depList = await req('/api/v1/departments', { token: HR_TOKEN });
    assert.equal(depList.status, 200);
    assert.deepEqual(depList.data, [
      { ma_phong_ban: 'PB01', ten_phong_ban: 'Kỹ thuật', so_nhan_vien: 2 },
    ]);

    const posList = await req('/api/v1/positions', { token: HR_TOKEN });
    assert.equal(posList.status, 200);
    assert.deepEqual(posList.data, [
      { ma_chuc_vu: 'CV01', ten_chuc_vu: 'Trưởng phòng', he_so_luong: 2.5, so_nhan_vien: 1 },
    ]);

    const hrCreateDep = await req('/api/v1/departments', {
      method: 'POST',
      token: HR_TOKEN,
      body: { ma_phong_ban: 'PB05', ten_phong_ban: 'Pháp chế' },
    });
    assert.equal(hrCreateDep.status, 403);

    const hrDelPos = await req('/api/v1/positions/CV01', {
      method: 'DELETE',
      token: HR_TOKEN,
    });
    assert.equal(hrDelPos.status, 403);

    const adminCreatePos = await req('/api/v1/positions', {
      method: 'POST',
      token: ADMIN_TOKEN,
      body: { ma_chuc_vu: 'CV05', ten_chuc_vu: 'Phó phòng', he_so_luong: '2.0' },
    });
    assert.equal(adminCreatePos.status, 201);
    assert.equal(adminCreatePos.data.he_so_luong, 2);
  });
});

test('DELETE /departments/:id maps ER_ROW_IS_REFERENCED_2 to 409 conflict', async () => {
  const mockQuery = async () => {
    const err = new Error('FK constraint');
    err.code = 'ER_ROW_IS_REFERENCED_2';
    throw err;
  };
  const app = buildTestApp((a) => {
    a.use('/api/v1/departments', createDepartmentsRouter({ query: mockQuery }));
  });

  await withServer(app, async (req) => {
    const res = await req('/api/v1/departments/PB01', { method: 'DELETE', token: ADMIN_TOKEN });
    assert.equal(res.status, 409);
    assert.match(res.data.error, /nhân viên/);
  });
});

test('GET /employees with ten_phong_ban calls sp_nv_theo_phong_ban, normalizes types, and filters q', async () => {
  let calledSp = false;
  const mockQuery = async (sql, params) => {
    if (sql.includes('CALL sp_nv_theo_phong_ban')) {
      calledSp = true;
      assert.deepEqual(params, ['Kỹ thuật']);
      return [
        [
          {
            ma_nhan_vien: 'NV01',
            ten_nhan_vien: 'Nguyễn Văn An',
            ngay_sinh: new Date(1994, 4, 12),
            dia_chi: 'Cần Thơ',
            so_dien_thoai: '0901234561',
            ma_phong_ban: 'PB01',
            ten_phong_ban: 'Kỹ thuật',
            ma_chuc_vu: 'CV01',
            ten_chuc_vu: 'Trưởng phòng',
            he_so_luong: '2.50',
            nam_vao_lam: '2020',
            so_nam_lam_viec: '6',
            trang_thai: 'Đang làm việc',
          },
          {
            ma_nhan_vien: 'NV02',
            ten_nhan_vien: 'Trần Thị Bình',
            ngay_sinh: '1997-08-20',
            dia_chi: 'Vĩnh Long',
            so_dien_thoai: '0901234562',
            ma_phong_ban: 'PB01',
            ten_phong_ban: 'Kỹ thuật',
            ma_chuc_vu: 'CV02',
            ten_chuc_vu: 'Chuyên viên',
            he_so_luong: '1.60',
            nam_vao_lam: 2022,
            so_nam_lam_viec: 4,
            trang_thai: 'Đang làm việc',
          },
        ],
        { affectedRows: 0 },
      ];
    }
    return [];
  };

  const app = buildTestApp((a) => {
    a.use('/api/v1/employees', createEmployeesRouter({ query: mockQuery }));
  });

  await withServer(app, async (req) => {
    const res = await req('/api/v1/employees?ten_phong_ban=K%E1%BB%B9%20thu%E1%BA%ADt&q=An', {
      token: HR_TOKEN,
    });
    assert.equal(res.status, 200);
    assert.equal(calledSp, true);
    assert.equal(res.data.length, 1);
    assert.equal(res.data[0].ma_nhan_vien, 'NV01');
    assert.equal(res.data[0].ngay_sinh, '1994-05-12');
    assert.equal(res.data[0].he_so_luong, 2.5);
    assert.equal(res.data[0].so_nam_lam_viec, 6);
  });
});

test('employees router validates phone/date on POST, exercises fetchOne, allows HR PUT, returns 404 when missing, and blocks HR DELETE', async () => {
  const mockQuery = async (sql, params) => {
    if (sql.trimStart().startsWith('SELECT')) {
      return [
        {
          ma_nhan_vien: 'NV07',
          ten_nhan_vien: 'Lê Minh Tuấn',
          ngay_sinh: new Date(1998, 2, 15),
          dia_chi: 'Cần Thơ',
          so_dien_thoai: '0912345678',
          ma_phong_ban: 'PB01',
          ten_phong_ban: 'Kỹ thuật',
          ma_chuc_vu: 'CV03',
          ten_chuc_vu: 'Nhân viên',
          he_so_luong: '1.20',
          nam_vao_lam: '2025',
          so_nam_lam_viec: '1',
          trang_thai: 'Đang làm việc',
        },
      ];
    }
    if (sql.trimStart().startsWith('UPDATE') && params[params.length - 1] === 'NV_MISSING') {
      return { affectedRows: 0 };
    }
    return { affectedRows: 1 };
  };

  const app = buildTestApp((a) => {
    a.use('/api/v1/employees', createEmployeesRouter({ query: mockQuery }));
  });

  await withServer(app, async (req) => {
    for (const invalidPhone of ['123abc', '091234567', '091234567890']) {
      const badPhone = await req('/api/v1/employees', {
        method: 'POST',
        token: HR_TOKEN,
        body: {
          ma_nhan_vien: 'NV07',
          ten_nhan_vien: 'Lê Minh Tuấn',
          ngay_sinh: '1998-03-15',
          dia_chi: 'Cần Thơ',
          so_dien_thoai: invalidPhone,
          ma_phong_ban: 'PB01',
          ma_chuc_vu: 'CV03',
          nam_vao_lam: 2025,
        },
      });
      assert.equal(badPhone.status, 400);
    }

    const updated11Digits = await req('/api/v1/employees/NV07', {
      method: 'PUT',
      token: HR_TOKEN,
      body: {
        ten_nhan_vien: 'Lê Minh Tuấn',
        ngay_sinh: '1998-03-15',
        dia_chi: 'Cần Thơ',
        so_dien_thoai: '09123456789',
        ma_phong_ban: 'PB01',
        ma_chuc_vu: 'CV03',
        nam_vao_lam: 2025,
      },
    });
    assert.equal(updated11Digits.status, 200);

    const created = await req('/api/v1/employees', {
      method: 'POST',
      token: HR_TOKEN,
      body: {
        ma_nhan_vien: 'NV07',
        ten_nhan_vien: 'Lê Minh Tuấn',
        ngay_sinh: '1998-03-15',
        dia_chi: 'Cần Thơ',
        so_dien_thoai: '0912345678',
        ma_phong_ban: 'PB01',
        ma_chuc_vu: 'CV03',
        nam_vao_lam: 2025,
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.ma_nhan_vien, 'NV07');
    assert.equal(created.data.he_so_luong, 1.2);
    assert.equal(created.data.ngay_sinh, '1998-03-15');

    const missingPut = await req('/api/v1/employees/NV_MISSING', {
      method: 'PUT',
      token: HR_TOKEN,
      body: {
        ten_nhan_vien: 'Lê Minh Tuấn',
        ngay_sinh: '1998-03-15',
        dia_chi: 'Cần Thơ',
        so_dien_thoai: '0912345678',
        ma_phong_ban: 'PB01',
        ma_chuc_vu: 'CV03',
        nam_vao_lam: 2025,
      },
    });
    assert.equal(missingPut.status, 404);

    const hrDel = await req('/api/v1/employees/NV07', {
      method: 'DELETE',
      token: HR_TOKEN,
    });
    assert.equal(hrDel.status, 403);
  });
});

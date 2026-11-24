import test from 'node:test';
import assert from 'node:assert/strict';
import { createSalariesRouter } from '../src/routes/salaries.js';
import { createStatisticsRouter } from '../src/routes/statistics.js';
import { createApp } from '../src/index.js';
import { HR_TOKEN, buildTestApp, withServer } from './helpers.js';

test('salaries router computes authoritative tong_luong and validates inputs', async () => {
  let insertedParams = null;
  const mockQuery = async (sql, params) => {
    if (sql.includes('FROM cham_cong cc') && sql.includes('WHERE cc.ma_cham_cong = ?')) {
      if (params[0] === 'CC_MISSING') return [];
      return [{ so_ngay_lam_viec: 24, he_so_luong: '1.60' }];
    }
    if (sql.startsWith('INSERT INTO luong')) {
      if (params[0] === 'L_DUP') {
        const err = new Error('Duplicate');
        err.code = 'ER_DUP_ENTRY';
        throw err;
      }
      insertedParams = params;
      return { affectedRows: 1 };
    }
    if (sql.includes('FROM luong l')) {
      return [
        {
          ma_luong: 'L02',
          ma_cham_cong: 'CC02',
          thang_tinh_luong: 10,
          nam_tinh_luong: 2026,
          luong_can_ban: '8000000.00',
          phu_cap: '1000000.00',
          tong_luong: '12815385.00',
          ma_nhan_vien: 'NV02',
          ten_nhan_vien: 'Trần Thị Bình',
          ma_phong_ban: 'PB01',
          ten_phong_ban: 'Kỹ thuật',
          ten_chuc_vu: 'Chuyên viên',
          he_so_luong: '1.60',
          so_ngay_lam_viec: 24,
          so_ngay_nghi: 2,
        },
      ];
    }
    return [];
  };

  const app = buildTestApp((a) => {
    a.use('/api/v1/salaries', createSalariesRouter({ query: mockQuery }));
  });

  await withServer(app, async (req) => {
    const created = await req('/api/v1/salaries', {
      method: 'POST',
      token: HR_TOKEN,
      body: {
        ma_luong: 'L02',
        ma_cham_cong: 'CC02',
        thang_tinh_luong: 10,
        nam_tinh_luong: 2026,
        luong_can_ban: 8000000,
        phu_cap: 1000000,
        tong_luong: 1,
      },
    });
    assert.equal(created.status, 201);
    assert.equal(insertedParams[6], 12815385);
    assert.equal(created.data.tong_luong, 12815385);
    assert.equal(typeof created.data.luong_can_ban, 'number');

    const badMonth = await req('/api/v1/salaries', {
      method: 'POST',
      token: HR_TOKEN,
      body: {
        ma_luong: 'L07',
        ma_cham_cong: 'CC02',
        thang_tinh_luong: 13,
        nam_tinh_luong: 2026,
        luong_can_ban: 8000000,
        phu_cap: 0,
      },
    });
    assert.equal(badMonth.status, 400);

    const badAmount = await req('/api/v1/salaries', {
      method: 'POST',
      token: HR_TOKEN,
      body: {
        ma_luong: 'L07',
        ma_cham_cong: 'CC02',
        thang_tinh_luong: 10,
        nam_tinh_luong: 2026,
        luong_can_ban: 'abc',
        phu_cap: 0,
      },
    });
    assert.equal(badAmount.status, 400);

    const dup = await req('/api/v1/salaries', {
      method: 'POST',
      token: HR_TOKEN,
      body: {
        ma_luong: 'L_DUP',
        ma_cham_cong: 'CC02',
        thang_tinh_luong: 10,
        nam_tinh_luong: 2026,
        luong_can_ban: 8000000,
        phu_cap: 0,
      },
    });
    assert.equal(dup.status, 409);
  });
});

test('GET /statistics calls sp_thong_ke_luong and casts DECIMAL aggregates to Number', async () => {
  let spArgs = null;
  const mockQuery = async (sql, params) => {
    if (sql.includes('DISTINCT nam_tinh_luong')) {
      return [{ nam_tinh_luong: 2026 }, { nam_tinh_luong: 2025 }];
    }
    if (sql.includes('FROM nhan_vien') && sql.includes('dang_lam_viec')) {
      return [{ tong_nhan_vien: '6', dang_lam_viec: '5', nghi_viec: '1' }];
    }
    if (sql.includes('COUNT(*) AS tong_phong_ban')) {
      return [{ tong_phong_ban: '4' }];
    }
    if (sql.includes('FROM hop_dong') && sql.includes('hop_dong_hieu_luc')) {
      return [{ hop_dong_hieu_luc: '5', hop_dong_ket_thuc: '1' }];
    }
    if (sql.includes('CALL sp_thong_ke_luong')) {
      spArgs = params;
      return [
        [
          {
            ma_phong_ban: 'PB01',
            ten_phong_ban: 'Kỹ thuật',
            so_nhan_vien: '2',
            so_ky_luong: '2',
            tong_quy_luong: '39815385.00',
            luong_trung_binh: '19907693',
            luong_cao_nhat: '27000000.00',
            luong_thap_nhat: '12815385.00',
          },
        ],
        { affectedRows: 0 },
      ];
    }
    if (sql.includes('SUM(l.tong_luong)')) {
      return [{ tong_quy_luong: '39815385.00', luong_trung_binh: '19907693' }];
    }
    return [];
  };

  const app = buildTestApp((a) => {
    a.use('/api/v1/statistics', createStatisticsRouter({ query: mockQuery }));
  });

  await withServer(app, async (req) => {
    const res = await req('/api/v1/statistics?nam=2026', { token: HR_TOKEN });
    assert.equal(res.status, 200);
    assert.deepEqual(spArgs, [2026, null]);
    assert.deepEqual(res.data.years, [2026, 2025]);
    assert.equal(res.data.summary.tong_nhan_vien, 6);
    assert.equal(res.data.byDepartment[0].tong_quy_luong, 39815385);
    assert.equal(typeof res.data.byDepartment[0].tong_quy_luong, 'number');
  });
});

test('createApp mounts all 7 HRM module endpoints protected by requireAuth', async () => {
  const fullApp = createApp({ query: async () => [] });
  const paths = [
    '/api/v1/departments',
    '/api/v1/positions',
    '/api/v1/employees',
    '/api/v1/contracts',
    '/api/v1/attendance',
    '/api/v1/salaries',
    '/api/v1/statistics',
  ];

  await withServer(fullApp, async (req) => {
    for (const p of paths) {
      const unauth = await req(p, { token: null });
      assert.equal(unauth.status, 401, `expected 401 without token on ${p}`);
    }
  });
});

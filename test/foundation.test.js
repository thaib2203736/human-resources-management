import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  requireAuth,
  requireRole,
} from '../src/auth.js';
import { runTransaction } from '../src/db/index.js';
import {
  parseCode,
  parseIsoDate,
  formatDateOnly,
  parseNumber,
  unwrapCallRows,
  computeTotalSalary,
  mapDbError,
} from '../src/utils/http.js';
import { toCsvString } from '../web/src/lib/export.js';

test('hashPassword & verifyPassword handle valid, wrong, and malformed hashes', () => {
  const stored = hashPassword('admin123');
  assert.equal(verifyPassword('admin123', stored), true);
  assert.equal(verifyPassword('wrong', stored), false);
  assert.equal(verifyPassword('admin123', 'malformed'), false);
});

test('signToken & verifyToken reject tampered and expired tokens', () => {
  const token = signToken({ id: 1, username: 'admin', vai_tro: 'Admin' }, 60);
  const decoded = verifyToken(token);
  assert.equal(decoded.username, 'admin');

  const tampered = `${token.slice(0, -1)}x`;
  assert.equal(verifyToken(tampered), null);

  const expired = signToken({ id: 1 }, -10);
  assert.equal(verifyToken(expired), null);
});

test('requireAuth returns 401 without Bearer token and passes with valid token', () => {
  let statusCode = null;
  let body = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      body = data;
      return this;
    },
  };

  requireAuth({ headers: {} }, res, () => assert.fail('should not call next'));
  assert.equal(statusCode, 401);
  assert.ok(body.error);

  const token = signToken({ id: 2, username: 'hr' }, 60);
  const req = { headers: { authorization: `Bearer ${token}` } };
  let called = false;
  requireAuth(req, res, () => {
    called = true;
  });
  assert.equal(called, true);
  assert.equal(req.user.username, 'hr');
});

test('runTransaction commits on success and rolls back on error', async () => {
  const events = [];
  const makeConn = () => ({
    beginTransaction: async () => { events.push('begin'); },
    query: async (sql) => { events.push(sql); return [[{ ok: true }], []]; },
    commit: async () => { events.push('commit'); },
    rollback: async () => { events.push('rollback'); },
    release: () => { events.push('release'); },
  });

  const out = await runTransaction(async () => makeConn(), async (q) => {
    const rows = await q('INSERT 1');
    assert.deepEqual(rows, [{ ok: true }]);
    return 'done';
  });
  assert.equal(out, 'done');
  assert.deepEqual(events, ['begin', 'INSERT 1', 'commit', 'release']);

  events.length = 0;
  await assert.rejects(
    () =>
      runTransaction(async () => makeConn(), async (q) => {
        await q('INSERT 2');
        throw new Error('boom');
      }),
    /boom/
  );
  assert.deepEqual(events, ['begin', 'INSERT 2', 'rollback', 'release']);
});

test('toCsvString includes UTF-8 BOM and escapes commas, quotes, and newlines', () => {
  const csv = toCsvString(['Mã', 'Ghi chú'], [['NV01', 'Phòng "IT", tầng 2\nmới']]);
  assert.equal(csv.startsWith('\uFEFF'), true);
  assert.equal(csv, '\uFEFFMã,Ghi chú\r\nNV01,"Phòng ""IT"", tầng 2\nmới"');
});

test('requireRole returns 403 for non-matching role and passes for allowed role', () => {
  const mw = requireRole('Admin');
  let statusCode = null;
  let body = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      body = data;
      return this;
    },
  };

  mw({ user: { username: 'hr', vai_tro: 'HR' } }, res, () => assert.fail('should not pass HR'));
  assert.equal(statusCode, 403);
  assert.match(body.error, /Admin/);

  let passed = false;
  mw({ user: { username: 'admin', vai_tro: 'Admin' } }, res, () => {
    passed = true;
  });
  assert.equal(passed, true);
});

test('parseIsoDate validates real calendar dates and supports nullable dates', () => {
  assert.equal(parseIsoDate('2026-02-28', 'Ngày ký'), '2026-02-28');
  assert.equal(parseIsoDate('', 'Ngày kết thúc', { nullable: true }), null);
  assert.equal(parseIsoDate(null, 'Ngày kết thúc', { nullable: true }), null);

  assert.throws(() => parseIsoDate('2026-02-30', 'Ngày sinh'), (err) => err.status === 400);
  assert.throws(() => parseIsoDate('2026/02/28', 'Ngày sinh'), (err) => err.status === 400);
  assert.throws(() => parseIsoDate('not-a-date', 'Ngày sinh'), (err) => err.status === 400);
});

test('formatDateOnly normalizes Date objects and ISO strings without UTC shift', () => {
  assert.equal(formatDateOnly('1994-05-12'), '1994-05-12');
  assert.equal(formatDateOnly(new Date(1994, 4, 12)), '1994-05-12');
  assert.equal(formatDateOnly(null), null);
});

test('parseCode and parseNumber reject blank, NaN, and out-of-range inputs', () => {
  assert.equal(parseCode('  NV01 ', 'Mã nhân viên'), 'NV01');
  assert.throws(() => parseCode('   ', 'Mã nhân viên'), (err) => err.status === 400);
  assert.throws(() => parseCode('A'.repeat(21), 'Mã nhân viên'), (err) => err.status === 400);

  assert.equal(parseNumber('2.50', 'Hệ số lương', { min: 0, exclusiveMin: true }), 2.5);
  assert.throws(() => parseNumber('', 'Lương căn bản'), (err) => err.status === 400);
  assert.throws(() => parseNumber('abc', 'Lương căn bản'), (err) => err.status === 400);
  assert.throws(() => parseNumber(-1, 'Phụ cấp', { min: 0 }), (err) => err.status === 400);
  assert.throws(
    () => parseNumber(0, 'Hệ số lương', { min: 0, exclusiveMin: true }),
    (err) => err.status === 400
  );
  assert.throws(
    () => parseNumber(2.5, 'Số ngày làm việc', { integer: true }),
    (err) => err.status === 400
  );
});

test('computeTotalSalary matches seed.sql payroll values and unwrapCallRows extracts SP rows', () => {
  assert.equal(
    computeTotalSalary({
      luong_can_ban: 10000000,
      he_so_luong: 2.5,
      so_ngay_lam_viec: 26,
      phu_cap: 2000000,
    }),
    27000000
  );
  assert.equal(
    computeTotalSalary({
      luong_can_ban: '8000000',
      he_so_luong: '1.60',
      so_ngay_lam_viec: 24,
      phu_cap: '1000000',
    }),
    12815385
  );
  assert.deepEqual(unwrapCallRows([[{ id: 1 }], { affectedRows: 0 }]), [{ id: 1 }]);
  assert.deepEqual(unwrapCallRows([{ id: 2 }]), [{ id: 2 }]);
});

test('mapDbError maps duplicate, referenced, foreign key, and check errors cleanly', () => {
  const dup = mapDbError({ code: 'ER_DUP_ENTRY' }, { duplicate: 'Trùng mã' });
  assert.equal(dup.status, 409);
  assert.equal(dup.message, 'Trùng mã');

  const ref = mapDbError({ code: 'ER_ROW_IS_REFERENCED_2' });
  assert.equal(ref.status, 409);

  const fk = mapDbError({ code: 'ER_NO_REFERENCED_ROW_2' });
  assert.equal(fk.status, 400);

  const chk = mapDbError({ errno: 3819 });
  assert.equal(chk.status, 400);
});

test('db/index.js and auth.js load env.js before reading process.env in ESM', () => {
  const dbSrc = fs.readFileSync(new URL('../src/db/index.js', import.meta.url), 'utf8');
  const authSrc = fs.readFileSync(new URL('../src/auth.js', import.meta.url), 'utf8');
  assert.match(dbSrc, /^import '\.\.\/env\.js';/);
  assert.match(authSrc, /^import '\.\/env\.js';/);
});

test('schema.sql defines fn_tinh_tong_luong stored function', () => {
  const schemaSrc = fs.readFileSync(new URL('../src/db/schema.sql', import.meta.url), 'utf8');
  assert.match(schemaSrc, /CREATE FUNCTION fn_tinh_tong_luong\s*\(/);
});

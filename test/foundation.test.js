import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, signToken, verifyToken, requireAuth } from '../src/auth.js';
import { runTransaction } from '../src/db/index.js';
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

import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { apiFetch, getSession, onUnauthorized, setSession } from '../web/src/lib/api.js';
import {
  calculateSalaryTotal,
  formatCurrency,
  formatDate,
  suggestNextCode,
  todayIsoDate,
} from '../web/src/lib/format.js';

test('formatDate, formatCurrency, suggestNextCode, and calculateSalaryTotal behave accurately', () => {
  assert.equal(formatDate('2026-10-31'), '31/10/2026');
  assert.equal(formatDate(null), '—');
  assert.equal(formatDate(''), '—');

  const money = formatCurrency(27000000);
  assert.match(money, /27[.,]000[.,]000/);
  assert.match(money, /₫/);

  assert.equal(suggestNextCode('NV', ['NV01', 'NV06', 'NV02']), 'NV07');
  assert.equal(suggestNextCode('PB', []), 'PB01');
  assert.equal(suggestNextCode('HD', ['HD09', 'HD10']), 'HD11');

  assert.equal(
    calculateSalaryTotal({
      luongCanBan: 8000000,
      heSoLuong: 1.6,
      soNgayLamViec: 24,
      phuCap: 1000000,
    }),
    12815385
  );
});

test('apiFetch triggers onUnauthorized on protected 401 but not on /auth/login 401', async () => {
  const store = new Map();
  const prevFetch = globalThis.fetch;

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
  });

  let unauthorizedCount = 0;
  const unsubscribe = onUnauthorized(() => {
    unauthorizedCount += 1;
  });

  try {
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Sai tên đăng nhập hoặc mật khẩu' }),
    });

    await assert.rejects(
      () => apiFetch('/api/v1/auth/login', { method: 'POST', body: '{}' }),
      /Sai tên đăng nhập/
    );
    assert.equal(unauthorizedCount, 0);

    setSession({ token: 'tok', user: { username: 'hr', vai_tro: 'HR' } });
    assert.ok(getSession());

    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Phiên đăng nhập hết hạn' }),
    });

    await assert.rejects(() => apiFetch('/api/v1/employees'), /hết hạn/);
    assert.equal(unauthorizedCount, 1);
    assert.equal(getSession(), null);
  } finally {
    unsubscribe();
    globalThis.fetch = prevFetch;
  }
});

test('todayIsoDate uses local calendar components rather than UTC slice', () => {
  const localEarlyMorning = {
    getFullYear: () => 2026,
    getMonth: () => 10, // November (0-indexed)
    getDate: () => 24,
  };
  assert.equal(todayIsoDate(localEarlyMorning), '2026-11-24');
});

test('SalariesPage allows arbitrary VND amounts and print CSS prevents table clipping', () => {
  const salariesSrc = fs.readFileSync(
    new URL('../web/src/pages/SalariesPage.jsx', import.meta.url),
    'utf8'
  );
  assert.equal(
    salariesSrc.includes('step="100000"'),
    false,
    'SalariesPage inputs must not block non-100k VND amounts with step="100000"'
  );

  const contractsSrc = fs.readFileSync(
    new URL('../web/src/pages/ContractsPage.jsx', import.meta.url),
    'utf8'
  );
  assert.equal(
    contractsSrc.includes('toISOString().slice(0, 10)'),
    false,
    'ContractsPage must use local todayIsoDate instead of UTC toISOString'
  );

  const cssSrc = fs.readFileSync(new URL('../web/src/index.css', import.meta.url), 'utf8');
  assert.match(cssSrc, /\[data-slot="card"\][\s\S]*overflow:\s*visible\s*!important/);
});

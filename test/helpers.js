import express from 'express';
import { signToken } from '../src/auth.js';

export const ADMIN_TOKEN = signToken({
  id: 1,
  username: 'admin',
  ho_ten: 'Quản trị viên',
  vai_tro: 'Admin',
});

export const HR_TOKEN = signToken({
  id: 2,
  username: 'hr',
  ho_ten: 'Nhân sự',
  vai_tro: 'HR',
});

export function buildTestApp(mountFn) {
  const app = express();
  app.use(express.json());
  mountFn(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Lỗi máy chủ' });
  });
  return app;
}

export async function withServer(app, fn) {
  const server = await new Promise((resolve, reject) => {
    const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
    srv.on('error', reject);
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  async function request(path, { method = 'GET', token = ADMIN_TOKEN, body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  try {
    return await fn(request);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

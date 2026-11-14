import { pathToFileURL } from 'node:url';
import express from 'express';
import { query } from './db/index.js';
import authRouter from './routes/auth.js';

try {
  process.loadEnvFile();
} catch {
  // Không bắt buộc có .env nếu biến môi trường đã được truyền từ shell/container
}

export const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/api/v1/health', async (_req, res, next) => {
  try {
    await query('SELECT 1 AS ok');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.use('/api/v1/auth', authRouter);

// Các thành viên gắn router theo từng module tại đây (bảo vệ bằng requireAuth):
// TV1: /api/v1/departments, /api/v1/positions, /api/v1/employees
// TV2: /api/v1/contracts, /api/v1/attendance
// TV3: /api/v1/salaries, /api/v1/statistics

app.use((_req, res) => {
  res.status(404).json({ error: 'Không tìm thấy endpoint' });
});

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Lỗi máy chủ' });
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(port, () => {
    console.log(`HRM API listening on port ${port}`);
  });
}

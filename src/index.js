import './env.js';
import { pathToFileURL } from 'node:url';
import express from 'express';
import { query as defaultQuery, withTransaction as defaultWithTransaction } from './db/index.js';
import authRouter from './routes/auth.js';
import { createDepartmentsRouter } from './routes/departments.js';
import { createPositionsRouter } from './routes/positions.js';
import { createEmployeesRouter } from './routes/employees.js';
import { createContractsRouter } from './routes/contracts.js';
import { createAttendanceRouter } from './routes/attendance.js';
import { createSalariesRouter } from './routes/salaries.js';
import { createStatisticsRouter } from './routes/statistics.js';

export function createApp({ query = defaultQuery, withTransaction = defaultWithTransaction } = {}) {
  const instance = express();

  instance.use(express.json());

  instance.get('/api/v1/health', async (_req, res, next) => {
    try {
      await query('SELECT 1 AS ok');
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  instance.use('/api/v1/auth', authRouter);

  // TV1: Phòng ban, Chức vụ, Nhân viên
  instance.use('/api/v1/departments', createDepartmentsRouter({ query }));
  instance.use('/api/v1/positions', createPositionsRouter({ query }));
  instance.use('/api/v1/employees', createEmployeesRouter({ query }));

  // TV2: Hợp đồng, Chấm công
  instance.use('/api/v1/contracts', createContractsRouter({ query }));
  instance.use('/api/v1/attendance', createAttendanceRouter({ query, withTransaction }));

  // TV3: Lương, Thống kê
  instance.use('/api/v1/salaries', createSalariesRouter({ query }));
  instance.use('/api/v1/statistics', createStatisticsRouter({ query }));

  instance.use((_req, res) => {
    res.status(404).json({ error: 'Không tìm thấy endpoint' });
  });

  instance.use((err, _req, res, _next) => {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Lỗi máy chủ' });
  });

  return instance;
}

export const app = createApp();
const port = process.env.PORT || 3000;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(port, () => {
    console.log(`HRM API listening on port ${port}`);
  });
}

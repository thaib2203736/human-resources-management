import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DATABASE_HOST || 'localhost',
  port: Number(process.env.DATABASE_PORT) || 3306,
  user: process.env.DATABASE_USER || 'admin',
  password: process.env.DATABASE_PASSWORD || 'password',
  database: process.env.DATABASE_NAME || 'hrm',
  charset: 'utf8mb4',
});

export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function runTransaction(getConnection, fn) {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const txQuery = async (sql, params = []) => {
      const [rows] = await conn.query(sql, params);
      return rows;
    };
    const result = await fn(txQuery);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // Giữ lại lỗi gốc
    }
    throw err;
  } finally {
    conn.release();
  }
}

export function withTransaction(fn) {
  return runTransaction(() => pool.getConnection(), fn);
}

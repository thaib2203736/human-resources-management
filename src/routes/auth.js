import { Router } from 'express';
import { query } from '../db/index.js';
import { requireAuth, signToken, verifyPassword } from '../auth.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu' });
    }

    const rows = await query(
      'SELECT id, username, password_hash, ho_ten, vai_tro FROM tai_khoan WHERE username = ? LIMIT 1',
      [String(username).trim()]
    );
    const account = rows[0];
    if (!account || !verifyPassword(String(password), account.password_hash)) {
      return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });
    }

    const user = {
      id: account.id,
      username: account.username,
      ho_ten: account.ho_ten,
      vai_tro: account.vai_tro,
    };
    return res.json({ token: signToken(user), user });
  } catch (err) {
    return next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;

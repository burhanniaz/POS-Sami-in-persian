import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });

  const { rows } = await pool.query(
    'SELECT id, username, password_hash, full_name, role, is_active FROM users WHERE username = $1',
    [username]
  );
  const user = rows[0];
  if (!user || !user.is_active) return res.status(401).json({ error: 'نام کاربری یا رمز عبور نادرست است' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'نام کاربری یا رمز عبور نادرست است' });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
  res.json({ token, user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name } });
});

// One-time bootstrap: create the first admin if no users exist yet.
router.post('/bootstrap', async (req, res) => {
  const { username, password, full_name } = req.body;
  const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM users');
  if (rows[0].c > 0) return res.status(403).json({ error: 'سامانه قبلاً راه‌اندازی شده است' });
  if (!username || !password) return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });

  const hash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    'INSERT INTO users (username, password_hash, full_name, role) VALUES ($1,$2,$3,$4) RETURNING id, username, role, full_name',
    [username, hash, full_name || username, 'admin']
  );
  res.json({ user: result.rows[0] });
});

export default router;

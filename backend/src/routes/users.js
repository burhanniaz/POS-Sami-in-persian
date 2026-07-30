import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db/pool.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY id ASC');
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { username, password, full_name, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    'INSERT INTO users (username, password_hash, full_name, role) VALUES ($1,$2,$3,$4) RETURNING id, username, full_name, role',
    [username, hash, full_name || username, role === 'admin' ? 'admin' : 'cashier']
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { full_name, role, is_active, password } = req.body;
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.params.id]);
  }
  const { rows } = await pool.query(
    'UPDATE users SET full_name=$1, role=$2, is_active=$3 WHERE id=$4 RETURNING id, username, full_name, role, is_active',
    [full_name, role, is_active, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'کاربر یافت نشد' });
  res.json(rows[0]);
});

export default router;

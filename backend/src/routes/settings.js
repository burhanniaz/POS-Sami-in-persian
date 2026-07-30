import { Router } from 'express';
import pool from '../db/pool.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM store_settings ORDER BY id LIMIT 1');
  res.json(rows[0] || {});
});

router.put('/', requireAdmin, async (req, res) => {
  const { store_name, address, phone, receipt_footer } = req.body;
  const { rows } = await pool.query(
    `UPDATE store_settings SET store_name=$1, address=$2, phone=$3, receipt_footer=$4, updated_at=now()
     WHERE id = (SELECT id FROM store_settings ORDER BY id LIMIT 1) RETURNING *`,
    [store_name, address || null, phone || null, receipt_footer || null]
  );
  res.json(rows[0]);
});

export default router;

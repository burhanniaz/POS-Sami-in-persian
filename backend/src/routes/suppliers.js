import { Router } from 'express';
import pool from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM suppliers ORDER BY name ASC LIMIT 200');
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { name, phone, address, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'نام الزامی است' });
  const { rows } = await pool.query(
    'INSERT INTO suppliers (name, phone, address, notes) VALUES ($1,$2,$3,$4) RETURNING *',
    [name, phone || null, address || null, notes || null]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { name, phone, address, notes } = req.body;
  const { rows } = await pool.query(
    'UPDATE suppliers SET name=$1, phone=$2, address=$3, notes=$4 WHERE id=$5 RETURNING *',
    [name, phone || null, address || null, notes || null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'تامین‌کننده یافت نشد' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM suppliers WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

// Stock-in from a supplier delivery: bumps stock + logs adjustment for each product line
router.post('/:id/stock-in', async (req, res) => {
  const { items } = req.body; // [{ product_id, quantity }]
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'کالاها الزامی است' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const it of items) {
      await client.query('UPDATE products SET stock = stock + $1, updated_at = now() WHERE id = $2', [it.quantity, it.product_id]);
      await client.query(
        'INSERT INTO stock_adjustments (product_id, change, reason, user_id) VALUES ($1,$2,$3,$4)',
        [it.product_id, it.quantity, `Supplier #${req.params.id} delivery`, req.user.id]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'ثبت ورود کالا با خطا مواجه شد' });
  } finally {
    client.release();
  }
});

export default router;

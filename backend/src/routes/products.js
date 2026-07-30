import { Router } from 'express';
import pool from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /products?search=&page=1&limit=20  -- paginated, indexed name search
router.get('/', async (req, res) => {
  const { search = '', page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const params = [];
  let where = 'WHERE is_active = TRUE';
  if (search) {
    params.push(`%${search}%`);
    where += ` AND (name ILIKE $${params.length} OR barcode = ${search.match(/^\d+$/) ? `'${search}'` : 'NULL'})`;
  }
  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT id, name, barcode, price, cost, stock, low_stock_threshold, supplier_id
     FROM products ${where}
     ORDER BY name ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  const countRes = await pool.query(`SELECT COUNT(*)::int AS c FROM products ${where}`, params.slice(0, params.length - 2));
  res.json({ items: rows, total: countRes.rows[0].c });
});

// GET /products/barcode/:code -- instant single lookup for scanner (indexed)
router.get('/barcode/:code', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, barcode, price, stock FROM products WHERE barcode = $1 AND is_active = TRUE LIMIT 1',
    [req.params.code]
  );
  if (!rows[0]) return res.status(404).json({ error: 'محصول یافت نشد' });
  res.json(rows[0]);
});

router.get('/low-stock', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, stock, low_stock_threshold FROM products
     WHERE is_active = TRUE AND stock <= low_stock_threshold ORDER BY stock ASC LIMIT 50`
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { name, barcode, price, cost, stock, low_stock_threshold, supplier_id } = req.body;
  if (!name) return res.status(400).json({ error: 'نام الزامی است' });
  const { rows } = await pool.query(
    `INSERT INTO products (name, barcode, price, cost, stock, low_stock_threshold, supplier_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [name, barcode || null, price || 0, cost || 0, stock || 0, low_stock_threshold || 5, supplier_id || null]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { name, barcode, price, cost, stock, low_stock_threshold, supplier_id } = req.body;
  const { rows } = await pool.query(
    `UPDATE products SET name=$1, barcode=$2, price=$3, cost=$4, stock=$5,
     low_stock_threshold=$6, supplier_id=$7, updated_at=now() WHERE id=$8 RETURNING *`,
    [name, barcode || null, price, cost, stock, low_stock_threshold, supplier_id || null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'محصول یافت نشد' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('UPDATE products SET is_active = FALSE WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

// Manual stock adjustment (stock-in / correction / damage etc.)
router.post('/:id/adjust', async (req, res) => {
  const { change, reason } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE products SET stock = stock + $1, updated_at = now() WHERE id = $2', [change, req.params.id]);
    await client.query(
      'INSERT INTO stock_adjustments (product_id, change, reason, user_id) VALUES ($1,$2,$3,$4)',
      [req.params.id, change, reason || null, req.user.id]
    );
    await client.query('COMMIT');
    res.status(201).json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'ثبت اصلاح موجودی با خطا مواجه شد' });
  } finally {
    client.release();
  }
});

export default router;

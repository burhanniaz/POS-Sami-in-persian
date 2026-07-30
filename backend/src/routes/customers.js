import { Router } from 'express';
import pool from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { search = '', page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const params = [];
  let where = 'WHERE is_active = TRUE';
  if (search) {
    params.push(`%${search}%`);
    where += ` AND (name ILIKE $${params.length} OR phone ILIKE $${params.length})`;
  }
  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT id, name, phone, credit_limit, balance FROM customers ${where}
     ORDER BY name ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  const countRes = await pool.query(`SELECT COUNT(*)::int AS c FROM customers ${where}`, params.slice(0, params.length - 2));
  res.json({ items: rows, total: countRes.rows[0].c });
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'مشتری یافت نشد' });
  const history = await pool.query(
    'SELECT id, invoice_no, total, paid_cash, paid_loan, created_at FROM sales WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 20',
    [req.params.id]
  );
  res.json({ ...rows[0], recent_sales: history.rows });
});

router.post('/', async (req, res) => {
  const { name, phone, address, credit_limit } = req.body;
  if (!name) return res.status(400).json({ error: 'نام الزامی است' });
  const { rows } = await pool.query(
    'INSERT INTO customers (name, phone, address, credit_limit) VALUES ($1,$2,$3,$4) RETURNING *',
    [name, phone || null, address || null, credit_limit || 0]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { name, phone, address, credit_limit } = req.body;
  const { rows } = await pool.query(
    'UPDATE customers SET name=$1, phone=$2, address=$3, credit_limit=$4 WHERE id=$5 RETURNING *',
    [name, phone || null, address || null, credit_limit, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'مشتری یافت نشد' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('UPDATE customers SET is_active = FALSE WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

// Record a loan payment (customer pays down their balance)
router.post('/:id/payments', async (req, res) => {
  const { amount, note } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'مبلغ معتبر الزامی است' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE customers SET balance = balance - $1 WHERE id = $2', [amount, req.params.id]);
    const inserted = await client.query(
      'INSERT INTO loan_payments (customer_id, amount, user_id, note) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.params.id, amount, req.user.id, note || null]
    );
    await client.query('COMMIT');
    res.status(201).json(inserted.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'ثبت پرداخت با خطا مواجه شد' });
  } finally {
    client.release();
  }
});

export default router;

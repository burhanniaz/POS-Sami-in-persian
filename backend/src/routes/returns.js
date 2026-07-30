import { Router } from 'express';
import pool from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// POST /returns { sale_id, items: [{sale_item_id, quantity}], refund_method }
router.post('/', async (req, res) => {
  const { sale_id, items, refund_method = 'cash' } = req.body;
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'کالایی برای مرجوعی انتخاب نشده است' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: saleRows } = await client.query('SELECT * FROM sales WHERE id = $1 FOR UPDATE', [sale_id]);
    const sale = saleRows[0];
    if (!sale) throw new Error('فروش یافت نشد');

    let totalRefund = 0;
    const { rows: retRows } = await client.query(
      'INSERT INTO returns (sale_id, user_id, total_refund, refund_method) VALUES ($1,$2,0,$3) RETURNING *',
      [sale_id, req.user.id, refund_method]
    );
    const ret = retRows[0];

    for (const it of items) {
      const { rows: siRows } = await client.query('SELECT * FROM sale_items WHERE id = $1 FOR UPDATE', [it.sale_item_id]);
      const si = siRows[0];
      if (!si) throw new Error(`Sale item ${it.sale_item_id} not found`);
      const remaining = Number(si.quantity) - Number(si.returned_qty);
      if (Number(it.quantity) > remaining) throw new Error('تعداد مرجوعی از تعداد فروخته‌شده بیشتر است');

      const lineRefund = Number(it.quantity) * Number(si.unit_price);
      totalRefund += lineRefund;

      await client.query('UPDATE sale_items SET returned_qty = returned_qty + $1 WHERE id = $2', [it.quantity, si.id]);
      await client.query('UPDATE products SET stock = stock + $1, updated_at = now() WHERE id = $2', [it.quantity, si.product_id]);
      await client.query('INSERT INTO return_items (return_id, sale_item_id, quantity) VALUES ($1,$2,$3)', [ret.id, si.id, it.quantity]);
    }

    await client.query('UPDATE returns SET total_refund = $1 WHERE id = $2', [totalRefund, ret.id]);

    if (refund_method === 'loan_adjust' && sale.customer_id) {
      await client.query('UPDATE customers SET balance = balance - $1 WHERE id = $2', [totalRefund, sale.customer_id]);
    }

    await client.query('UPDATE sales SET status = $1 WHERE id = $2', ['partial_return', sale_id]);

    await client.query('COMMIT');
    res.status(201).json({ ...ret, total_refund: totalRefund });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message || 'ثبت مرجوعی با خطا مواجه شد' });
  } finally {
    client.release();
  }
});

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.*, s.invoice_no FROM returns r JOIN sales s ON s.id = r.sale_id ORDER BY r.created_at DESC LIMIT 100`
  );
  res.json(rows);
});

export default router;

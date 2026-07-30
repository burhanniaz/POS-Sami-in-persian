import { Router } from 'express';
import pool from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function genInvoiceNo() {
  const d = new Date();
  const stamp = d.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  return `INV${stamp}${Math.floor(Math.random() * 900 + 100)}`;
}

// POST /sales -- create a sale (checkout). One DB round trip via a single transaction.
// body: { customer_id?, items: [{product_id, quantity, unit_price, line_discount}], discount, paid_cash, paid_loan }
router.post('/', async (req, res) => {
  const { customer_id, items, discount = 0, paid_cash = 0, paid_loan = 0 } = req.body;
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'سبد خرید خالی است' });
  if (paid_loan > 0 && !customer_id) return res.status(400).json({ error: 'برای فروش نسیه انتخاب مشتری الزامی است' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock and validate stock for all items in one query (avoids per-item round trips)
    const productIds = items.map((i) => i.product_id);
    const { rows: products } = await client.query(
      'SELECT id, price, stock FROM products WHERE id = ANY($1::int[]) FOR UPDATE',
      [productIds]
    );
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    let subtotal = 0;
    for (const item of items) {
      const p = productMap[item.product_id];
      if (!p) throw new Error(`محصول با شناسه ${item.product_id} یافت نشد`);
      if (Number(p.stock) < Number(item.quantity)) throw new Error(`موجودی کافی برای محصول با شناسه ${item.product_id} وجود ندارد`);
      subtotal += Number(item.unit_price) * Number(item.quantity) - Number(item.line_discount || 0);
    }
    const total = subtotal - Number(discount);

    if (customer_id && paid_loan > 0) {
      const { rows: custRows } = await client.query('SELECT balance, credit_limit FROM customers WHERE id = $1 FOR UPDATE', [customer_id]);
      const cust = custRows[0];
      if (!cust) throw new Error('مشتری یافت نشد');
      if (Number(cust.balance) + Number(paid_loan) > Number(cust.credit_limit)) {
        throw new Error('از سقف اعتبار مشتری بیشتر است');
      }
    }

    const invoice_no = genInvoiceNo();
    const { rows: saleRows } = await client.query(
      `INSERT INTO sales (invoice_no, customer_id, cashier_id, subtotal, discount, total, paid_cash, paid_loan)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [invoice_no, customer_id || null, req.user.id, subtotal, discount, total, paid_cash, paid_loan]
    );
    const sale = saleRows[0];

    // Bulk insert sale items + stock decrement per line
    for (const item of items) {
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, line_discount)
         VALUES ($1,$2,$3,$4,$5)`,
        [sale.id, item.product_id, item.quantity, item.unit_price, item.line_discount || 0]
      );
      await client.query('UPDATE products SET stock = stock - $1, updated_at = now() WHERE id = $2', [item.quantity, item.product_id]);
    }

    if (customer_id && paid_loan > 0) {
      await client.query('UPDATE customers SET balance = balance + $1 WHERE id = $2', [paid_loan, customer_id]);
    }

    await client.query('COMMIT');
    res.status(201).json(sale);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message || 'ثبت فروش با خطا مواجه شد' });
  } finally {
    client.release();
  }
});

router.get('/', async (req, res) => {
  const { page = 1, limit = 20, cashier_id, customer_id, from, to } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const clauses = [];
  const params = [];
  if (cashier_id) { params.push(cashier_id); clauses.push(`cashier_id = $${params.length}`); }
  if (customer_id) { params.push(customer_id); clauses.push(`customer_id = $${params.length}`); }
  if (from) { params.push(from); clauses.push(`created_at >= $${params.length}`); }
  if (to) { params.push(to); clauses.push(`created_at <= $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT s.*, c.name AS customer_name, u.full_name AS cashier_name
     FROM sales s LEFT JOIN customers c ON c.id = s.customer_id LEFT JOIN users u ON u.id = s.cashier_id
     ${where} ORDER BY s.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.*, c.name AS customer_name, u.full_name AS cashier_name
     FROM sales s LEFT JOIN customers c ON c.id = s.customer_id LEFT JOIN users u ON u.id = s.cashier_id
     WHERE s.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'فروش یافت نشد' });
  const items = await pool.query(
    `SELECT si.*, p.name AS product_name FROM sale_items si JOIN products p ON p.id = si.product_id WHERE sale_id = $1`,
    [req.params.id]
  );
  res.json({ ...rows[0], items: items.rows });
});

export default router;

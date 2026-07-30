import { Router } from 'express';
import pool from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Single dashboard call: aggregate everything in parallel to minimize round trips
router.get('/dashboard', async (req, res) => {
  const [todaySales, lowStock, loanAging, bestSellers] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(total),0) AS total, COUNT(*)::int AS count
       FROM sales WHERE created_at >= CURRENT_DATE`
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM products WHERE is_active = TRUE AND stock <= low_stock_threshold`
    ),
    pool.query(
      `SELECT COALESCE(SUM(balance),0) AS total_owed, COUNT(*) FILTER (WHERE balance > 0)::int AS customers_with_loans
       FROM customers WHERE is_active = TRUE`
    ),
    pool.query(
      `SELECT p.name, SUM(si.quantity) AS qty_sold
       FROM sale_items si JOIN products p ON p.id = si.product_id
       JOIN sales s ON s.id = si.sale_id
       WHERE s.created_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY p.name ORDER BY qty_sold DESC LIMIT 5`
    ),
  ]);

  res.json({
    today_sales_total: Number(todaySales.rows[0].total),
    today_sales_count: todaySales.rows[0].count,
    low_stock_count: lowStock.rows[0].count,
    total_owed: Number(loanAging.rows[0].total_owed),
    customers_with_loans: loanAging.rows[0].customers_with_loans,
    best_sellers: bestSellers.rows,
  });
});

router.get('/sales', async (req, res) => {
  const { from, to, cashier_id } = req.query;
  const clauses = [];
  const params = [];
  if (from) { params.push(from); clauses.push(`s.created_at >= $${params.length}`); }
  if (to) { params.push(to); clauses.push(`s.created_at <= $${params.length}`); }
  if (cashier_id) { params.push(cashier_id); clauses.push(`s.cashier_id = $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT DATE(s.created_at) AS day, u.full_name AS cashier, COUNT(*)::int AS sales_count, SUM(s.total) AS total
     FROM sales s LEFT JOIN users u ON u.id = s.cashier_id
     ${where} GROUP BY DATE(s.created_at), u.full_name ORDER BY day DESC LIMIT 100`,
    params
  );
  res.json(rows);
});

router.get('/loan-aging', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.phone, c.balance, c.credit_limit,
            MAX(s.created_at) AS last_sale_at
     FROM customers c LEFT JOIN sales s ON s.customer_id = c.id
     WHERE c.balance > 0 AND c.is_active = TRUE
     GROUP BY c.id ORDER BY c.balance DESC LIMIT 200`
  );
  res.json(rows);
});

router.get('/low-stock', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, stock, low_stock_threshold FROM products
     WHERE is_active = TRUE AND stock <= low_stock_threshold ORDER BY stock ASC LIMIT 200`
  );
  res.json(rows);
});

router.get('/best-sellers', async (req, res) => {
  const { days = 30 } = req.query;
  const { rows } = await pool.query(
    `SELECT p.id, p.name, SUM(si.quantity) AS qty_sold, SUM(si.quantity * si.unit_price) AS revenue
     FROM sale_items si JOIN products p ON p.id = si.product_id
     JOIN sales s ON s.id = si.sale_id
     WHERE s.created_at >= now() - ($1 || ' days')::interval
     GROUP BY p.id, p.name ORDER BY qty_sold DESC LIMIT 20`,
    [days]
  );
  res.json(rows);
});

export default router;

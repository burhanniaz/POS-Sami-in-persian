import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import pool from './db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Auto-run schema on boot. Safe to run every start: every statement is
// CREATE TABLE/INDEX/EXTENSION IF NOT EXISTS, so it's a no-op once applied.
async function ensureSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf-8');
  await pool.query(sql);
  console.log('Schema check complete.');
}

import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import customerRoutes from './routes/customers.js';
import supplierRoutes from './routes/suppliers.js';
import saleRoutes from './routes/sales.js';
import returnRoutes from './routes/returns.js';
import reportRoutes from './routes/reports.js';
import userRoutes from './routes/users.js';
import settingsRoutes from './routes/settings.js';

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
ensureSchema()
  .then(() => app.listen(PORT, () => console.log(`POS backend running on port ${PORT}`)))
  .catch((err) => {
    console.error('Failed to prepare database schema:', err);
    process.exit(1);
  });

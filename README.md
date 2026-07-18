# POS system

Multi-terminal point-of-sale system: Node/Express + PostgreSQL (Prisma) backend, React (Vite) frontend, Persian UI.

## What's inside

```
backend/    Express API + Prisma schema (all 9 modules, transaction-safe stock/loan logic)
frontend/   React app (Vite + Tailwind) — the UI you approved
docker-compose.yml   Local PostgreSQL for testing (swap for EasyPanel/Neon in production)
```

## 1. Run a local database (for testing only)

You need Docker Desktop installed, then from the project root:

```bash
docker compose up -d
```

This starts PostgreSQL on `localhost:5432` with user/pass `pos_user` / `pos_password`, database `pos_db` — matching `backend/.env.example`.

(In production, skip this and point `DATABASE_URL` at your EasyPanel-hosted or Neon Postgres instead.)

## 2. Backend setup

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev
```

- `prisma migrate dev` creates all tables.
- `npm run seed` creates a default admin (`admin` / `ChangeMe123!`), a default terminal ("Register 1"), a default cashier ("Cashier 1", PIN `1234`), and the configurable settings (discount threshold, session timeout, etc.) — change the admin password after first login.
- The API runs on **http://localhost:4000**. Check `http://localhost:4000/health`.

## 3. Frontend setup

Open a second terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

- The app runs on **http://localhost:5173**.
- On first load, pick the terminal ("Register 1") in the login screen, then either:
  - **Cashier** tab → select "Cashier 1" → PIN `1234`
  - **Admin** tab → `admin` / `ChangeMe123!`

## 4. Printer setup (per terminal, when you're ready for real hardware)

1. Install [QZ Tray](https://qz.io/download/) on the terminal's PC and connect the thermal printer (USB/Bluetooth).
2. The frontend (`src/lib/print.js`) connects to QZ Tray automatically on `localhost` when printing. On first use, QZ Tray will show a one-time "allow this site" prompt — accept it.
3. For production you should configure a signed certificate in QZ Tray (see their docs) so that prompt doesn't reappear; this is a one-time setup per terminal.
4. If QZ Tray isn't running, the app automatically falls back to the browser's native print dialog (`window.print()`), exactly as specified.
5. Receipts are plain text (store name, items, totals, payment) — no images are ever sent to the printer.

## Notes on what's configurable

Everything marked *(assumed default)* in the original spec lives in **Settings → پارامترهای عمومی** (admin only), backed by the `AppSetting` table:

- Live sync poll interval
- Cashier session auto-lock timeout
- Discount approval threshold (percent and flat amount)
- Currency thousands separator

Change these anytime without touching code.

## Architecture notes

- **No offline mode**: every write goes straight to the shared Postgres via the API; if the connection drops mid-checkout, the transaction is rolled back server-side and nothing partial is ever committed.
- **Stock safety**: checkout uses `SELECT ... FOR UPDATE` row locks inside a Prisma transaction, so two terminals can never both sell the last unit of a low-stock item.
- **Audit log**: every sale, refund, stock edit, and login is recorded with terminal + cashier/admin in the `AuditLog` table (viewable via `GET /api/audit`, admin only).
- **Discount approval**: checkout automatically requires an admin username/password when a discount exceeds the configured threshold.
- **Returns/refunds**: refund is split proportionally across the original payment method(s) — cash portion refunds as cash, loan-paid portion reduces the customer's loan balance. Items restock by default unless marked damaged.

## Deploying

- Backend: deploy the `backend/` folder to EasyPanel (or any Node host), set `DATABASE_URL` to your EasyPanel/Neon Postgres, run `npx prisma migrate deploy` once, then `npm run seed` once.
- Frontend: `npm run build` in `frontend/`, serve the `dist/` folder (EasyPanel static site, or any static host), and set `VITE_API_URL` to your deployed backend URL at build time.
- Each terminal PC needs QZ Tray installed locally for its own printer — this never touches the cloud server.

# POS Web App

A multi-terminal point-of-sale system: product inventory, customer loans/credit,
suppliers, sales/checkout, returns, reports, and user roles. Built to run
identically on your laptop, a VPS, or a PaaS like EasyPanel/Hostinger.

## Stack
- **Backend**: Node.js + Express + PostgreSQL (`pg`), JWT auth
- **Frontend**: React + Vite + Tailwind CSS v4, responsive (mobile/tablet/laptop/desktop)
- **Deploy**: Docker Compose — one file spins up Postgres, the API, and the web app

## Project layout
```
pos-app/
├── backend/      # Express API + Postgres schema
├── frontend/     # React app (built + served by nginx in production)
└── docker-compose.yml
```

## Run locally with Docker (recommended)

1. Copy env template and set a real password/secret:
   ```
   cp backend/.env.example backend/.env   # optional, compose sets these itself
   ```
2. From the `pos-app/` folder:
   ```
   DB_PASSWORD=change-me JWT_SECRET=$(openssl rand -hex 32) docker compose up --build
   ```
3. Open http://localhost:8080 — the API is on :4000, Postgres on the internal network only.
4. Create your first admin account (one-time, only works while there are zero users):
   ```
   curl -X POST http://localhost:4000/api/auth/bootstrap \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"YOUR_PASSWORD","full_name":"Admin"}'
   ```
5. Log in at http://localhost:8080/login.

The backend automatically applies its database schema on every boot (every
statement is `IF NOT EXISTS`, so it's always safe to re-run) — no manual
migration step needed.

## Run locally without Docker (dev mode)

Backend:
```
cd backend
cp .env.example .env   # edit DATABASE_URL to point at your local Postgres
npm install
npm run dev             # http://localhost:4000
```

Frontend:
```
cd frontend
npm install
npm run dev              # http://localhost:5173, proxies /api to :4000
```

## Deploying via GitHub → EasyPanel or Hostinger

This repo is deploy-ready as-is because everything is containerized, and the
frontend never hardcodes where the backend lives — it's controlled entirely
by two env vars: `BACKEND_HOST` and `BACKEND_PORT`. You never need to edit
code to redeploy somewhere new, only set these per environment.

1. Push this whole `pos-app/` folder to a GitHub repository.

2. **EasyPanel (Compose service)**: create a new project → "App" service type
   → source **Git** or use a "Compose" service if your EasyPanel version
   supports it → point it at your GitHub repo and `docker-compose.yml`. Set
   the `DB_PASSWORD` and `JWT_SECRET` environment variables in the EasyPanel
   UI. `BACKEND_HOST`/`BACKEND_PORT` are already set correctly inside
   `docker-compose.yml` (`backend` / `4000`) — nothing to change.

3. **EasyPanel (two separate App services)** — if you deploy backend and
   frontend as two independent App services instead of one Compose stack
   (common when your EasyPanel plan only offers single-Dockerfile Apps):
   - Backend service: Build Path `/backend`, env vars `DATABASE_URL`,
     `DB_SSL=true`, `JWT_SECRET`, `PORT=4000`. Name this service `backend`.
   - Frontend service: Build Path `/frontend`, and set:
     ```
     BACKEND_HOST=<PROJECT_NAME>_backend
     BACKEND_PORT=4000
     ```
     EasyPanel's internal DNS name for a service is
     `<project name>_<service name>` (Docker Swarm namespacing) — so if your
     EasyPanel project is called `burhan` and the backend service is named
     `backend`, set `BACKEND_HOST=burhan_backend`. Attach your domain to the
     frontend service on port `80`.
   - No code or Dockerfile edits needed for this — it's just those two env
     vars, which is the whole point of the template-based nginx config.

4. **Hostinger (VPS with Docker)**: SSH in, `git clone` your repo, then:
   ```
   cd pos-app
   DB_PASSWORD=... JWT_SECRET=... docker compose up -d --build
   ```
   Put a reverse proxy (Hostinger's panel, or Caddy/nginx/Traefik) in front of
   port 8080 for your domain + HTTPS. `BACKEND_HOST`/`BACKEND_PORT` default
   to `backend`/`4000` in `docker-compose.yml`, matching the service name
   Compose gives it automatically — no changes needed.

5. However you deploy, run the one-time `/api/auth/bootstrap` call once (via
   `curl` or `Invoke-RestMethod` against your live domain) to create the
   first admin login — see the local dev section above for the exact command.

### How the portable backend URL works
`frontend/templates/default.conf.template` is nginx's own template
mechanism (built into the official `nginx:alpine` image): any `*.template`
file in `/etc/nginx/templates/` gets its `${VAR}` placeholders substituted
from real environment variables every time the container starts, before
nginx boots. The Dockerfile sets safe defaults (`BACKEND_HOST=backend`,
`BACKEND_PORT=4000`) so the image works out of the box with
`docker-compose.yml`; you only override them when your backend's internal
hostname differs, like the EasyPanel two-App-service case above.

## Performance notes (why it stays fast)
- Postgres indexes on barcode, product/customer name (trigram search), and all
  foreign keys used in joins — search-as-you-type and barcode scans hit an
  index, not a table scan.
- A connection pool (`pg.Pool`, up to 20 connections) is reused across
  requests instead of opening a new DB connection per request.
- Checkout is a single DB transaction (stock check, stock decrement, sale
  insert, customer balance update) — one round trip to the database, not one
  per line item.
- The dashboard issues its 4 summary queries in parallel (`Promise.all`)
  instead of sequentially.
- Frontend search inputs are debounced (200ms) so typing doesn't spam the API.
- Production frontend is a static build served by nginx with long-lived cache
  headers on hashed assets, and nginx proxies `/api` same-origin (no extra
  CORS preflight or cross-domain DNS lookup).

## Responsive design
- Desktop/tablet: fixed sidebar navigation.
- Mobile: top bar + slide-out drawer for the full menu, plus a bottom tab bar
  for the four most-used screens (Dashboard, Checkout, Products, Customers).
- All tables scroll horizontally on narrow screens instead of breaking layout.

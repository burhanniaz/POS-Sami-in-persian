# EasyPanel Deployment Guide — Reference for AI-Built Projects

This document captures the exact conventions to follow when building **any**
web app (POS, clinic app, store, etc.) that will be deployed on EasyPanel.
Follow this from the start of a project and deployment becomes: push to
GitHub → create services → paste env vars → deploy. **No code changes
between environments, ever.**

---

## 1. The core rule: environment drives everything, code never hardcodes it

Never hardcode a hostname, port, or URL in application code, nginx config,
or Docker files. Every environment-specific value must come from an env
var, with a sensible local-dev default baked into the Dockerfile/compose
file as a fallback. This is the single most important rule — it's what
made the POS app deployable without touching a single line of code across
three different EasyPanel projects.

Things that must always be env vars, never hardcoded:
- Database connection string
- JWT/session secret
- Backend hostname + port (as seen by the frontend/reverse proxy)
- Any third-party API keys
- CORS allowed origins (if locking down CORS — see §6)

---

## 2. Standard project shape

Every full-stack project should be split the same way:

```
project-name/
├── backend/          # API service, own Dockerfile
├── frontend/          # Static/SPA, own Dockerfile
└── docker-compose.yml # Local dev + Hostinger/VPS deploys
```

This shape supports **both** EasyPanel deployment styles without changes:
- **Compose service** (if the EasyPanel plan/version supports it): point at
  `docker-compose.yml` directly, one click.
- **Two separate App services** (most common on EasyPanel today): one App
  service per Dockerfile, Build Path `/backend` and `/frontend` respectively,
  same repo.

---

## 3. Backend service conventions

### Auto-migrate schema on boot
The backend should apply its DB schema every time it starts, using
`CREATE TABLE/INDEX/EXTENSION IF NOT EXISTS` everywhere so re-running it is
always a safe no-op. This removes an entire manual deployment step — no
one has to remember to run a migration command after deploying.

### Standard backend env vars
```
DATABASE_URL=postgres://<user>:<password>@<internal-host>:<port>/<dbname>?sslmode=disable
DB_SSL=false
PORT=4000
JWT_SECRET=<long random string>
```

**`DATABASE_URL` host/SSL rule:** if the database is an EasyPanel Postgres
service in the *same project*, always use its **Internal Host** (visible on
the database service's Credentials tab) and `sslmode=disable`, with
`DB_SSL=false`. EasyPanel-hosted Postgres does not run SSL internally —
setting `DB_SSL=true` against it will hang or fail the connection. Only use
`DB_SSL=true` for actually-external managed databases (Neon, Supabase,
RDS, etc.) that require SSL, and never use the database's **External
Host/Port** unless the backend genuinely lives outside that EasyPanel
project (it should not, per §5 below).

### One-time admin bootstrap endpoint
Include a `/api/auth/bootstrap` (or equivalent) endpoint that only works
while zero users exist in the database, to create the first admin account
post-deploy without needing DB console access. Guard it so it 403s once a
user exists.

---

## 4. Frontend service conventions (the portable nginx pattern)

Never bake the backend's address into `nginx.conf` or into a built JS
bundle. Instead:

1. Put the nginx server block in `frontend/templates/default.conf.template`
   (not `frontend/nginx.conf`). This exact path/suffix is required — the
   official `nginx:alpine` image auto-runs `envsubst` on every `*.template`
   file under `/etc/nginx/templates/` at container start, before nginx
   boots, substituting only variables that are actually set in the
   container's environment (nginx's own `$host`, `$remote_addr`, etc. are
   left untouched since they aren't env vars).
2. Reference the backend as `${BACKEND_HOST}` / `${BACKEND_PORT}` in the
   `proxy_pass` line:
   ```nginx
   location /api/ {
       proxy_pass http://${BACKEND_HOST}:${BACKEND_PORT}/api/;
       proxy_http_version 1.1;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```
3. In the Dockerfile, copy that template into `/etc/nginx/templates/` and
   set safe local-dev defaults:
   ```dockerfile
   COPY templates/default.conf.template /etc/nginx/templates/default.conf.template
   ENV BACKEND_HOST=backend
   ENV BACKEND_PORT=4000
   ```
4. The frontend's own API client code should call a same-origin relative
   path (`/api/...`), never a full URL — nginx handles the proxying, so the
   browser never needs to know the backend's real address at all.

This means the **only** thing that changes between `docker-compose` on your
laptop, a Hostinger VPS, and any EasyPanel project is two environment
variable values — never a file.

---

## 5. EasyPanel internal networking rule

**Always deploy all services (frontend, backend, database) inside the
same EasyPanel project.** Services in different projects generally cannot
reach each other by internal hostname, and mixing them across projects is
the most common cause of "frontend can't reach backend" or "backend can't
reach database" failures.

EasyPanel's internal DNS name for any service follows this pattern
(Docker Swarm namespacing):
```
<project-name>_<service-name>
```
Examples from real deployments:
- Project `naqibahmadi`, database service `database-pos` →
  `naqibahmadi_database-pos` (confirmed via the database's own Credentials
  tab, "Internal Host" field)
- Project `naqibahmadi`, backend service `pos_backend` →
  `naqibahmadi_pos_backend` (confirmed via the backend service's own
  Domains tab, showing `http://naqibahmadi_pos_backend:4000/`)

**Practical steps when standing up a new project on EasyPanel:**
1. Create one EasyPanel project for the whole app (pick one name and stick
   to it — don't create a second project for "just the backend").
2. Add the database service first, note its exact service name and the
   **Internal Host** value shown on its Credentials tab.
3. Add the backend App service (Build Path `/backend`), and set
   `DATABASE_URL` using that internal host.
4. Add the frontend App service (Build Path `/frontend`), and set
   `BACKEND_HOST=<project-name>_<backend-service-name>`,
   `BACKEND_PORT=4000` (or whatever port the backend listens on).
5. Attach the domain only to the frontend service, port 80 (or whatever
   nginx listens on) — never expose the backend or database publicly
   unless there's a specific reason to.
6. Deploy backend first, confirm its logs show a successful schema
   migration and "running on port X" before deploying the frontend.

---

## 6. CORS and security defaults

- Backend CORS can stay permissive (`cors()` with no options) for internal
  single-domain deployments where nginx proxies `/api` same-origin — the
  browser never makes a cross-origin request in that setup, so CORS
  restrictions add no real security and just risk breaking things.
- If the backend is ever exposed on its own public domain (bypassing the
  nginx proxy), lock CORS down to `FRONTEND_URL` read from an env var
  instead of leaving it wide open.
- Always generate `JWT_SECRET` fresh per project — never reuse one across
  projects/environments. A quick way: `openssl rand -hex 32`.

---

## 7. Deployment checklist (copy this per new project)

- [ ] One EasyPanel project created for the whole app
- [ ] Database service added, Internal Host noted
- [ ] Backend service: Build Path set, `DATABASE_URL` (internal host,
      `sslmode=disable`), `DB_SSL=false`, `PORT`, `JWT_SECRET` set
- [ ] Backend deployed, logs confirm schema applied + server running
- [ ] Frontend service: Build Path set, `BACKEND_HOST=<project>_<backend>`,
      `BACKEND_PORT` set
- [ ] Domain attached to frontend service only, correct port
- [ ] Frontend deployed, loads in browser
- [ ] One-time admin bootstrap endpoint called against the live domain
- [ ] Logged in successfully at the live domain

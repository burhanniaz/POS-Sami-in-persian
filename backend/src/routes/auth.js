import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { prisma } from "../db.js";
import { signToken, requireAuth, requireAdmin } from "../middleware/auth.js";
import { logAction } from "../utils/audit.js";
import { uploadStoreLogo } from "../middleware/upload.js";

export const authRouter = Router();

// PINs are short (4-6 digits) and admin passwords may be reused across a
// small team, so both login endpoints need real brute-force protection.
// Keyed by IP + the identifier being attacked, so one bad terminal can't
// lock everyone else out, but repeated guesses against one cashier/admin
// from anywhere are still throttled.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${req.body?.cashierId || req.body?.username || ""}`,
  handler: (req, res) => res.status(429).json({ error: "Too many login attempts. Please wait and try again." }),
});

// List cashiers for the PIN-pad screen (name only, no secrets)
authRouter.get("/cashiers", async (req, res) => {
  const cashiers = await prisma.cashier.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  res.json(cashiers);
});

// Cashier quick PIN login at a terminal — fast switching on a shared machine
authRouter.post("/cashier/login", loginLimiter, async (req, res) => {
  const { cashierId, pin, terminalId } = req.body;
  if (!cashierId || !pin || !terminalId) {
    return res.status(400).json({ error: "cashierId, pin, terminalId are required" });
  }
  const cashier = await prisma.cashier.findUnique({ where: { id: cashierId } });
  if (!cashier || !cashier.active) return res.status(401).json({ error: "Invalid cashier" });

  const ok = await bcrypt.compare(pin, cashier.pinHash);
  if (!ok) return res.status(401).json({ error: "Incorrect PIN" });

  const terminal = await prisma.terminal.findUnique({ where: { id: terminalId } });
  if (!terminal) return res.status(404).json({ error: "Unknown terminal" });

  const session = await prisma.cashierSession.create({
    data: { terminalId, cashierId },
  });

  await logAction({ terminalId, cashierId, action: "auth.cashier_login" });

  const token = signToken({ role: "cashier", id: cashier.id, terminalId, sessionId: session.id });
  res.json({ token, cashier: { id: cashier.id, name: cashier.name }, terminalId, sessionId: session.id });
});

authRouter.post("/cashier/logout", requireAuth, async (req, res) => {
  if (req.auth.role !== "cashier") return res.status(403).json({ error: "Not a cashier session" });
  await prisma.cashierSession.update({
    where: { id: req.auth.sessionId },
    data: { endedAt: new Date() },
  });
  await logAction({ terminalId: req.auth.terminalId, cashierId: req.auth.id, action: "auth.cashier_logout" });
  res.json({ ok: true });
});

// Called by the frontend inactivity timer to auto-lock the session
authRouter.post("/cashier/auto-lock", requireAuth, async (req, res) => {
  if (req.auth.role !== "cashier") return res.status(403).json({ error: "Not a cashier session" });
  await prisma.cashierSession.update({
    where: { id: req.auth.sessionId },
    data: { endedAt: new Date() },
  });
  await logAction({ terminalId: req.auth.terminalId, cashierId: req.auth.id, action: "auth.session_auto_locked" });
  res.json({ ok: true });
});

// Admin full username/password login
authRouter.post("/admin/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "username and password are required" });

  const admin = await prisma.admin.findUnique({ where: { username } });
  if (!admin) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  await logAction({ adminId: admin.id, action: "auth.admin_login" });

  const token = signToken({ role: "admin", id: admin.id });
  res.json({ token, admin: { id: admin.id, username: admin.username } });
});

// Public settings needed before login (poll interval, session timeout) — no secrets
authRouter.get("/settings/public", async (req, res) => {
  const keys = [
    "SYNC_POLL_INTERVAL_MS",
    "SESSION_TIMEOUT_MINUTES",
    "CURRENCY_THOUSANDS_SEPARATOR",
    "STORE_NAME",
    "STORE_ADDRESS",
    "STORE_PHONE",
    "STORE_LOGO_URL",
  ];
  const rows = await prisma.appSetting.findMany({ where: { key: { in: keys } } });
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  res.json(out);
});

// Upload the store logo, then save its URL as a normal setting via
// PUT /settings/STORE_LOGO_URL — kept separate because this one takes a file, not JSON.
authRouter.post("/settings/upload-logo", requireAdmin, uploadStoreLogo.single("logo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image file received" });
  const logoUrl = `/uploads/store/${req.file.filename}`;
  await prisma.appSetting.upsert({
    where: { key: "STORE_LOGO_URL" },
    update: { value: logoUrl },
    create: { key: "STORE_LOGO_URL", value: logoUrl },
  });
  await logAction({ adminId: req.auth.id, action: "settings.logo_update", details: { logoUrl } });
  res.status(201).json({ logoUrl });
});

// Admin: manage all settings
authRouter.get("/settings", requireAdmin, async (req, res) => {
  const rows = await prisma.appSetting.findMany();
  res.json(rows);
});

authRouter.put("/settings/:key", requireAdmin, async (req, res) => {
  const { value } = req.body;
  const row = await prisma.appSetting.upsert({
    where: { key: req.params.key },
    update: { value: String(value) },
    create: { key: req.params.key, value: String(value) },
  });
  await logAction({ adminId: req.auth.id, action: "settings.update", details: { key: req.params.key, value } });
  res.json(row);
});

// Admin: manage cashiers (create / reset PIN / deactivate)
authRouter.post("/cashiers", requireAdmin, async (req, res) => {
  const { name, pin } = req.body;
  if (!name || !pin) return res.status(400).json({ error: "name and pin required" });
  const cashier = await prisma.cashier.create({
    data: { name, pinHash: await bcrypt.hash(pin, 10) },
  });
  await logAction({ adminId: req.auth.id, action: "cashier.create", details: { cashierId: cashier.id } });
  res.status(201).json({ id: cashier.id, name: cashier.name });
});

authRouter.put("/cashiers/:id/pin", requireAdmin, async (req, res) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: "pin required" });
  await prisma.cashier.update({
    where: { id: req.params.id },
    data: { pinHash: await bcrypt.hash(pin, 10) },
  });
  await logAction({ adminId: req.auth.id, action: "cashier.reset_pin", details: { cashierId: req.params.id } });
  res.json({ ok: true });
});

authRouter.put("/cashiers/:id/deactivate", requireAdmin, async (req, res) => {
  await prisma.cashier.update({ where: { id: req.params.id }, data: { active: false } });
  await logAction({ adminId: req.auth.id, action: "cashier.deactivate", details: { cashierId: req.params.id } });
  res.json({ ok: true });
});

// Terminals list/create (admin sets these up once per physical PC)
authRouter.get("/terminals", async (req, res) => {
  res.json(await prisma.terminal.findMany({ orderBy: { name: "asc" } }));
});

authRouter.post("/terminals", requireAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const terminal = await prisma.terminal.create({ data: { name } });
  await logAction({ adminId: req.auth.id, action: "terminal.create", details: { terminalId: terminal.id } });
  res.status(201).json(terminal);
});
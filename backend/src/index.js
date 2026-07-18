import "dotenv/config";
// MUST be imported before any routers are required — it patches Express's
// Router methods so that a rejected promise inside an `async (req,res)=>{}`
// handler is forwarded to next(err) instead of becoming an unhandled
// rejection that leaves the request hanging forever (Express 4 does not
// do this natively; that only landed in Express 5).
import "express-async-errors";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import morgan from "morgan";

import { authRouter } from "./routes/auth.js";
import { productsRouter } from "./routes/products.js";
import { suppliersRouter } from "./routes/suppliers.js";
import { customersRouter } from "./routes/customers.js";
import { salesRouter } from "./routes/sales.js";
import { returnsRouter } from "./routes/returns.js";
import { reportsRouter } from "./routes/reports.js";
import { auditRouter } from "./routes/audit.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Fail fast rather than silently signing tokens with a well-known default
// secret in production. Devs can still run locally with no .env set.
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: JWT_SECRET is not set. Refusing to start in production without it.");
    process.exit(1);
  }
  console.warn("WARNING: JWT_SECRET is not set — using an insecure development-only default.");
}

const app = express();

// Restrict CORS to known origins in production. Comma-separated list via
// CORS_ORIGIN, e.g. "https://pos.mystore.com,https://admin.mystore.com".
// Falls back to allow-all only when explicitly running outside production
// (e.g. local dev on a LAN), so a forgotten env var can't quietly reopen this.
const corsOrigins = process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()).filter(Boolean);
if (corsOrigins?.length) {
  app.use(cors({ origin: corsOrigins }));
} else if (process.env.NODE_ENV === "production") {
  console.error("FATAL: CORS_ORIGIN is not set. Refusing to start in production with an open CORS policy.");
  process.exit(1);
} else {
  app.use(cors());
}

app.use(express.json());
app.use(morgan("dev"));

// Serves uploaded product images, e.g. /uploads/products/abc123.jpg.
// Content-Disposition + a strict CSP here mean that even if a bad file slips
// past the upload validation, a browser won't treat it as an executable HTML
// document or run scripts from it when linked to directly.
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "inline");
    next();
  },
  express.static(path.join(__dirname, "..", "uploads"))
);

app.get("/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use("/api/auth", authRouter);
app.use("/api/products", productsRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/customers", customersRouter);
app.use("/api/sales", salesRouter);
app.use("/api/returns", returnsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/audit", auditRouter);

// 404 for anything under /api that didn't match a route
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// Global error handler. Thanks to express-async-errors above, this now
// catches rejections from every async route handler, not just the ones that
// happened to have their own try/catch.
app.use((err, req, res, next) => {
  // Errors routes raised deliberately (validation, business rules, 404s, etc)
  if (err.status && err.name !== "PrismaClientKnownRequestError") {
    return res.status(err.status).json({ error: err.message, ...err.extra });
  }

  // Known Prisma error codes get a clean, specific response instead of a
  // generic 500 built from the raw internal message.
  if (err.code === "P2025") {
    return res.status(404).json({ error: "Record not found" });
  }
  if (err.code === "P2002") {
    return res.status(409).json({ error: "A record with that value already exists" });
  }
  if (err.code === "P2003") {
    return res.status(409).json({ error: "This action conflicts with related records" });
  }

  // Anything else is unexpected: log the full detail server-side only, and
  // never echo err.message (which can contain schema/column/query internals)
  // back to the client.
  console.error("Unexpected error:", err);
  res.status(500).json({ error: "Internal server error. Please try again or contact support." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`POS backend listening on port ${PORT}`);
});
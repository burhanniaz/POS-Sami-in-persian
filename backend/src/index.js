import "dotenv/config";
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

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Serves uploaded product images, e.g. /uploads/products/abc123.jpg
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use("/api/auth", authRouter);
app.use("/api/products", productsRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/customers", customersRouter);
app.use("/api/sales", salesRouter);
app.use("/api/returns", returnsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/audit", auditRouter);

// Fallback error handler — never leak partial state, always respond with a clean error
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`POS backend listening on port ${PORT}`);
});
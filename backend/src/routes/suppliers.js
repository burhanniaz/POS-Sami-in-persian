import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { logAction } from "../utils/audit.js";

export const suppliersRouter = Router();

suppliersRouter.get("/", requireAuth, async (req, res) => {
  res.json(await prisma.supplier.findMany({ orderBy: { name: "asc" } }));
});

suppliersRouter.post("/", requireAdmin, async (req, res) => {
  const { name, contact, phone } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const supplier = await prisma.supplier.create({ data: { name, contact, phone } });
  await logAction({ adminId: req.auth.id, action: "supplier.create", details: { supplierId: supplier.id } });
  res.status(201).json(supplier);
});

suppliersRouter.put("/:id", requireAdmin, async (req, res) => {
  const { name, contact, phone } = req.body;
  const supplier = await prisma.supplier.update({ where: { id: req.params.id }, data: { name, contact, phone } });
  await logAction({ adminId: req.auth.id, action: "supplier.update", details: { supplierId: supplier.id } });
  res.json(supplier);
});

suppliersRouter.delete("/:id", requireAdmin, async (req, res) => {
  await prisma.supplier.delete({ where: { id: req.params.id } });
  await logAction({ adminId: req.auth.id, action: "supplier.delete", details: { supplierId: req.params.id } });
  res.json({ ok: true });
});

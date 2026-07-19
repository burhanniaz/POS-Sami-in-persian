import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { logAction } from "../utils/audit.js";

export const suppliersRouter = Router();

suppliersRouter.get("/", requireAuth, async (req, res) => {
  const { q } = req.query;
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { nic: { contains: q } },
        ],
      }
    : {};
  const suppliers = await prisma.supplier.findMany({ where, orderBy: { name: "asc" } });
  res.json(
    suppliers.map((s) => ({
      ...s,
      availableCredit: Number(s.creditLimit) - Number(s.loanBalance),
    }))
  );
});

suppliersRouter.post("/", requireAdmin, async (req, res) => {
  const { name, nic, address, phone, creditLimit } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const supplier = await prisma.supplier.create({
    data: { name, nic, address, phone, creditLimit: creditLimit ?? 0 },
  });
  await logAction({ adminId: req.auth.id, action: "supplier.create", details: { supplierId: supplier.id } });
  res.status(201).json(supplier);
});

suppliersRouter.put("/:id", requireAdmin, async (req, res) => {
  const { name, nic, address, phone } = req.body;
  const supplier = await prisma.supplier.update({
    where: { id: req.params.id },
    data: { name, nic, address, phone },
  });
  await logAction({ adminId: req.auth.id, action: "supplier.update", details: { supplierId: supplier.id } });
  res.json(supplier);
});

// Only admin can change a supplier's credit limit
suppliersRouter.put("/:id/credit-limit", requireAdmin, async (req, res) => {
  const { creditLimit } = req.body;
  if (creditLimit == null) return res.status(400).json({ error: "creditLimit required" });
  const supplier = await prisma.supplier.update({
    where: { id: req.params.id },
    data: { creditLimit },
  });
  await logAction({
    adminId: req.auth.id,
    action: "supplier.credit_limit_update",
    details: { supplierId: supplier.id, creditLimit },
  });
  res.json(supplier);
});

// Record that the store received goods on credit from this supplier (increases what's owed)
suppliersRouter.post("/:id/add-debt", requireAuth, async (req, res) => {
  const { amount, note } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: "positive amount required" });

  const supplier = await prisma.supplier.update({
    where: { id: req.params.id },
    data: { loanBalance: { increment: amount } },
  });

  await logAction({
    terminalId: req.auth.terminalId,
    cashierId: req.auth.role === "cashier" ? req.auth.id : undefined,
    adminId: req.auth.role === "admin" ? req.auth.id : undefined,
    action: "supplier.debt_added",
    details: { supplierId: supplier.id, amount, note },
  });

  res.json(supplier);
});

// Record a payment made to this supplier (reduces what's owed)
suppliersRouter.post("/:id/repay-loan", requireAuth, async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: "positive amount required" });

  const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id } });
  if (!supplier) return res.status(404).json({ error: "Not found" });

  const repayAmount = Math.min(Number(amount), Number(supplier.loanBalance));
  const updated = await prisma.supplier.update({
    where: { id: req.params.id },
    data: { loanBalance: { decrement: repayAmount } },
  });

  await logAction({
    terminalId: req.auth.terminalId,
    cashierId: req.auth.role === "cashier" ? req.auth.id : undefined,
    adminId: req.auth.role === "admin" ? req.auth.id : undefined,
    action: "supplier.repayment",
    details: { supplierId: supplier.id, amount: repayAmount },
  });

  res.json(updated);
});

// Admin only — refuses to delete a supplier the store still owes money to,
// and refuses to delete one still linked to products (would orphan them).
suppliersRouter.delete("/:id", requireAdmin, async (req, res) => {
  const supplier = await prisma.supplier.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { products: true } } },
  });
  if (!supplier) return res.status(404).json({ error: "Not found" });
  if (Number(supplier.loanBalance) > 0) {
    return res.status(409).json({ error: "This supplier is still owed money — settle the balance before deleting" });
  }
  if (supplier._count.products > 0) {
    return res.status(409).json({ error: "This supplier is still linked to products — reassign them before deleting" });
  }

  await prisma.supplier.delete({ where: { id: req.params.id } });

  await logAction({
    adminId: req.auth.id,
    action: "supplier.delete",
    details: { supplierId: req.params.id, name: supplier.name },
  });

  res.json({ ok: true });
});
import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { logAction } from "../utils/audit.js";

export const customersRouter = Router();

customersRouter.get("/", requireAuth, async (req, res) => {
  const { q } = req.query;
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { cnic: { contains: q } },
        ],
      }
    : {};
  const customers = await prisma.customer.findMany({ where, orderBy: { name: "asc" } });
  res.json(
    customers.map((c) => ({
      ...c,
      availableCredit: Number(c.creditLimit) - Number(c.loanBalance),
    }))
  );
});

customersRouter.get("/:id", requireAuth, async (req, res) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id },
    include: { sales: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
  if (!customer) return res.status(404).json({ error: "Not found" });
  res.json({ ...customer, availableCredit: Number(customer.creditLimit) - Number(customer.loanBalance) });
});

customersRouter.post("/", requireAuth, async (req, res) => {
  const { name, cnic, address, phone, creditLimit } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const customer = await prisma.customer.create({
    data: { name, cnic, address, phone, creditLimit: creditLimit ?? 0 },
  });
  await logAction({
    terminalId: req.auth.terminalId,
    cashierId: req.auth.role === "cashier" ? req.auth.id : undefined,
    adminId: req.auth.role === "admin" ? req.auth.id : undefined,
    action: "customer.create",
    details: { customerId: customer.id },
  });
  res.status(201).json(customer);
});

// Only admin can change a customer's credit limit
customersRouter.put("/:id/credit-limit", requireAdmin, async (req, res) => {
  const { creditLimit } = req.body;
  if (creditLimit == null) return res.status(400).json({ error: "creditLimit required" });
  const customer = await prisma.customer.update({
    where: { id: req.params.id },
    data: { creditLimit },
  });
  await logAction({
    adminId: req.auth.id,
    action: "customer.credit_limit_update",
    details: { customerId: customer.id, creditLimit },
  });
  res.json(customer);
});

customersRouter.put("/:id", requireAuth, async (req, res) => {
  const { name, cnic, address, phone } = req.body;
  const customer = await prisma.customer.update({
    where: { id: req.params.id },
    data: { name, cnic, address, phone },
  });
  res.json(customer);
});

// Admin only — refuses to delete a customer who still has an outstanding loan
// balance, so a debt can never silently disappear.
customersRouter.delete("/:id", requireAdmin, async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!customer) return res.status(404).json({ error: "Not found" });
  if (Number(customer.loanBalance) > 0) {
    return res.status(409).json({ error: "Customer still has an outstanding loan balance — settle it before deleting" });
  }

  await prisma.customer.delete({ where: { id: req.params.id } });

  await logAction({
    adminId: req.auth.id,
    action: "customer.delete",
    details: { customerId: req.params.id, name: customer.name },
  });

  res.json({ ok: true });
});

// Manual loan repayment (customer pays down their balance in cash, outside of a sale/return)
customersRouter.post("/:id/repay-loan", requireAuth, async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: "positive amount required" });

  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!customer) return res.status(404).json({ error: "Not found" });

  const repayAmount = Math.min(Number(amount), Number(customer.loanBalance));
  const updated = await prisma.customer.update({
    where: { id: req.params.id },
    data: { loanBalance: { decrement: repayAmount } },
  });

  await logAction({
    terminalId: req.auth.terminalId,
    cashierId: req.auth.role === "cashier" ? req.auth.id : undefined,
    adminId: req.auth.role === "admin" ? req.auth.id : undefined,
    action: "customer.loan_repayment",
    details: { customerId: customer.id, amount: repayAmount },
  });

  res.json(updated);
});
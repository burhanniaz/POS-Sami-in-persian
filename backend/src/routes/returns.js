import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { logAction } from "../utils/audit.js";

export const returnsRouter = Router();

// Body: { saleId, items: [{ saleItemId, qty, restocked? }], reason? }
// Refund goes to the original payment method: cash portion -> cash refund,
// loan-paid portion -> reduces the customer's loan balance.
// Restocks by default unless the item is marked damaged (restocked: false).
returnsRouter.post("/", requireAuth, async (req, res) => {
  if (req.auth.role !== "cashier") {
    return res.status(403).json({ error: "Only a cashier terminal session can process a return" });
  }
  const { saleId, items, reason } = req.body;
  if (!saleId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "saleId and items[] are required" });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { items: true },
      });
      if (!sale) throw new HttpError(404, "Original sale not found");

      let totalRefund = 0;
      const returnItems = [];

      for (const it of items) {
        const saleItem = sale.items.find((si) => si.id === it.saleItemId);
        if (!saleItem) throw new HttpError(404, `Sale item ${it.saleItemId} not part of this sale`);

        const qty = Number(it.qty);
        if (qty <= 0 || qty > Number(saleItem.qty)) {
          throw new HttpError(400, `Invalid return qty for item ${it.saleItemId}`);
        }

        const unitRefund = Number(saleItem.lineTotal) / Number(saleItem.qty);
        const refundAmount = unitRefund * qty;
        totalRefund += refundAmount;

        const restocked = it.restocked !== false; // default true unless explicitly marked damaged
        returnItems.push({ saleItemId: it.saleItemId, qty, refundAmount, restocked });

        if (restocked) {
          await tx.product.update({
            where: { id: saleItem.productId },
            data: { stockQty: { increment: qty } },
          });
        }
      }

      // Split refund proportionally across the original payment method(s)
      const saleTotal = Number(sale.total) || 1;
      const cashRatio = Number(sale.cashPaid) / saleTotal;
      const loanRatio = Number(sale.loanPaid) / saleTotal;
      const cashRefund = totalRefund * cashRatio;
      const loanRefund = totalRefund * loanRatio;

      if (loanRefund > 0 && sale.customerId) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data: { loanBalance: { decrement: loanRefund } },
        });
      }

      const ret = await tx.return.create({
        data: {
          saleId,
          terminalId: req.auth.terminalId,
          cashierId: req.auth.id,
          reason,
          items: { create: returnItems },
        },
        include: { items: true },
      });

      return { return: ret, cashRefund, loanRefund, totalRefund };
    });

    await logAction({
      terminalId: req.auth.terminalId,
      cashierId: req.auth.id,
      action: "return.create",
      details: { saleId, returnId: result.return.id, totalRefund: result.totalRefund },
    });

    res.status(201).json(result);
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Return failed, transaction rolled back" });
  }
});

returnsRouter.get("/", requireAuth, async (req, res) => {
  const returns = await prisma.return.findMany({
    include: { items: true, sale: true, terminal: true, cashier: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(returns);
});

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { logAction } from "../utils/audit.js";
import { buildReceiptEscPos } from "../utils/escpos.js";

export const salesRouter = Router();

async function getSetting(key, fallback, client = prisma) {
  const row = await client.appSetting.findUnique({ where: { key } });
  return row ? row.value : fallback;
}

// Checkout. Body:
// { items: [{ productId, qty, discountAmount? }], customerId?, cartDiscountPercent?, cartDiscountAmount?,
//   paymentMethod: 'CASH'|'LOAN'|'PARTIAL', cashPaid?, loanPaid?,
//   adminApproval?: { username, password }  // required if discount exceeds threshold
// }
salesRouter.post("/", requireAuth, async (req, res) => {
  if (req.auth.role !== "cashier") {
    return res.status(403).json({ error: "Only a cashier terminal session can create a sale" });
  }
  const {
    items,
    customerId,
    cartDiscountPercent = 0,
    cartDiscountAmount = 0,
    paymentMethod,
    cashPaid = 0,
    loanPaid = 0,
    adminApproval,
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items[] required" });
  }
  if (!["CASH", "LOAN", "PARTIAL"].includes(paymentMethod)) {
    return res.status(400).json({ error: "paymentMethod must be CASH, LOAN, or PARTIAL" });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      let subtotal = 0;
      const lineItems = [];

      for (const it of items) {
        // Row-level lock: SELECT ... FOR UPDATE prevents two terminals from
        // both selling the last unit of a low-stock item concurrently.
        const rows = await tx.$queryRawUnsafe(
          `SELECT id, name, "salePrice", "stockQty" FROM "Product" WHERE id = $1 FOR UPDATE`,
          it.productId
        );
        const product = rows[0];
        if (!product) throw new HttpError(404, `Product ${it.productId} not found`);

        const qty = Number(it.qty);
        if (qty <= 0) throw new HttpError(400, "qty must be positive");
        if (Number(product.stockQty) < qty) {
          throw new HttpError(409, `Insufficient stock for ${product.name} (have ${product.stockQty}, need ${qty})`);
        }

        const unitPrice = Number(product.salePrice);
        const lineDiscount = Number(it.discountAmount || 0);
        const lineTotal = unitPrice * qty - lineDiscount;
        subtotal += lineTotal;

        lineItems.push({ productId: it.productId, qty, unitPrice, discountAmount: lineDiscount, lineTotal });

        // Atomic decrement guarded by the row lock above.
        await tx.product.update({
          where: { id: it.productId },
          data: { stockQty: { decrement: qty } },
        });
      }

      const discountAmount = Number(cartDiscountAmount) + Number(subtotal * (Number(cartDiscountPercent) / 100));
      const total = Math.max(0, subtotal - discountAmount);

      // Discount authorization: check against configured threshold
      const pctThreshold = Number(await getSetting("DISCOUNT_APPROVAL_THRESHOLD_PERCENT", "15", tx));
      const amtThreshold = Number(await getSetting("DISCOUNT_APPROVAL_THRESHOLD_AMOUNT", "500000", tx));
      const discountPercentOfSubtotal = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;
      const needsApproval = discountPercentOfSubtotal > pctThreshold || discountAmount > amtThreshold;

      let approvedById = null;
      if (needsApproval) {
        if (!adminApproval?.username || !adminApproval?.password) {
          throw new HttpError(403, "Discount exceeds threshold — admin approval required", {
            needsApproval: true,
            discountPercentOfSubtotal,
            discountAmount,
          });
        }
        const admin = await tx.admin.findUnique({ where: { username: adminApproval.username } });
        const ok = admin && (await bcrypt.compare(adminApproval.password, admin.passwordHash));
        if (!ok) throw new HttpError(401, "Invalid admin credentials for discount approval");
        approvedById = admin.id;
      }

      // Payment validation
      const cash = Number(cashPaid);
      const loan = Number(loanPaid);
      if (Math.abs(cash + loan - total) > 0.01) {
        throw new HttpError(400, `cashPaid + loanPaid (${cash + loan}) must equal total (${total})`);
      }
      if (loan > 0) {
        if (!customerId) throw new HttpError(400, "customerId required for loan/partial payment");
        const customer = await tx.customer.findUnique({ where: { id: customerId } });
        if (!customer) throw new HttpError(404, "Customer not found");
        const available = Number(customer.creditLimit) - Number(customer.loanBalance);
        if (loan > available) {
          throw new HttpError(409, `Loan amount exceeds available credit (available: ${available})`);
        }
        await tx.customer.update({ where: { id: customerId }, data: { loanBalance: { increment: loan } } });
      }

      const sale = await tx.sale.create({
        data: {
          terminalId: req.auth.terminalId,
          cashierId: req.auth.id,
          customerId: customerId || undefined,
          subtotal,
          discountAmount,
          discountPercent: discountPercentOfSubtotal,
          total,
          paymentMethod,
          cashPaid: cash,
          loanPaid: loan,
          approvedById: approvedById || undefined,
          items: { create: lineItems },
        },
        include: {
          items: { include: { product: true } },
          customer: true,
          cashier: true,
          terminal: true,
        },
      });

      return sale;
    }, { timeout: 15000, maxWait: 10000 });

    await logAction({
      terminalId: req.auth.terminalId,
      cashierId: req.auth.id,
      action: "sale.create",
      details: { saleId: result.id, total: result.total, paymentMethod },
    });

    const [storeName, storeAddress, storePhone, logoUrl] = await Promise.all([
      getSetting("STORE_NAME", "فروشگاه"),
      getSetting("STORE_ADDRESS", ""),
      getSetting("STORE_PHONE", ""),
      getSetting("STORE_LOGO_URL", ""),
    ]);

    const receiptPayload = buildReceiptEscPos({
      storeName,
      storeAddress,
      storePhone,
      terminalName: result.terminal.name,
      cashierName: result.cashier.name,
      saleId: result.id,
      createdAt: result.createdAt,
      items: result.items.map((i) => ({ name: i.product.name, qty: i.qty, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
      subtotal: result.subtotal,
      discountAmount: result.discountAmount,
      total: result.total,
      paymentMethod: result.paymentMethod,
      cashPaid: result.cashPaid,
      loanPaid: result.loanPaid,
      customerName: result.customer?.name,
    });

    res.status(201).json({ sale: result, receiptPrintJob: receiptPayload, logoUrl: logoUrl || null });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, ...err.extra });
    }
    console.error("Checkout failed:", err);
    // Include err.message (not just a generic string) so the real cause is visible
    // in the response instead of only in the server console.
    res.status(500).json({ error: `Checkout failed, transaction rolled back: ${err.message}` });
  }
});

salesRouter.get("/", requireAuth, async (req, res) => {
  const { from, to, terminalId, cashierId } = req.query;
  const sales = await prisma.sale.findMany({
    where: {
      createdAt: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      },
      terminalId: terminalId || undefined,
      cashierId: cashierId || undefined,
    },
    include: { items: true, customer: true, cashier: true, terminal: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(sales);
});

salesRouter.get("/:id", requireAuth, async (req, res) => {
  const sale = await prisma.sale.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { product: true } }, customer: true, cashier: true, terminal: true },
  });
  if (!sale) return res.status(404).json({ error: "Not found" });
  res.json(sale);
});

class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
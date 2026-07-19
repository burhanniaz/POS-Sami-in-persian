import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { logAction } from "../utils/audit.js";
import { buildReceiptEscPos, buildReceiptPlainText } from "../utils/escpos.js";
import { HttpError } from "../utils/httpError.js";

export const salesRouter = Router();

async function getSetting(key, fallback, client = prisma) {
  const row = await client.appSetting.findUnique({ where: { key } });
  return row ? row.value : fallback;
}

// Coerces to a finite number or throws a clean 400 instead of letting NaN
// silently slip through every downstream check (NaN <= 0 and NaN > x both
// evaluate to false, which used to defeat the stock/qty guards entirely).
function requireFiniteNumber(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new HttpError(400, `${label} must be a valid number`);
  return n;
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
      let grossSubtotal = 0; // sum of full-price line totals, before ANY discount
      let lineDiscountTotal = 0; // sum of every per-line discount
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

        const qty = requireFiniteNumber(it.qty, `qty for ${product.name}`);
        if (qty <= 0) throw new HttpError(400, `qty for ${product.name} must be positive`);
        if (Number(product.stockQty) < qty) {
          throw new HttpError(409, `Insufficient stock for ${product.name} (have ${product.stockQty}, need ${qty})`);
        }

        const unitPrice = Number(product.salePrice);
        const grossLineTotal = unitPrice * qty;

        // Per-line discount is bounded to the line's own value — it can never
        // make a line negative, and (crucially) it's now folded into the same
        // discount total the approval-threshold check runs against below, so
        // a cashier can no longer zero out a sale by discounting individual
        // lines instead of using the cart-level discount fields.
        const requestedLineDiscount = requireFiniteNumber(it.discountAmount || 0, `discount for ${product.name}`);
        if (requestedLineDiscount < 0) throw new HttpError(400, `discount for ${product.name} cannot be negative`);
        const lineDiscount = Math.min(requestedLineDiscount, grossLineTotal);
        const lineTotal = grossLineTotal - lineDiscount;

        grossSubtotal += grossLineTotal;
        lineDiscountTotal += lineDiscount;

        lineItems.push({ productId: it.productId, qty, unitPrice, discountAmount: lineDiscount, lineTotal });

        // Atomic decrement guarded by the row lock above.
        await tx.product.update({
          where: { id: it.productId },
          data: { stockQty: { decrement: qty } },
        });
      }

      const cartDiscountAmountNum = requireFiniteNumber(cartDiscountAmount, "cartDiscountAmount");
      const cartDiscountPercentNum = requireFiniteNumber(cartDiscountPercent, "cartDiscountPercent");
      if (cartDiscountAmountNum < 0) throw new HttpError(400, "cartDiscountAmount cannot be negative");
      if (cartDiscountPercentNum < 0 || cartDiscountPercentNum > 100) {
        throw new HttpError(400, "cartDiscountPercent must be between 0 and 100");
      }

      // Total discount = every per-line discount + the cart-level discount,
      // all measured against the gross (pre-discount) subtotal. This is the
      // figure the approval threshold is checked against, so there's no path
      // — line discounts, cart discount, or a mix of both — that avoids it.
      const cartDiscount = cartDiscountAmountNum + grossSubtotal * (cartDiscountPercentNum / 100);
      const discountAmount = Math.min(grossSubtotal, lineDiscountTotal + cartDiscount);
      const total = Math.max(0, grossSubtotal - discountAmount);

      const pctThreshold = Number(await getSetting("DISCOUNT_APPROVAL_THRESHOLD_PERCENT", "15", tx));
      const amtThreshold = Number(await getSetting("DISCOUNT_APPROVAL_THRESHOLD_AMOUNT", "500000", tx));
      const discountPercentOfSubtotal = grossSubtotal > 0 ? (discountAmount / grossSubtotal) * 100 : 0;
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
      const cash = requireFiniteNumber(cashPaid, "cashPaid");
      const loan = requireFiniteNumber(loanPaid, "loanPaid");
      if (cash < 0 || loan < 0) throw new HttpError(400, "cashPaid and loanPaid cannot be negative");
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
          subtotal: grossSubtotal,
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

    const receiptFields = {
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
    };
    const receiptPayload = buildReceiptEscPos(receiptFields);
    const receiptText = buildReceiptPlainText(receiptFields);

    res.status(201).json({ sale: result, receiptPrintJob: receiptPayload, receiptText, logoUrl: logoUrl || null });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, ...err.extra });
    }
    // Log the full detail server-side only; the client gets a safe, generic
    // message. Raw Prisma/DB error text (previously sent verbatim) can
    // contain schema and query internals.
    console.error("Checkout failed:", err);
    res.status(500).json({ error: "Checkout failed, transaction rolled back. Please try again." });
  }
});

salesRouter.get("/", requireAuth, async (req, res) => {
  const { from, to, terminalId, cashierId, customerId, paymentMethod, q, page = "1", pageSize = "50" } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  // Cap pageSize so a crafted request can't force one huge, slow query.
  const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 50));

  const where = {
    createdAt: {
      gte: from ? new Date(from) : undefined,
      // Treat `to` as inclusive of the whole day when only a date (no time) is given.
      lte: to ? new Date(new Date(to).setHours(23, 59, 59, 999)) : undefined,
    },
    terminalId: terminalId || undefined,
    cashierId: cashierId || undefined,
    customerId: customerId || undefined,
    paymentMethod: ["CASH", "LOAN", "PARTIAL"].includes(paymentMethod) ? paymentMethod : undefined,
    // Search matches either the receipt/sale id or the customer's name — covers
    // "customer walks in with a paper receipt" and "look up this customer's history".
    ...(q
      ? {
          OR: [{ id: { contains: q } }, { customer: { name: { contains: q, mode: "insensitive" } } }],
        }
      : {}),
  };

  const [sales, totalCount, aggregate] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        items: true,
        customer: true,
        cashier: true,
        terminal: true,
        approvedBy: { select: { id: true, username: true } },
        returns: { include: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (pageNum - 1) * pageSizeNum,
      take: pageSizeNum,
    }),
    prisma.sale.count({ where }),
    // Aggregated over the FULL filtered set (not just the current page), so the
    // summary totals shown on the page are accurate no matter which page you're on.
    prisma.sale.aggregate({
      where,
      _sum: { subtotal: true, discountAmount: true, total: true },
    }),
  ]);

  res.json({
    sales,
    page: pageNum,
    pageSize: pageSizeNum,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSizeNum)),
    summary: {
      count: totalCount,
      subtotal: aggregate._sum.subtotal || 0,
      discountAmount: aggregate._sum.discountAmount || 0,
      total: aggregate._sum.total || 0,
    },
  });
});

// Rebuilds the receipt for an already-completed sale — used by the sales
// history page's "reprint" action. Reuses the exact same receipt builder as
// checkout, just fed from stored sale data instead of a fresh transaction.
salesRouter.get("/:id/receipt", requireAuth, async (req, res) => {
  const sale = await prisma.sale.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { product: true } }, customer: true, cashier: true, terminal: true },
  });
  if (!sale) return res.status(404).json({ error: "Not found" });

  const [storeName, storeAddress, storePhone, logoUrl] = await Promise.all([
    getSetting("STORE_NAME", "فروشگاه"),
    getSetting("STORE_ADDRESS", ""),
    getSetting("STORE_PHONE", ""),
    getSetting("STORE_LOGO_URL", ""),
  ]);

  const receiptFields = {
    storeName,
    storeAddress,
    storePhone,
    terminalName: sale.terminal.name,
    cashierName: sale.cashier.name,
    saleId: sale.id,
    createdAt: sale.createdAt,
    items: sale.items.map((i) => ({ name: i.product.name, qty: i.qty, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
    subtotal: sale.subtotal,
    discountAmount: sale.discountAmount,
    total: sale.total,
    paymentMethod: sale.paymentMethod,
    cashPaid: sale.cashPaid,
    loanPaid: sale.loanPaid,
    customerName: sale.customer?.name,
  };

  res.json({
    receiptPrintJob: buildReceiptEscPos(receiptFields),
    receiptText: buildReceiptPlainText(receiptFields),
    logoUrl: logoUrl || null,
  });
});

salesRouter.get("/:id", requireAuth, async (req, res) => {
  const sale = await prisma.sale.findUnique({
    where: { id: req.params.id },
    include: {
      items: { include: { product: true } },
      customer: true,
      cashier: true,
      terminal: true,
      approvedBy: { select: { id: true, username: true } },
      returns: { include: { items: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!sale) return res.status(404).json({ error: "Not found" });
  res.json(sale);
});
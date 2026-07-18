import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const reportsRouter = Router();

// Sales summary aggregated across ALL terminals, optionally filtered by date range
reportsRouter.get("/sales-summary", requireAuth, async (req, res) => {
  const { from, to } = req.query;
  const where = {
    status: "COMPLETED",
    createdAt: {
      gte: from ? new Date(from) : undefined,
      lte: to ? new Date(to) : undefined,
    },
  };

  const sales = await prisma.sale.findMany({ where, include: { terminal: true, cashier: true } });

  const totals = sales.reduce(
    (acc, s) => {
      acc.grossSales += Number(s.subtotal);
      acc.discounts += Number(s.discountAmount);
      acc.netSales += Number(s.total);
      acc.cash += Number(s.cashPaid);
      acc.loan += Number(s.loanPaid);
      acc.count += 1;
      return acc;
    },
    { grossSales: 0, discounts: 0, netSales: 0, cash: 0, loan: 0, count: 0 }
  );

  const byTerminal = {};
  for (const s of sales) {
    const key = s.terminal.name;
    byTerminal[key] = (byTerminal[key] || 0) + Number(s.total);
  }

  res.json({ totals, byTerminal });
});

// Loan aging — how long each customer's outstanding balance has been open,
// based on their oldest unpaid loan sale.
reportsRouter.get("/loan-aging", requireAuth, async (req, res) => {
  const customers = await prisma.customer.findMany({
    where: { loanBalance: { gt: 0 } },
    include: { sales: { where: { loanPaid: { gt: 0 } }, orderBy: { createdAt: "asc" }, take: 1 } },
  });

  const now = Date.now();
  const rows = customers.map((c) => {
    const oldest = c.sales[0]?.createdAt;
    const daysOpen = oldest ? Math.floor((now - new Date(oldest).getTime()) / 86400000) : null;
    return {
      customerId: c.id,
      name: c.name,
      loanBalance: Number(c.loanBalance),
      creditLimit: Number(c.creditLimit),
      oldestUnpaidSaleDate: oldest,
      daysOpen,
      bucket: daysOpen == null ? "n/a" : daysOpen <= 30 ? "0-30" : daysOpen <= 60 ? "31-60" : daysOpen <= 90 ? "61-90" : "90+",
    };
  });

  res.json(rows.sort((a, b) => (b.daysOpen ?? 0) - (a.daysOpen ?? 0)));
});

// Low-stock alerts across all products
reportsRouter.get("/low-stock", requireAuth, async (req, res) => {
  const products = await prisma.product.findMany({ where: { active: true }, include: { supplier: true } });
  const lowStock = products.filter((p) => Number(p.stockQty) <= Number(p.lowStockThreshold));
  res.json(lowStock);
});

// Best sellers by quantity sold, aggregated across all terminals
reportsRouter.get("/best-sellers", requireAuth, async (req, res) => {
  const { from, to, limit = 20 } = req.query;
  const items = await prisma.saleItem.findMany({
    where: {
      sale: {
        status: "COMPLETED",
        createdAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined },
      },
    },
    include: { product: true },
  });

  const byProduct = {};
  for (const i of items) {
    const key = i.productId;
    if (!byProduct[key]) byProduct[key] = { productId: key, name: i.product.name, qtySold: 0, revenue: 0 };
    byProduct[key].qtySold += Number(i.qty);
    byProduct[key].revenue += Number(i.lineTotal);
  }

  const ranked = Object.values(byProduct)
    .sort((a, b) => b.qtySold - a.qtySold)
    .slice(0, Number(limit));

  res.json(ranked);
});

// Live dashboard summary: sums the above into one call for the admin dashboard landing view
reportsRouter.get("/dashboard", requireAuth, async (req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [todaysSales, lowStockCount, activeSessions] = await Promise.all([
    prisma.sale.aggregate({
      where: { createdAt: { gte: todayStart }, status: "COMPLETED" },
      _sum: { total: true },
      _count: true,
    }),
    prisma.product.count({ where: { active: true } }).then(async (total) => {
      const products = await prisma.product.findMany({ where: { active: true } });
      return products.filter((p) => Number(p.stockQty) <= Number(p.lowStockThreshold)).length;
    }),
    prisma.cashierSession.count({ where: { endedAt: null } }),
  ]);

  res.json({
    todaysSalesTotal: Number(todaysSales._sum.total || 0),
    todaysSalesCount: todaysSales._count,
    lowStockCount,
    activeCashierSessions: activeSessions,
  });
});

import { Router } from "express";
import { prisma } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";

export const auditRouter = Router();

auditRouter.get("/", requireAdmin, async (req, res) => {
  const logs = await prisma.auditLog.findMany({
    include: { terminal: true, cashier: true, admin: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  res.json(logs);
});

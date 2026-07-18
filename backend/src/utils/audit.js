import { prisma } from "../db.js";

// Every action (sale, refund, stock edit, login) must log which terminal + which cashier performed it.
export async function logAction({ terminalId, cashierId, adminId, action, details }) {
  try {
    await prisma.auditLog.create({
      data: { terminalId, cashierId, adminId, action, details: details ?? undefined },
    });
  } catch (err) {
    // Never let audit logging failure break the primary action
    console.error("audit log failed:", err);
  }
}

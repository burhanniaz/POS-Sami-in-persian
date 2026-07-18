import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export function signToken(payload, expiresIn = "12h") {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

// Requires any authenticated user (cashier or admin)
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  try {
    const token = header.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    req.auth = decoded; // { role: 'cashier'|'admin', id, terminalId?, sessionId? }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

// Requires admin role specifically
export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.auth.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  });
}

// Allows either role but exposes which one
export function requireCashierOrAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.auth.role !== "cashier" && req.auth.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }
    next();
  });
}

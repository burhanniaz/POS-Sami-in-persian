import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { logAction } from "../utils/audit.js";
import { buildBarcodeLabelEscPos, generateInternalBarcode } from "../utils/escpos.js";
import { uploadProductImage } from "../middleware/upload.js";

export const productsRouter = Router();

// Upload a product image. Returns a URL to store in the product's imageUrl field
// (used by both the "new product" and "edit product" forms on the frontend, since
// a brand-new product doesn't have an id yet to attach the file to directly).
productsRouter.post("/upload-image", requireAdmin, uploadProductImage.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image file received" });
  const imageUrl = `/uploads/products/${req.file.filename}`;
  res.status(201).json({ imageUrl });
});

// List / search products (used by inventory screen and cart search)
productsRouter.get("/", requireAuth, async (req, res) => {
  const { q, lowStock } = req.query;
  const where = {
    active: true,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { barcode: { contains: q } },
            { category: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const products = await prisma.product.findMany({
    where,
    include: { supplier: true },
    orderBy: { name: "asc" },
  });
  const filtered =
    lowStock === "true" ? products.filter((p) => Number(p.stockQty) <= Number(p.lowStockThreshold)) : products;
  res.json(filtered);
});

// Barcode scan lookup — exact match, used at checkout
productsRouter.get("/barcode/:code", requireAuth, async (req, res) => {
  const product = await prisma.product.findUnique({ where: { barcode: req.params.code } });
  if (!product) return res.status(404).json({ error: "Product not found for this barcode" });
  res.json(product);
});

// Create product. If no barcode supplied, auto-generate one and return the
// ESC/POS label payload so the frontend can send it to QZ Tray for printing.
productsRouter.post("/", requireAdmin, async (req, res) => {
  const { name, barcode, category, costPrice, salePrice, stockQty, unit, supplierId, lowStockThreshold, imageUrl } = req.body;
  if (!name || costPrice == null || salePrice == null) {
    return res.status(400).json({ error: "name, costPrice, salePrice are required" });
  }
  if (!Number.isFinite(Number(costPrice)) || !Number.isFinite(Number(salePrice)) || Number(costPrice) < 0 || Number(salePrice) < 0) {
    return res.status(400).json({ error: "costPrice and salePrice must be non-negative numbers" });
  }

  const requestedBarcode = barcode?.trim();

  // Two admins/terminals creating a product at the same instant could
  // previously both read the same product count and generate the identical
  // auto-barcode, then crash on the unique constraint. Retry a few times
  // with a fresh count on conflict instead of failing the whole request.
  let product;
  let barcodeGenerated = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    let finalBarcode = requestedBarcode;
    barcodeGenerated = false;
    if (!finalBarcode) {
      const count = await prisma.product.count();
      finalBarcode = generateInternalBarcode(count + 1 + attempt);
      barcodeGenerated = true;
    }

    try {
      product = await prisma.product.create({
        data: {
          name,
          barcode: finalBarcode,
          barcodeGenerated,
          imageUrl,
          category,
          costPrice,
          salePrice,
          stockQty: stockQty ?? 0,
          unit: unit ?? "piece",
          lowStockThreshold: lowStockThreshold ?? 5,
          supplierId: supplierId || undefined,
        },
      });
      break;
    } catch (err) {
      const isBarcodeConflict = err.code === "P2002" && barcodeGenerated;
      if (!isBarcodeConflict || attempt === 4) {
        if (err.code === "P2002") {
          return res.status(409).json({ error: "That barcode is already in use by another product" });
        }
        throw err;
      }
      // otherwise loop and retry with a new generated barcode
    }
  }

  await logAction({ adminId: req.auth.id, action: "product.create", details: { productId: product.id } });

  const response = { product };
  if (barcodeGenerated) {
    response.printLabel = buildBarcodeLabelEscPos({ productName: product.name, barcode: product.barcode });
  }
  res.status(201).json(response);
});

productsRouter.put("/:id", requireAdmin, async (req, res) => {
  const { name, category, costPrice, salePrice, unit, supplierId, lowStockThreshold, active, imageUrl } = req.body;
  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: { name, category, costPrice, salePrice, unit, supplierId, lowStockThreshold, active, imageUrl },
  });
  await logAction({ adminId: req.auth.id, action: "product.update", details: { productId: product.id } });
  res.json(product);
});

// Manual stock adjustment (receiving new stock, correction, etc.)
productsRouter.post("/:id/adjust-stock", requireAuth, async (req, res) => {
  const { delta, reason } = req.body;
  const deltaNum = Number(delta);
  if (delta == null || !Number.isFinite(deltaNum)) {
    return res.status(400).json({ error: "delta must be a valid number" });
  }

  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: { stockQty: { increment: deltaNum } },
  });

  await logAction({
    terminalId: req.auth.terminalId,
    cashierId: req.auth.role === "cashier" ? req.auth.id : undefined,
    adminId: req.auth.role === "admin" ? req.auth.id : undefined,
    action: "product.stock_adjust",
    details: { productId: product.id, delta, reason },
  });

  res.json(product);
});

// Re-print the barcode label for an existing product
productsRouter.get("/:id/print-label", requireAuth, async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ error: "Not found" });
  res.json({ printLabel: buildBarcodeLabelEscPos({ productName: product.name, barcode: product.barcode }) });
});
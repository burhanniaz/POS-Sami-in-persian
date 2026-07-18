// Builds raw ESC/POS byte sequences for thermal receipt printers.
// The web app never talks to the printer directly — it sends this payload
// (as base64) to the terminal's local QZ Tray instance over localhost WebSocket.
// QZ Tray then forwards raw bytes to the USB/Bluetooth printer attached to that PC.

const ESC = "\x1b";
const GS = "\x1d";

const CMD = {
  INIT: ESC + "@",
  ALIGN_LEFT: ESC + "a" + "\x00",
  ALIGN_CENTER: ESC + "a" + "\x01",
  BOLD_ON: ESC + "E" + "\x01",
  BOLD_OFF: ESC + "E" + "\x00",
  DOUBLE_ON: GS + "!" + "\x11",
  DOUBLE_OFF: GS + "!" + "\x00",
  CUT: GS + "V" + "\x00",
  DRAWER_KICK: ESC + "p" + "\x00" + "\x19" + "\xfa",
  LF: "\n",
};

function line(char = "-", width = 32) {
  return char.repeat(width) + "\n";
}

function padRight(text, width) {
  const t = String(text);
  return t.length >= width ? t.slice(0, width) : t + " ".repeat(width - t.length);
}

function padLeft(text, width) {
  const t = String(text);
  return t.length >= width ? t.slice(0, width) : " ".repeat(width - t.length) + t;
}

// items: [{ name, qty, unitPrice, lineTotal }]
export function buildReceiptEscPos({
  storeName = "فروشگاه",
  storeAddress,
  storePhone,
  terminalName,
  cashierName,
  saleId,
  createdAt,
  items,
  subtotal,
  discountAmount,
  total,
  paymentMethod,
  cashPaid,
  loanPaid,
  customerName,
  withDrawerKick = false,
}) {
  let out = "";
  out += CMD.INIT;
  out += CMD.ALIGN_CENTER + CMD.BOLD_ON + CMD.DOUBLE_ON;
  out += storeName + "\n";
  out += CMD.DOUBLE_OFF + CMD.BOLD_OFF;
  if (storeAddress) out += storeAddress + "\n";
  if (storePhone) out += storePhone + "\n";
  out += CMD.ALIGN_LEFT + line();
  out += `Terminal: ${terminalName}  Cashier: ${cashierName}\n`;
  out += `Sale #${saleId}\n${new Date(createdAt).toISOString()}\n`;
  out += line();

  for (const it of items) {
    out += padRight(it.name, 20) + padLeft(it.qty, 4) + padLeft(it.lineTotal, 8) + "\n";
  }

  out += line();
  out += padRight("Subtotal", 22) + padLeft(subtotal, 10) + "\n";
  if (Number(discountAmount) > 0) {
    out += padRight("Discount", 22) + padLeft("-" + discountAmount, 10) + "\n";
  }
  out += CMD.BOLD_ON + padRight("Total", 22) + padLeft(total, 10) + CMD.BOLD_OFF + "\n";
  out += line();
  out += `Payment: ${paymentMethod}\n`;
  if (Number(cashPaid) > 0) out += padRight("Cash", 22) + padLeft(cashPaid, 10) + "\n";
  if (Number(loanPaid) > 0) out += padRight("On Loan", 22) + padLeft(loanPaid, 10) + "\n";
  if (customerName) out += `Customer: ${customerName}\n`;
  out += "\n" + CMD.ALIGN_CENTER + "Thank you\n\n\n";
  if (withDrawerKick) out += CMD.DRAWER_KICK;
  out += CMD.CUT;

  return Buffer.from(out, "binary").toString("base64");
}

// Barcode label for a newly-generated (non-vendor) product barcode.
export function buildBarcodeLabelEscPos({ productName, barcode }) {
  let out = "";
  out += CMD.INIT;
  out += CMD.ALIGN_CENTER;
  out += productName.slice(0, 32) + "\n";
  // GS k m d1...dk NUL — CODE39 barcode, human-readable text below (GS H 2)
  out += GS + "H" + "\x02";
  out += GS + "h" + "\x50"; // height
  out += GS + "w" + "\x02"; // width
  out += GS + "k" + "\x04" + barcode + "\x00"; // m=4 => CODE39
  out += "\n\n";
  out += CMD.CUT;
  return Buffer.from(out, "binary").toString("base64");
}

// Generates a unique internal barcode for products with no vendor barcode.
// Format: "2" + 6-digit sequential-ish number + check digit, kept simple (EAN-13-like, 13 digits).
export function generateInternalBarcode(sequenceNumber) {
  const prefix = "20"; // internal-use prefix range, common convention for in-store generated codes
  const body = String(sequenceNumber).padStart(10, "0");
  const partial = prefix + body; // 12 digits
  const check = ean13CheckDigit(partial);
  return partial + check;
}

function ean13CheckDigit(twelveDigits) {
  const digits = twelveDigits.split("").map(Number);
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  return String((10 - (sum % 10)) % 10);
}
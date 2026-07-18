import qz from "qz-tray";

let connecting = null;

// Connects to the local QZ Tray instance (must be installed + running on this terminal's PC).
// See README "Printer setup" — production deployments need a signed certificate configured
// here (qz.security.setCertificatePromise / setSignaturePromise) or QZ Tray will show a
// one-time "unblock this site" popup on each browser session, which is fine for LAN use.
async function ensureConnected() {
  if (qz.websocket.isActive()) return true;
  if (connecting) return connecting;

  connecting = qz.websocket
    .connect({ retries: 1, delay: 1 })
    .then(() => true)
    .catch((err) => {
      console.warn("QZ Tray not reachable on this terminal:", err.message);
      return false;
    })
    .finally(() => {
      connecting = null;
    });

  return connecting;
}

// Sends a base64-encoded raw ESC/POS payload (as produced by the backend) to the
// terminal's local printer. Falls back to browser print if the local agent is offline,
// exactly as specified: "Fallback: browser-native window.print() if the local agent is offline."
// If logoUrl is provided, it's printed as a raster image immediately before the text
// receipt, in the same print job — QZ Tray handles the image-to-monochrome-raster
// conversion automatically, no manual bitmap encoding needed on our end.
export async function printReceipt(base64Payload, { printerName, plainTextFallback, logoUrl } = {}) {
  const connected = await ensureConnected();

  if (connected) {
    try {
      const printer = printerName || (await qz.printers.getDefault());
      const config = qz.configs.create(printer);
      const data = [];
      if (logoUrl) {
        data.push({ type: "raster", format: "image", data: logoUrl, options: { language: "ESCPOS" } });
      }
      data.push({ type: "raw", format: "base64", data: base64Payload });
      await qz.print(config, data);
      return { method: "qz-tray" };
    } catch (err) {
      console.error("QZ Tray print failed, falling back to browser print:", err);
    }
  }

  printViaBrowser(plainTextFallback || "Print agent unavailable — open Inventory > receipt detail for text.");
  return { method: "browser-fallback" };
}

function printViaBrowser(text) {
  const win = window.open("", "_blank", "width=320,height=600");
  if (!win) return;
  win.document.write(
    `<pre style="font-family:monospace;font-size:12px;white-space:pre-wrap;margin:0;padding:12px;">${escapeHtml(
      text
    )}</pre>`
  );
  win.document.close();
  win.focus();
  win.print();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function listPrinters() {
  const connected = await ensureConnected();
  if (!connected) return [];
  try {
    return await qz.printers.find();
  } catch {
    return [];
  }
}
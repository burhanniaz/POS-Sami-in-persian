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
        // QZ Tray has no "raster" type — embedding an image in a raw ESC/POS job
        // requires type:'raw', format:'image', flavor:'base64' with actual base64
        // image bytes (not a URL). Fetch + convert here; if that fails for any
        // reason (bad URL, network hiccup), skip the logo but still print the
        // text receipt rather than failing the whole job.
        const logoBase64 = await fetchImageAsBase64(logoUrl).catch((err) => {
          console.warn("Could not load receipt logo, printing without it:", err.message);
          return null;
        });
        if (logoBase64) {
          data.push({ type: "raw", format: "image", flavor: "base64", data: logoBase64, options: { language: "ESCPOS" } });
        }
      }
      data.push({ type: "raw", format: "base64", data: base64Payload });
      await qz.print(config, data);
      return { method: "qz-tray" };
    } catch (err) {
      console.error("QZ Tray print failed, falling back to browser print:", err);
    }
  }

  printViaBrowser(plainTextFallback || "Print agent unavailable — open Inventory > receipt detail for text.", logoUrl);
  return { method: "browser-fallback" };
}

// Fetches an image URL and returns its raw bytes as a plain base64 string
// (no "data:image/..." prefix — QZ Tray's base64 flavor expects bare base64).
async function fetchImageAsBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Logo fetch failed: HTTP ${res.status}`);
  const blob = await res.blob();
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("FileReader failed to read logo blob"));
    reader.readAsDataURL(blob);
  });
  return dataUrl.split(",")[1];
}

// Exported so callers can trigger this directly from a fresh click handler.
// window.open() called deep inside an async chain (after the checkout API call
// and a QZ connect attempt) can lose the browser's "user activation" and get
// silently blocked with no error — calling this from a real click event avoids that.
export function printReceiptWindow(text, logoUrl) {
  printViaBrowser(text, logoUrl);
}

function printViaBrowser(text, logoUrl) {
  const win = window.open("", "_blank", "width=320,height=600");
  if (!win) return;
  const logoHtml = logoUrl
    ? `<div style="text-align:center;margin-bottom:8px;"><img src="${escapeHtml(
        logoUrl
      )}" style="max-width:200px;max-height:120px;" /></div>`
    : "";
  win.document.write(
    `${logoHtml}<pre style="font-family:monospace;font-size:12px;white-space:pre-wrap;margin:0;padding:12px;">${escapeHtml(
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
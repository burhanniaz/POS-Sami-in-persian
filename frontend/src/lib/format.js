// Currency: plain numbers, no symbol, comma thousands separator, Western digits only.
export function formatMoney(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

export function formatQty(value) {
  const n = Number(value || 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

// Gregorian calendar explicitly (not Jalali), Western digits.
export function formatDate(value) {
  const d = new Date(value);
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

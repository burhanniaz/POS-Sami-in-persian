import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { formatMoney, formatDate } from "../lib/format.js";
import { Icon } from "../components/Icon.jsx";
import { printReceipt } from "../lib/print.js";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function firstOfMonthStr() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

const PAYMENT_LABELS = { CASH: "نقدی", LOAN: "قرضی", PARTIAL: "ترکیبی" };

// Sums returned qty vs sold qty across a sale's line items to decide the
// return-status badge without a separate request per row — the backend
// already includes `returns` on each sale in the list response.
function returnStatus(sale) {
  const soldQty = sale.items.reduce((sum, i) => sum + Number(i.qty), 0);
  const returnedQty = sale.returns.reduce(
    (sum, r) => sum + r.items.reduce((s, ri) => s + Number(ri.qty), 0),
    0
  );
  if (returnedQty <= 0) return null;
  return returnedQty >= soldQty ? "fully" : "partially";
}

export default function SalesHistory() {
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [terminalId, setTerminalId] = useState("");
  const [cashierId, setCashierId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const [terminals, setTerminals] = useState([]);
  const [cashiers, setCashiers] = useState([]);
  const [data, setData] = useState({ sales: [], totalPages: 1, totalCount: 0, summary: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    api.get("/auth/terminals").then(setTerminals).catch(() => {});
    api.get("/auth/cashiers").then(setCashiers).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (terminalId) params.set("terminalId", terminalId);
      if (cashierId) params.set("cashierId", cashierId);
      if (paymentMethod) params.set("paymentMethod", paymentMethod);
      if (q) params.set("q", q);
      params.set("page", String(page));
      const result = await api.get(`/sales?${params.toString()}`);
      setData(result);
    } catch (err) {
      setError(err.data?.error || "خطا در بارگذاری فروش‌ها");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, terminalId, cashierId, paymentMethod, q, page]);

  // Any filter change other than page itself should reset back to page 1.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, terminalId, cashierId, paymentMethod, q]);

  function setPreset(preset) {
    if (preset === "today") { setFrom(todayStr()); setTo(todayStr()); }
    if (preset === "yesterday") { setFrom(daysAgoStr(1)); setTo(daysAgoStr(1)); }
    if (preset === "week") { setFrom(daysAgoStr(7)); setTo(todayStr()); }
    if (preset === "month") { setFrom(firstOfMonthStr()); setTo(todayStr()); }
  }

  const summary = data.summary;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="rtl text-lg font-semibold">سوابق فروش</h2>

      <div className="bg-card rounded-card p-3 flex flex-wrap items-end gap-3">
        <div className="flex gap-1">
          {[
            ["today", "امروز"],
            ["yesterday", "دیروز"],
            ["week", "۷ روز اخیر"],
            ["month", "این ماه"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPreset(key)}
              className="rtl h-8 px-3 rounded-lg text-xs border border-line text-subtle hover:bg-paper"
            >
              {label}
            </button>
          ))}
        </div>

        <div>
          <label className="rtl block text-xs text-subtle mb-1">از تاریخ</label>
          <input type="date" className="h-9 rounded-lg border border-line px-2 text-sm num" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="rtl block text-xs text-subtle mb-1">تا تاریخ</label>
          <input type="date" className="h-9 rounded-lg border border-line px-2 text-sm num" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="rtl block text-xs text-subtle mb-1">ترمینال</label>
          <select className="h-9 rounded-lg border border-line px-2 text-sm rtl" value={terminalId} onChange={(e) => setTerminalId(e.target.value)}>
            <option value="">همه ترمینال‌ها</option>
            {terminals.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="rtl block text-xs text-subtle mb-1">صندوق‌دار</label>
          <select className="h-9 rounded-lg border border-line px-2 text-sm rtl" value={cashierId} onChange={(e) => setCashierId(e.target.value)}>
            <option value="">همه صندوق‌داران</option>
            {cashiers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="rtl block text-xs text-subtle mb-1">پرداخت</label>
          <select className="h-9 rounded-lg border border-line px-2 text-sm rtl" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="">همه</option>
            <option value="CASH">نقدی</option>
            <option value="LOAN">قرضی</option>
            <option value="PARTIAL">ترکیبی</option>
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="rtl block text-xs text-subtle mb-1">جستجو (شماره رسید یا نام مشتری)</label>
          <div className="h-9 rounded-lg border border-line px-2 flex items-center gap-2">
            <Icon name="search" size={14} className="text-muted" />
            <input className="flex-1 outline-none text-sm rtl placeholder:text-muted" value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو…" />
          </div>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-4 gap-3">
          <Metric label="تعداد فروش" value={summary.count} />
          <Metric label="جمع کل قبل از تخفیف" value={formatMoney(summary.subtotal)} />
          <Metric label="تخفیف" value={formatMoney(summary.discountAmount)} />
          <Metric label="مبلغ دریافتی" value={formatMoney(summary.total)} />
        </div>
      )}

      {error && <p className="rtl text-sm text-danger">{error}</p>}

      <div className="bg-card rounded-card p-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-subtle border-b border-line">
              <th className="text-right py-2 px-3">رسید</th>
              <th className="text-right py-2 px-3">تاریخ</th>
              <th className="text-right py-2 px-3">صندوق‌دار</th>
              <th className="text-right py-2 px-3">مشتری</th>
              <th className="text-right py-2 px-3">اقلام</th>
              <th className="text-right py-2 px-3">مبلغ</th>
              <th className="text-right py-2 px-3">پرداخت</th>
              <th className="text-right py-2 px-3">وضعیت</th>
            </tr>
          </thead>
          <tbody>
            {data.sales.map((sale) => {
              const status = returnStatus(sale);
              return (
                <tr
                  key={sale.id}
                  onClick={() => setSelectedId(sale.id)}
                  className="border-b border-line last:border-0 cursor-pointer hover:bg-paper"
                >
                  <td className="py-2 px-3 num text-right">{sale.id.slice(-8)}</td>
                  <td className="py-2 px-3 num text-right">{formatDate(sale.createdAt)}</td>
                  <td className="py-2 px-3 rtl">{sale.cashier?.name || "—"}</td>
                  <td className="py-2 px-3 rtl">{sale.customer?.name || "فروش نقدی"}</td>
                  <td className="py-2 px-3 num text-right">{sale.items.length}</td>
                  <td className="py-2 px-3 num text-right">{formatMoney(sale.total)}</td>
                  <td className="py-2 px-3 text-right">
                    <span className="rtl text-[11px] px-2 py-0.5 rounded-lg bg-accent-light text-accent-dark">
                      {PAYMENT_LABELS[sale.paymentMethod] || sale.paymentMethod}
                    </span>
                  </td>
                  <td className="py-2 px-3 rtl">
                    {status === "fully" && <span className="text-danger">مرجوع کامل</span>}
                    {status === "partially" && <span className="text-warn">مرجوع جزئی</span>}
                    {!status && sale.approvedById && <span className="text-subtle">تخفیف با تایید</span>}
                    {!status && !sale.approvedById && <span className="text-muted">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && data.sales.length === 0 && <p className="rtl text-sm text-muted text-center py-10">فروشی در این بازه یافت نشد</p>}
        {loading && <p className="rtl text-sm text-muted text-center py-10">در حال بارگذاری…</p>}

        {data.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-3">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-8 px-3 rounded-lg border border-line text-xs disabled:opacity-40 rtl">
              قبلی
            </button>
            <span className="rtl text-xs text-subtle num">
              صفحه {page} از {data.totalPages}
            </span>
            <button disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="h-8 px-3 rounded-lg border border-line text-xs disabled:opacity-40 rtl">
              بعدی
            </button>
          </div>
        )}
      </div>

      {selectedId && <SaleDetailModal saleId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="bg-card rounded-card p-4">
      <p className="rtl text-xs text-subtle mb-1">{label}</p>
      <p className="num text-2xl font-semibold">{value}</p>
    </div>
  );
}

function SaleDetailModal({ saleId, onClose }) {
  const [sale, setSale] = useState(null);
  const [error, setError] = useState("");
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    api.get(`/sales/${saleId}`).then(setSale).catch((err) => setError(err.data?.error || "خطا در بارگذاری فروش"));
  }, [saleId]);

  async function reprint() {
    setPrinting(true);
    try {
      const { receiptPrintJob, receiptText, logoUrl } = await api.get(`/sales/${saleId}/receipt`);
      await printReceipt(receiptPrintJob, { plainTextFallback: receiptText, logoUrl });
    } catch (err) {
      setError(err.data?.error || "خطا در چاپ رسید");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-card w-full max-w-lg p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="rtl text-lg font-semibold">جزئیات فروش</h3>
          <button onClick={onClose} className="text-muted">
            <Icon name="x" size={18} />
          </button>
        </div>

        {error && <p className="rtl text-xs text-danger mb-3">{error}</p>}

        {!sale && !error && <p className="rtl text-sm text-muted text-center py-10">در حال بارگذاری…</p>}

        {sale && (
          <>
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="num text-sm font-medium">#{sale.id.slice(-8)}</p>
                <p className="rtl text-xs text-subtle num">
                  {formatDate(sale.createdAt)} — {sale.terminal.name} — {sale.cashier.name}
                </p>
              </div>
              <button onClick={reprint} disabled={printing} className="rtl h-9 px-3 rounded-lg border border-line text-xs flex items-center gap-1 disabled:opacity-50">
                <Icon name="print" size={14} />
                {printing ? "در حال چاپ…" : "چاپ مجدد"}
              </button>
            </div>

            <p className="rtl text-xs text-subtle mb-3">مشتری: {sale.customer?.name || "فروش نقدی"}</p>

<table className="w-full text-xs mb-3">
              <thead>
                <tr className="text-subtle border-b border-line">
                  <th className="text-right py-1 px-2">کالا</th>
                  <th className="text-right py-1 px-2">تعداد</th>
                  <th className="text-right py-1 px-2">قیمت</th>
                  <th className="text-right py-1 px-2">تخفیف</th>
                  <th className="text-right py-1 px-2">جمع</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((i) => (
                  <tr key={i.id} className="border-b border-line last:border-0">
                    <td className="py-1 px-2 rtl">{i.product.name}</td>
                    <td className="py-1 px-2 num text-right">{i.qty}</td>
                    <td className="py-1 px-2 num text-right">{formatMoney(i.unitPrice)}</td>
                    <td className="py-1 px-2 num text-right">{formatMoney(i.discountAmount)}</td>
                    <td className="py-1 px-2 num text-right">{formatMoney(i.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-line pt-2 text-xs flex flex-col gap-1">
              <Row label="جمع کل قبل از تخفیف" value={formatMoney(sale.subtotal)} />
              <Row label="تخفیف" value={formatMoney(sale.discountAmount)} />
              <Row label="مبلغ نهایی" value={formatMoney(sale.total)} bold />
            </div>

            <div className="border-t border-line mt-2 pt-2 text-xs flex flex-col gap-1">
              {Number(sale.cashPaid) > 0 && <Row label="پرداخت نقدی" value={formatMoney(sale.cashPaid)} />}
              {Number(sale.loanPaid) > 0 && <Row label="پرداخت قرضی" value={formatMoney(sale.loanPaid)} />}
            </div>

            {sale.approvedBy && (
              <p className="rtl text-xs text-subtle mt-2">تخفیف تایید شده توسط: {sale.approvedBy.username}</p>
            )}

            {sale.returns.length > 0 && (
              <div className="border-t border-line mt-3 pt-2">
                <p className="rtl text-xs font-medium mb-2">مرجوعی‌های این فروش</p>
                {sale.returns.map((ret) => (
                  <div key={ret.id} className="bg-paper rounded-lg p-2 mb-2 text-xs">
                    {ret.items.map((ri) => (
                      <div key={ri.id} className="rtl flex items-center justify-between">
                        <span>{ri.qty} عدد {ri.restocked ? "(بازگشت به موجودی)" : "(آسیب‌دیده)"}</span>
                        <span className="num text-danger">-{formatMoney(ri.refundAmount)}</span>
                      </div>
                    ))}
                    <p className="rtl text-muted mt-1 num">
                      {formatDate(ret.createdAt)}{ret.reason ? ` — ${ret.reason}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`rtl flex items-center justify-between ${bold ? "font-semibold text-sm" : ""}`}>
      <span className={bold ? "" : "text-subtle"}>{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}

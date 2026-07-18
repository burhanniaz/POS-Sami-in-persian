import { useState } from "react";
import { api } from "../api/client.js";
import { formatMoney, formatDate } from "../lib/format.js";

export default function Returns() {
  const [saleId, setSaleId] = useState("");
  const [sale, setSale] = useState(null);
  const [selections, setSelections] = useState({}); // saleItemId -> { qty, restocked }
  const [reason, setReason] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function findSale() {
    setError("");
    setResult(null);
    try {
      const data = await api.get(`/sales/${saleId.trim()}`);
      setSale(data);
      setSelections({});
    } catch (err) {
      setError(err.data?.error || "فروش یافت نشد");
      setSale(null);
    }
  }

  function toggleItem(item) {
    setSelections((prev) => {
      const next = { ...prev };
      if (next[item.id]) {
        delete next[item.id];
      } else {
        next[item.id] = { qty: Number(item.qty), restocked: true };
      }
      return next;
    });
  }

  function updateSelection(id, patch) {
    setSelections((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function submitReturn() {
    setError("");
    const items = Object.entries(selections).map(([saleItemId, s]) => ({
      saleItemId,
      qty: s.qty,
      restocked: s.restocked,
    }));
    if (items.length === 0) return setError("حداقل یک کالا را انتخاب کنید");
    try {
      const res = await api.post("/returns", { saleId: sale.id, items, reason });
      setResult(res);
      setSale(null);
      setSaleId("");
      setSelections({});
    } catch (err) {
      setError(err.data?.error || "خطا در ثبت مرجوعی");
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <h2 className="rtl text-lg font-semibold">مرجوعی و بازپرداخت</h2>

      <div className="bg-card rounded-card p-4">
        <label className="rtl block text-xs text-subtle mb-1">شناسه فروش</label>
        <div className="flex gap-2">
          <input
            className="flex-1 h-9 rounded-lg border border-line px-2 text-sm num"
            value={saleId}
            onChange={(e) => setSaleId(e.target.value)}
            placeholder="Sale ID"
          />
          <button onClick={findSale} className="h-9 px-4 rounded-lg bg-accent text-white text-sm rtl">
            جستجو
          </button>
        </div>
        {error && <p className="rtl text-xs text-danger mt-2">{error}</p>}
      </div>

      {sale && (
        <div className="bg-card rounded-card p-4">
          <p className="rtl text-xs text-subtle mb-3">
            تاریخ فروش: <span className="num">{formatDate(sale.createdAt)}</span> — مبلغ کل: <span className="num">{formatMoney(sale.total)}</span>
          </p>

          <div className="flex flex-col gap-3 mb-4">
            {sale.items.map((item) => {
              const selected = selections[item.id];
              return (
                <div key={item.id} className="border border-line rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="rtl flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={!!selected} onChange={() => toggleItem(item)} />
                      {item.product.name}
                    </label>
                    <span className="num text-xs text-subtle">
                      {item.qty} × {formatMoney(item.unitPrice)}
                    </span>
                  </div>
                  {selected && (
                    <div className="flex items-center gap-4 rtl text-xs">
                      <label className="flex items-center gap-1">
                        تعداد مرجوعی:
                        <input
                          type="number"
                          min="1"
                          max={item.qty}
                          className="num w-14 h-7 rounded border border-line px-1"
                          value={selected.qty}
                          onChange={(e) => updateSelection(item.id, { qty: Number(e.target.value) })}
                        />
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={selected.restocked}
                          onChange={(e) => updateSelection(item.id, { restocked: e.target.checked })}
                        />
                        بازگشت به موجودی (غیرفعال کنید اگر آسیب‌دیده است)
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <label className="rtl block text-xs text-subtle mb-1">دلیل مرجوعی</label>
          <input className="w-full h-9 rounded-lg border border-line px-2 mb-4 text-sm rtl" value={reason} onChange={(e) => setReason(e.target.value)} />

          <button onClick={submitReturn} className="w-full h-11 rounded-xl bg-accent text-white text-sm font-semibold rtl">
            ثبت مرجوعی و بازپرداخت
          </button>
        </div>
      )}

      {result && (
        <div className="bg-accent-light rounded-card p-4">
          <p className="rtl text-sm text-accent-dark mb-1">مرجوعی با موفقیت ثبت شد</p>
          <p className="rtl text-xs text-subtle">
            بازپرداخت نقدی: <span className="num">{formatMoney(result.cashRefund)}</span> — کاهش بدهی:{" "}
            <span className="num">{formatMoney(result.loanRefund)}</span>
          </p>
        </div>
      )}
    </div>
  );
}

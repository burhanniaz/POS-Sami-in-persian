import { useEffect, useMemo, useState } from "react";
import { api, resolveImageUrl } from "../api/client.js";
import { formatMoney, formatQty } from "../lib/format.js";
import { printReceipt, printReceiptWindow } from "../lib/print.js";
import { Icon } from "../components/Icon.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function POS() {
  const { auth } = useAuth();
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState([]); // [{product, qty}]
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [error, setError] = useState("");
  const [lastReceiptText, setLastReceiptText] = useState(null);
  const [lastReceiptLogo, setLastReceiptLogo] = useState(null);

  async function loadProducts() {
    const data = await api.get(`/products${query ? `?q=${encodeURIComponent(query)}` : ""}`);
    setProducts(data);
  }

  useEffect(() => {
    loadProducts();
    api.get("/customers").then(setCustomers).catch(() => {});
    // Live sync across terminals: poll every 5-10s per spec
    const interval = setInterval(loadProducts, 7000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(loadProducts, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function handleBarcodeEnter(e) {
    if (e.key !== "Enter" || !query) return;
    try {
      const product = await api.get(`/products/barcode/${encodeURIComponent(query)}`);
      addToCart(product);
      setQuery("");
    } catch {
      // not an exact barcode match — leave as a text search
    }
  }

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return ["all", ...set];
  }, [products]);

  const visibleProducts = useMemo(
    () => (category === "all" ? products : products.filter((p) => p.category === category)),
    [products, category]
  );

  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        return prev.map((c) => (c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { product, qty: 1 }];
    });
  }

  function changeQty(productId, delta) {
    setCart((prev) =>
      prev
        .map((c) => (c.product.id === productId ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0)
    );
  }

  const subtotal = cart.reduce((sum, c) => sum + Number(c.product.salePrice) * c.qty, 0);

  return (
    <div className="grid grid-cols-[1fr_260px] gap-3">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-10 bg-card rounded-xl flex items-center gap-2 px-3">
            <Icon name="scan" size={16} className="text-muted" />
            <input
              className="flex-1 rtl text-sm outline-none placeholder:text-muted"
              placeholder="جستجوی کالا یا بارکد…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleBarcodeEnter}
              autoFocus
            />
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rtl text-xs px-4 py-2 rounded-full ${
                category === c ? "bg-ink text-white" : "bg-card text-subtle"
              }`}
            >
              {c === "all" ? "همه" : c}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {visibleProducts.map((p) => {
            const low = Number(p.stockQty) <= Number(p.lowStockThreshold);
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={Number(p.stockQty) <= 0}
                className="text-left bg-card rounded-card p-3 hover:ring-1 hover:ring-accent disabled:opacity-40"
              >
                <div className="h-20 rounded-xl bg-paper overflow-hidden flex items-center justify-center mb-2 text-muted">
                  {p.imageUrl ? (
                    <img src={resolveImageUrl(p.imageUrl)} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <Icon name="box" size={26} />
                  )}
                </div>
                <div className="rtl text-sm mb-2 truncate">{p.name}</div>
                <div className="flex items-center justify-between">
                  <span className="num text-sm font-semibold">{formatMoney(p.salePrice)}</span>
                  <span className={`text-[11px] rtl px-1.5 py-0.5 rounded ${low ? "bg-warn-light text-warn" : "text-muted"}`}>
                    موجودی {formatQty(p.stockQty)}
                  </span>
                </div>
              </button>
            );
          })}
          {visibleProducts.length === 0 && (
            <p className="rtl text-sm text-muted col-span-3 text-center py-10">کالایی یافت نشد</p>
          )}
        </div>
      </div>

      <div className="flex flex-col">
        <div className="bg-card rounded-t-card p-4 flex-1 flex flex-col min-h-[520px]">
          <h2 className="rtl text-lg font-semibold mb-3">سفارش جاری</h2>

          <label className="rtl block text-xs text-subtle mb-1">مشتری</label>
          <select
            className="w-full h-9 rounded-lg border border-line px-2 mb-4 text-xs rtl"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">فروش نقدی</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="flex-1 flex flex-col gap-4 overflow-y-auto scrollbar-none">
            {cart.map((c) => (
              <div key={c.product.id} className="flex items-center gap-2">
                <div className="w-11 h-11 rounded-lg bg-paper overflow-hidden flex items-center justify-center shrink-0 text-muted">
                  {c.product.imageUrl ? (
                    <img src={resolveImageUrl(c.product.imageUrl)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Icon name="box" size={16} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="rtl text-xs truncate mb-1">{c.product.name}</div>
                  <span className="num text-[11px] text-subtle">{formatMoney(c.product.salePrice)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => changeQty(c.product.id, -1)} className="w-6 h-6 rounded-full bg-paper flex items-center justify-center">
                    <Icon name="minus" size={12} />
                  </button>
                  <span className="num text-xs w-4 text-center">{c.qty}</span>
                  <button onClick={() => changeQty(c.product.id, 1)} className="w-6 h-6 rounded-full bg-paper flex items-center justify-center">
                    <Icon name="plus" size={12} />
                  </button>
                </div>
              </div>
            ))}
            {cart.length === 0 && <p className="rtl text-xs text-muted text-center py-8">سبد خرید خالی است</p>}
          </div>

          <div className="bg-paper rounded-xl px-3 py-3 flex flex-col gap-1.5 mt-3">
            <div className="flex justify-between rtl text-xs text-subtle">
              <span>جمع جزء</span>
              <span className="num">{formatMoney(subtotal)}</span>
            </div>
          </div>

          <div className="border-t border-line pt-3 mt-3 flex justify-between items-baseline">
            <span className="rtl text-sm font-semibold">مبلغ نهایی</span>
            <span className="num text-xl font-bold">{formatMoney(subtotal)}</span>
          </div>
        </div>

        <button
          disabled={cart.length === 0}
          onClick={() => setCheckoutOpen(true)}
          className="mt-2 h-12 rounded-xl bg-accent text-white text-sm font-semibold rtl disabled:opacity-50"
        >
          ادامه
        </button>
      </div>

      {checkoutOpen && (
        <CheckoutModal
          cart={cart}
          subtotal={subtotal}
          customerId={customerId}
          customers={customers}
          onClose={() => setCheckoutOpen(false)}
          onReceiptReady={(text, logoUrl) => {
            setLastReceiptText(text);
            setLastReceiptLogo(logoUrl);
          }}
          onSuccess={() => {
            setCart([]);
            setCheckoutOpen(false);
            setCustomerId("");
            loadProducts();
          }}
        />
      )}
      {error && <p className="rtl text-xs text-danger fixed bottom-4 right-4 bg-card px-3 py-2 rounded-lg">{error}</p>}
      {lastReceiptText && (
        <div className="fixed bottom-4 left-4 bg-card rounded-lg shadow-lg p-3 flex items-center gap-2 rtl">
          <span className="text-xs text-subtle">آخرین رسید آماده چاپ است</span>
          <button
            onClick={() => printReceiptWindow(lastReceiptText, lastReceiptLogo)}
            className="h-8 px-3 rounded-lg bg-accent text-white text-xs font-semibold"
          >
            چاپ رسید
          </button>
          <button onClick={() => { setLastReceiptText(null); setLastReceiptLogo(null); }} className="text-muted">
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function CheckoutModal({ cart, subtotal, customerId, customers, onClose, onSuccess, onReceiptReady }) {
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [cashPaid, setCashPaid] = useState(0);
  const [loanPaid, setLoanPaid] = useState(0);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const discountTotal = Number(discountAmount) + subtotal * (Number(discountPercent) / 100);
  const total = Math.max(0, subtotal - discountTotal);
  const customer = customers.find((c) => c.id === customerId);

  useEffect(() => {
    if (paymentMethod === "CASH") {
      setCashPaid(total);
      setLoanPaid(0);
    } else if (paymentMethod === "LOAN") {
      setCashPaid(0);
      setLoanPaid(total);
    }
    // PARTIAL: leave user to split manually
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod, total]);

  async function submit() {
    setError("");
    setLoading(true);
    try {
      const payload = {
        items: cart.map((c) => ({ productId: c.product.id, qty: c.qty })),
        customerId: customerId || undefined,
        cartDiscountPercent: discountPercent,
        cartDiscountAmount: discountAmount,
        paymentMethod,
        cashPaid: Number(cashPaid),
        loanPaid: Number(loanPaid),
        adminApproval: needsApproval ? { username: adminUser, password: adminPass } : undefined,
      };
      const res = await api.post("/sales", payload);
      const logoUrl = resolveImageUrl(res.logoUrl);
      await printReceipt(res.receiptPrintJob, {
        plainTextFallback: res.receiptText,
        logoUrl,
      });
      // Hand the full receipt text + logo up to the parent (this modal unmounts as
      // soon as onSuccess() runs below) so a manual print/preview stays available.
      onReceiptReady(res.receiptText, logoUrl);
      onSuccess();
    } catch (err) {
      if (err.data?.needsApproval) {
        setNeedsApproval(true);
        setError("این تخفیف نیاز به تایید مدیر دارد");
      } else {
        setError(err.data?.error || "خطا در ثبت فروش");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-card w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="rtl text-lg font-semibold">تکمیل پرداخت</h3>
          <button onClick={onClose} className="text-muted">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="rtl block text-xs text-subtle mb-1">تخفیف (٪)</label>
            <input
              type="number"
              min="0"
              className="w-full h-9 rounded-lg border border-line px-2 num text-sm"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="rtl block text-xs text-subtle mb-1">تخفیف (مبلغ)</label>
            <input
              type="number"
              min="0"
              className="w-full h-9 rounded-lg border border-line px-2 num text-sm"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="rtl block text-xs text-subtle mb-1">روش پرداخت</label>
          <div className="flex gap-2">
            {[
              { v: "CASH", l: "نقدی" },
              { v: "LOAN", l: "نسیه" },
              { v: "PARTIAL", l: "ترکیبی" },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => setPaymentMethod(o.v)}
                className={`flex-1 h-9 rounded-lg text-xs rtl ${
                  paymentMethod === o.v ? "bg-accent text-white" : "bg-paper text-subtle"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
          {paymentMethod !== "CASH" && !customer && (
            <p className="rtl text-xs text-danger mt-1">برای فروش نسیه یا ترکیبی، مشتری را انتخاب کنید</p>
          )}
          {customer && (
            <p className="rtl text-xs text-muted mt-1">
              اعتبار قابل استفاده: <span className="num">{formatMoney(customer.availableCredit)}</span>
            </p>
          )}
        </div>

        {paymentMethod === "PARTIAL" && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="rtl block text-xs text-subtle mb-1">نقدی</label>
              <input
                type="number"
                className="w-full h-9 rounded-lg border border-line px-2 num text-sm"
                value={cashPaid}
                onChange={(e) => setCashPaid(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="rtl block text-xs text-subtle mb-1">نسیه</label>
              <input
                type="number"
                className="w-full h-9 rounded-lg border border-line px-2 num text-sm"
                value={loanPaid}
                onChange={(e) => setLoanPaid(Number(e.target.value))}
              />
            </div>
          </div>
        )}

        {needsApproval && (
          <div className="bg-warn-light rounded-lg p-3 mb-3">
            <p className="rtl text-xs text-warn mb-2">تایید مدیر برای این تخفیف لازم است</p>
            <input
              placeholder="نام کاربری مدیر"
              className="w-full h-9 rounded-lg border border-line px-2 mb-2 text-sm rtl"
              value={adminUser}
              onChange={(e) => setAdminUser(e.target.value)}
            />
            <input
              type="password"
              placeholder="رمز عبور"
              className="w-full h-9 rounded-lg border border-line px-2 text-sm"
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
            />
          </div>
        )}

        <div className="bg-paper rounded-xl p-3 flex flex-col gap-1 mb-4">
          <div className="flex justify-between rtl text-xs text-subtle">
            <span>جمع جزء</span>
            <span className="num">{formatMoney(subtotal)}</span>
          </div>
          <div className="flex justify-between rtl text-xs text-subtle">
            <span>تخفیف</span>
            <span className="num">{formatMoney(discountTotal)}</span>
          </div>
          <div className="flex justify-between items-baseline pt-1">
            <span className="rtl text-sm font-semibold">مبلغ نهایی</span>
            <span className="num text-lg font-bold">{formatMoney(total)}</span>
          </div>
        </div>

        {error && <p className="rtl text-xs text-danger mb-3">{error}</p>}

        <button
          onClick={submit}
          disabled={loading}
          className="w-full h-11 rounded-xl bg-accent text-white text-sm font-semibold rtl disabled:opacity-60"
        >
          ثبت فروش و چاپ رسید
        </button>
      </div>
    </div>
  );
}
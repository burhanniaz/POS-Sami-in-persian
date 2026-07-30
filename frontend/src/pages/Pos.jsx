import { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '../api/client';
import { Search, Trash2, Plus, Minus, PackageSearch, Printer } from 'lucide-react';
import Receipt from '../components/Receipt';

export default function Pos() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [cart, setCart] = useState([]); // {product_id, name, price, quantity}
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [discount, setDiscount] = useState(0);
  const [paidCash, setPaidCash] = useState('');
  const [paidLoan, setPaidLoan] = useState('');
  const [status, setStatus] = useState('');
  const [statusOk, setStatusOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [store, setStore] = useState(null);
  const [receipt, setReceipt] = useState(null); // snapshot shown after a completed sale
  const searchTimer = useRef(null);

  useEffect(() => {
    api.get('/settings').then(setStore).catch(() => {});
  }, []);

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const total = Math.max(subtotal - Number(discount || 0), 0);

  // Debounced search keeps keystrokes from hammering the API — key for fast perceived response.
  // Runs with an empty query too, so the grid always shows something to tap even before typing.
  const runSearch = useCallback((q) => {
    clearTimeout(searchTimer.current);
    setLoadingResults(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await api.get(`/products?search=${encodeURIComponent(q)}&limit=24`);
        setResults(res.items);
      } catch { /* ignore transient errors */ }
      finally { setLoadingResults(false); }
    }, 200);
  }, []);

  // Load the initial product grid as soon as the page opens
  useEffect(() => { runSearch(''); }, [runSearch]);

  function searchProducts(q) {
    setQuery(q);
    runSearch(q);
  }

  async function handleBarcodeEnter(e) {
    if (e.key !== 'Enter' || !query) return;
    try {
      const p = await api.get(`/products/barcode/${encodeURIComponent(query)}`);
      addToCart(p);
      setQuery('');
      runSearch('');
    } catch {
      // fall through to normal search results already shown
    }
  }

  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) => (i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { product_id: product.id, name: product.name, price: Number(product.price), quantity: 1 }];
    });
  }

  function updateQty(id, delta) {
    setCart((prev) => prev.map((i) => (i.product_id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i)).filter(Boolean));
  }

  function removeItem(id) {
    setCart((prev) => prev.filter((i) => i.product_id !== id));
  }

  function searchCustomers(q) {
    setCustomerQuery(q);
    clearTimeout(searchTimer.current);
    if (!q) { setCustomerResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await api.get(`/customers?search=${encodeURIComponent(q)}&limit=6`);
        setCustomerResults(res.items);
      } catch { /* ignore */ }
    }, 200);
  }

  async function checkout() {
    if (cart.length === 0) return;
    setBusy(true);
    setStatus('');
    try {
      const sale = await api.post('/sales', {
        customer_id: customer?.id || null,
        items: cart.map((i) => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.price, line_discount: 0 })),
        discount: Number(discount || 0),
        paid_cash: Number(paidCash || total),
        paid_loan: Number(paidLoan || 0),
      });
      setStatusOk(true);
      setStatus(`فروش با موفقیت ثبت شد — شماره فاکتور ${sale.invoice_no}`);
      setReceipt({
        sale,
        items: cart,
        customer,
        discount: Number(discount || 0),
        paidCash: Number(paidCash || total),
        paidLoan: Number(paidLoan || 0),
      });
      setCart([]);
      setCustomer(null);
      setCustomerQuery('');
      setDiscount(0);
      setPaidCash('');
      setPaidLoan('');
    } catch (e) {
      setStatusOk(false);
      setStatus(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {/* Product search + grid + cart */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        <div className="flex items-center bg-white rounded-xl shadow-sm px-3">
          <Search size={18} className="text-ink-700/50" />
          <input
            value={query}
            onChange={(e) => searchProducts(e.target.value)}
            onKeyDown={handleBarcodeEnter}
            placeholder="اسکن بارکد یا جستجوی محصول..."
            className="flex-1 px-3 py-3 outline-none text-ink-900 bg-transparent"
            autoFocus
          />
        </div>

        {/* Always-visible product grid — tap any product to add it to the cart */}
        <div className="bg-white rounded-xl shadow-sm p-3">
          {results.length === 0 ? (
            <div className="p-6 text-center text-ink-700/50 text-sm flex flex-col items-center gap-2">
              <PackageSearch size={22} className="text-ink-700/30" />
              {loadingResults ? 'در حال بارگذاری محصولات...' : 'محصولی یافت نشد.'}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 max-h-80 overflow-y-auto">
              {results.map((p) => {
                const inCart = cart.find((i) => i.product_id === p.id);
                const outOfStock = Number(p.stock) <= 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => !outOfStock && addToCart(p)}
                    disabled={outOfStock}
                    className={`status-rail text-start rounded-lg p-3 border transition-colors
                      ${outOfStock ? 'opacity-40 cursor-not-allowed border-paper-200' : 'border-paper-200 hover:border-emerald-600 hover:bg-emerald-600/5'}
                      ${inCart ? 'border-emerald-600 bg-emerald-600/5' : ''}`}
                  >
                    <div className="text-sm font-medium text-ink-900 truncate">{p.name}</div>
                    <div className="flex justify-between items-baseline mt-1">
                      <span className="font-tabular font-semibold text-ink-900 text-sm">{Number(p.price).toLocaleString('en-US')}</span>
                      <span className="font-tabular text-xs text-ink-700/50">موجودی {Number(p.stock).toLocaleString('en-US')}</span>
                    </div>
                    {inCart && <div className="font-tabular text-xs text-emerald-700 mt-1">{inCart.quantity.toLocaleString('en-US')} در سبد</div>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm flex-1">
          {cart.length === 0 ? (
            <div className="p-8 text-center text-ink-700/50 text-sm">سبد خرید خالی است — روی محصولی بزنید یا بارکد را اسکن کنید.</div>
          ) : (
            <div className="divide-y divide-paper-200">
              {cart.map((item) => (
                <div key={item.product_id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-ink-900 text-sm font-medium truncate">{item.name}</div>
                    <div className="font-tabular text-ink-700/60 text-xs">{item.price.toLocaleString('en-US')} به ازای هر واحد</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(item.product_id, -1)} className="p-1.5 rounded-lg bg-paper-100 hover:bg-paper-200">
                      <Minus size={14} />
                    </button>
                    <span className="font-tabular w-6 text-center">{item.quantity.toLocaleString('en-US')}</span>
                    <button onClick={() => updateQty(item.product_id, 1)} className="p-1.5 rounded-lg bg-paper-100 hover:bg-paper-200">
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="w-20 text-end font-tabular font-semibold text-ink-900">
                    {(item.price * item.quantity).toLocaleString('en-US')}
                  </div>
                  <button onClick={() => removeItem(item.product_id)} className="text-rose-600 p-1.5">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Checkout panel */}
      <div className="bg-white rounded-xl shadow-sm p-4 h-fit flex flex-col gap-3 sticky top-4">
        <h2 className="font-semibold text-ink-900">صندوق</h2>

        <div className="relative">
          <input
            value={customer ? customer.name : customerQuery}
            onChange={(e) => { setCustomer(null); searchCustomers(e.target.value); }}
            placeholder="مشتری (اختیاری، برای فروش نسیه)"
            className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
          />
          {customerResults.length > 0 && !customer && (
            <div className="absolute z-10 mt-1 w-full bg-white rounded-lg shadow-lg divide-y divide-paper-200 overflow-hidden">
              {customerResults.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setCustomer(c); setCustomerResults([]); }}
                  className="w-full flex justify-between px-3 py-2 text-sm text-start hover:bg-paper-100"
                >
                  <span>{c.name}</span>
                  <span className="font-tabular text-ink-700/60">مانده {Number(c.balance).toLocaleString('en-US')}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between text-sm text-ink-700/70">
          <span>جمع جزء</span>
          <span className="font-tabular">{subtotal.toLocaleString('en-US')}</span>
        </div>

        <label className="flex justify-between items-center text-sm">
          <span className="text-ink-700/70">تخفیف</span>
          <input
            type="number"
            min="0"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            className="w-24 rounded-lg border border-paper-200 px-2 py-1 text-end font-tabular"
          />
        </label>

        <div className="flex justify-between text-base font-bold text-ink-900 border-t border-paper-200 pt-2">
          <span>مجموع</span>
          <span className="font-tabular">{total.toLocaleString('en-US')}</span>
        </div>

        <label className="flex justify-between items-center text-sm">
          <span className="text-ink-700/70">پرداخت نقدی</span>
          <input
            type="number"
            min="0"
            value={paidCash}
            onChange={(e) => setPaidCash(e.target.value)}
            placeholder={total.toString()}
            className="w-24 rounded-lg border border-paper-200 px-2 py-1 text-end font-tabular"
          />
        </label>

        <label className="flex justify-between items-center text-sm">
          <span className="text-ink-700/70">به صورت نسیه</span>
          <input
            type="number"
            min="0"
            value={paidLoan}
            onChange={(e) => setPaidLoan(e.target.value)}
            disabled={!customer}
            className="w-24 rounded-lg border border-paper-200 px-2 py-1 text-end font-tabular disabled:bg-paper-100"
          />
        </label>

        <button
          onClick={checkout}
          disabled={busy || cart.length === 0}
          className="w-full rounded-lg bg-emerald-600 text-white font-semibold py-2.5 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {busy ? 'در حال پردازش...' : 'ثبت فروش'}
        </button>

        {status && (
          <div className={`text-sm rounded-lg px-3 py-2 ${statusOk ? 'bg-emerald-600/10 text-emerald-700' : 'bg-rose-600/10 text-rose-600'}`}>
            {status}
          </div>
        )}
      </div>

      {/* Receipt preview modal - shown right after a sale completes */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="p-4 overflow-y-auto">
              <Receipt
                store={store}
                sale={receipt.sale}
                items={receipt.items}
                customer={receipt.customer}
                discount={receipt.discount}
                paidCash={receipt.paidCash}
                paidLoan={receipt.paidLoan}
              />
            </div>
            <div className="p-4 border-t border-paper-200 flex gap-2">
              <button
                onClick={() => setReceipt(null)}
                className="flex-1 rounded-lg bg-paper-100 text-ink-900 font-medium py-2.5 hover:bg-paper-200"
              >
                بستن
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-ink-900 text-white font-semibold py-2.5 hover:bg-ink-800"
              >
                <Printer size={16} /> چاپ رسید
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden off-screen except during print - this is the only thing @media print shows */}
      {receipt && (
        <Receipt
          printable
          store={store}
          sale={receipt.sale}
          items={receipt.items}
          customer={receipt.customer}
          discount={receipt.discount}
          paidCash={receipt.paidCash}
          paidLoan={receipt.paidLoan}
        />
      )}
    </div>
  );
}

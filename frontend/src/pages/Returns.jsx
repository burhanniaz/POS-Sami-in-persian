import { useState } from 'react';
import { api } from '../api/client';
import { Search } from 'lucide-react';

export default function Returns() {
  const [invoice, setInvoice] = useState('');
  const [sale, setSale] = useState(null);
  const [qtys, setQtys] = useState({});
  const [refundMethod, setRefundMethod] = useState('cash');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function findSale() {
    setError('');
    setSale(null);
    try {
      const sales = await api.get(`/sales?limit=100`);
      const match = sales.find((s) => s.invoice_no.toLowerCase() === invoice.trim().toLowerCase());
      if (!match) return setError('فاکتور یافت نشد');
      const full = await api.get(`/sales/${match.id}`);
      setSale(full);
      setQtys({});
    } catch (e) {
      setError(e.message);
    }
  }

  async function submitReturn() {
    setStatus('');
    setError('');
    const items = Object.entries(qtys).filter(([, q]) => Number(q) > 0).map(([sale_item_id, q]) => ({ sale_item_id: Number(sale_item_id), quantity: Number(q) }));
    if (items.length === 0) return setError('حداقل یک کالا را برای مرجوعی انتخاب کنید');
    try {
      const result = await api.post('/returns', { sale_id: sale.id, items, refund_method: refundMethod });
      setStatus(`مبلغ بازگشتی ثبت شد: ${Number(result.total_refund).toLocaleString('en-US')}`);
      setSale(null);
      setInvoice('');
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-ink-900 mb-4">مرجوعی و بازگشت وجه</h1>

      <div className="flex gap-2 mb-4">
        <input
          value={invoice}
          onChange={(e) => setInvoice(e.target.value)}
          placeholder="شماره فاکتور"
          className="flex-1 rounded-lg border border-paper-200 bg-white px-3 py-2.5 text-sm font-tabular"
        />
        <button onClick={findSale} className="flex items-center gap-1.5 bg-ink-900 text-white text-sm font-medium px-4 rounded-lg hover:bg-ink-800">
          <Search size={16} /> جستجو
        </button>
      </div>

      {error && <div className="mb-3 text-sm text-rose-600 bg-rose-600/10 rounded-lg px-3 py-2">{error}</div>}
      {status && <div className="mb-3 text-sm text-emerald-700 bg-emerald-600/10 rounded-lg px-3 py-2">{status}</div>}

      {sale && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-sm text-ink-700/60 mb-3">فاکتور {sale.invoice_no} · {sale.customer_name || 'مشتری متفرقه'}</div>
          <div className="divide-y divide-paper-200">
            {sale.items.map((item) => {
              const available = Number(item.quantity) - Number(item.returned_qty);
              return (
                <div key={item.id} className="flex items-center justify-between py-2 text-sm gap-3">
                  <div className="flex-1 min-w-0 truncate">{item.product_name}</div>
                  <div className="font-tabular text-ink-700/60">قابل مرجوع: {available.toLocaleString('en-US')}</div>
                  <input
                    type="number"
                    min="0"
                    max={available}
                    value={qtys[item.id] || ''}
                    onChange={(e) => setQtys({ ...qtys, [item.id]: e.target.value })}
                    disabled={available <= 0}
                    className="w-20 rounded-lg border border-paper-200 px-2 py-1 text-end font-tabular disabled:bg-paper-100"
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 mt-4">
            <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} className="rounded-lg border border-paper-200 px-3 py-2 text-sm">
              <option value="cash">بازگشت نقدی</option>
              <option value="loan_adjust">کسر از مانده نسیه مشتری</option>
            </select>
            <button onClick={submitReturn} className="flex-1 rounded-lg bg-rose-600 text-white font-semibold py-2.5 hover:bg-rose-700">
              ثبت مرجوعی
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

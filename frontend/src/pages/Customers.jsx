import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../api/client';
import { Plus, X, Wallet } from 'lucide-react';

const emptyForm = { id: null, name: '', phone: '', address: '', credit_limit: '0' };

export default function Customers() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const [payFor, setPayFor] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [error, setError] = useState('');
  const timer = useRef(null);

  const load = useCallback((q = '') => {
    api.get(`/customers?search=${encodeURIComponent(q)}&limit=50`).then((r) => setItems(r.items)).catch((e) => setError(e.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSearch(q) {
    setSearch(q);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => load(q), 200);
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      const payload = { name: form.name, phone: form.phone || null, address: form.address || null, credit_limit: Number(form.credit_limit) || 0 };
      if (form.id) await api.put(`/customers/${form.id}`, payload);
      else await api.post('/customers', payload);
      setForm(null);
      load(search);
    } catch (e) {
      setError(e.message);
    }
  }

  async function recordPayment(e) {
    e.preventDefault();
    try {
      await api.post(`/customers/${payFor.id}/payments`, { amount: Number(payAmount) });
      setPayFor(null);
      setPayAmount('');
      load(search);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-bold text-ink-900">مشتریان</h1>
        <button onClick={() => setForm(emptyForm)} className="flex items-center gap-1.5 bg-ink-900 text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-ink-800">
          <Plus size={16} /> افزودن مشتری
        </button>
      </div>

      <input value={search} onChange={(e) => handleSearch(e.target.value)} placeholder="جستجو بر اساس نام یا شماره تماس..." className="w-full mb-4 rounded-lg border border-paper-200 bg-white px-3 py-2.5 text-sm" />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((c) => {
          const owing = Number(c.balance) > 0;
          return (
            <div key={c.id} className={`status-rail bg-white rounded-xl p-4 shadow-sm ${owing ? 'border-rose-600' : 'border-emerald-600'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-ink-900">{c.name}</div>
                  <div className="text-ink-700/60 text-xs font-tabular">{c.phone || '—'}</div>
                </div>
                <button onClick={() => setForm({ ...c, credit_limit: c.credit_limit })} className="text-ink-700/60 text-xs hover:text-ink-900">ویرایش</button>
              </div>
              <div className="mt-3 flex justify-between text-sm">
                <span className="text-ink-700/60">مانده حساب</span>
                <span className={`font-tabular font-semibold ${owing ? 'text-rose-600' : 'text-emerald-700'}`}>{Number(c.balance).toLocaleString('en-US')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-700/60">سقف اعتبار</span>
                <span className="font-tabular">{Number(c.credit_limit).toLocaleString('en-US')}</span>
              </div>
              {owing && (
                <button onClick={() => setPayFor(c)} className="w-full mt-3 flex items-center justify-center gap-1.5 text-sm font-medium bg-emerald-600/10 text-emerald-700 rounded-lg py-2 hover:bg-emerald-600/20">
                  <Wallet size={14} /> ثبت پرداخت
                </button>
              )}
            </div>
          );
        })}
        {items.length === 0 && <div className="col-span-full text-center text-ink-700/50 py-8">مشتری‌ای یافت نشد.</div>}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={save} className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-ink-900">{form.id ? 'ویرایش مشتری' : 'افزودن مشتری'}</h2>
              <button type="button" onClick={() => setForm(null)}><X size={18} /></button>
            </div>
            {error && <div className="mb-3 text-sm text-rose-600 bg-rose-600/10 rounded-lg px-3 py-2">{error}</div>}
            <div className="flex flex-col gap-3">
              <input required placeholder="نام" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-paper-200 px-3 py-2 text-sm" />
              <input placeholder="شماره تماس" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-lg border border-paper-200 px-3 py-2 text-sm font-tabular" />
              <input placeholder="آدرس" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} className="rounded-lg border border-paper-200 px-3 py-2 text-sm" />
              <input type="number" placeholder="سقف اعتبار" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} className="rounded-lg border border-paper-200 px-3 py-2 text-sm font-tabular" />
            </div>
            <button type="submit" className="w-full mt-4 rounded-lg bg-ink-900 text-white font-semibold py-2.5 hover:bg-ink-800">ذخیره</button>
          </form>
        </div>
      )}

      {payFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={recordPayment} className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-ink-900">پرداخت از {payFor.name}</h2>
              <button type="button" onClick={() => setPayFor(null)}><X size={18} /></button>
            </div>
            <div className="text-sm text-ink-700/60 mb-2">مانده فعلی: <span className="font-tabular">{Number(payFor.balance).toLocaleString('en-US')}</span></div>
            <input required type="number" min="0" placeholder="مبلغ" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm font-tabular" autoFocus />
            <button type="submit" className="w-full mt-4 rounded-lg bg-emerald-600 text-white font-semibold py-2.5 hover:bg-emerald-700">ثبت پرداخت</button>
          </form>
        </div>
      )}
    </div>
  );
}

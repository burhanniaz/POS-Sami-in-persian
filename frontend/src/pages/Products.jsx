import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../api/client';
import { Plus, Pencil, Trash2, X } from 'lucide-react';

const emptyForm = { id: null, name: '', barcode: '', price: '', cost: '', stock: '', low_stock_threshold: '5' };

export default function Products() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const timer = useRef(null);

  const load = useCallback((q = '') => {
    api.get(`/products?search=${encodeURIComponent(q)}&limit=50`).then((r) => setItems(r.items)).catch((e) => setError(e.message));
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
      const payload = {
        name: form.name,
        barcode: form.barcode || null,
        price: Number(form.price) || 0,
        cost: Number(form.cost) || 0,
        stock: Number(form.stock) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 5,
      };
      if (form.id) await api.put(`/products/${form.id}`, payload);
      else await api.post('/products', payload);
      setForm(null);
      load(search);
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(id) {
    if (!confirm('این محصول حذف شود؟')) return;
    await api.del(`/products/${id}`);
    load(search);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-bold text-ink-900">محصولات</h1>
        <button
          onClick={() => setForm(emptyForm)}
          className="flex items-center gap-1.5 bg-ink-900 text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-ink-800"
        >
          <Plus size={16} /> افزودن محصول
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="جستجو بر اساس نام یا بارکد..."
        className="w-full mb-4 rounded-lg border border-paper-200 bg-white px-3 py-2.5 text-sm"
      />

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-ink-700/60 text-start border-b border-paper-200">
              <th className="px-4 py-3 text-start font-medium">نام</th>
              <th className="px-4 py-3 text-start font-medium">بارکد</th>
              <th className="px-4 py-3 text-end font-medium">قیمت</th>
              <th className="px-4 py-3 text-end font-medium">موجودی</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-paper-200">
            {items.map((p) => {
              const low = Number(p.stock) <= Number(p.low_stock_threshold);
              return (
                <tr key={p.id} className={`status-rail ${low ? 'border-amber-500' : 'border-transparent'}`}>
                  <td className="px-4 py-3 text-ink-900">{p.name}</td>
                  <td className="px-4 py-3 font-tabular text-ink-700/60">{p.barcode || '—'}</td>
                  <td className="px-4 py-3 text-end font-tabular">{Number(p.price).toLocaleString('en-US')}</td>
                  <td className={`px-4 py-3 text-end font-tabular ${low ? 'text-amber-600 font-semibold' : ''}`}>{Number(p.stock).toLocaleString('en-US')}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setForm({ ...p, price: p.price, cost: p.cost || '' })} className="p-1.5 text-ink-700 hover:text-ink-900">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => remove(p.id)} className="p-1.5 text-rose-600">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-700/50">محصولی یافت نشد.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={save} className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-ink-900">{form.id ? 'ویرایش محصول' : 'افزودن محصول'}</h2>
              <button type="button" onClick={() => setForm(null)}><X size={18} /></button>
            </div>
            {error && <div className="mb-3 text-sm text-rose-600 bg-rose-600/10 rounded-lg px-3 py-2">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <input required placeholder="نام" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="col-span-2 rounded-lg border border-paper-200 px-3 py-2 text-sm" />
              <input placeholder="بارکد" value={form.barcode || ''} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="col-span-2 rounded-lg border border-paper-200 px-3 py-2 text-sm font-tabular" />
              <input required type="number" placeholder="قیمت" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="rounded-lg border border-paper-200 px-3 py-2 text-sm font-tabular" />
              <input type="number" placeholder="بهای تمام‌شده" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className="rounded-lg border border-paper-200 px-3 py-2 text-sm font-tabular" />
              <input type="number" placeholder="موجودی" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="rounded-lg border border-paper-200 px-3 py-2 text-sm font-tabular" />
              <input type="number" placeholder="هشدار کمبود موجودی از" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} className="rounded-lg border border-paper-200 px-3 py-2 text-sm font-tabular" />
            </div>
            <button type="submit" className="w-full mt-4 rounded-lg bg-ink-900 text-white font-semibold py-2.5 hover:bg-ink-800">
              ذخیره
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Plus, X } from 'lucide-react';

const emptyForm = { id: null, name: '', phone: '', address: '', notes: '' };

export default function Suppliers() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  function load() {
    api.get('/suppliers').then(setItems).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      const payload = { name: form.name, phone: form.phone || null, address: form.address || null, notes: form.notes || null };
      if (form.id) await api.put(`/suppliers/${form.id}`, payload);
      else await api.post('/suppliers', payload);
      setForm(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(id) {
    if (!confirm('این تامین‌کننده حذف شود؟')) return;
    await api.del(`/suppliers/${id}`);
    load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-bold text-ink-900">تامین‌کنندگان</h1>
        <button onClick={() => setForm(emptyForm)} className="flex items-center gap-1.5 bg-ink-900 text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-ink-800">
          <Plus size={16} /> افزودن تامین‌کننده
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((s) => (
          <div key={s.id} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-start">
              <div className="font-semibold text-ink-900">{s.name}</div>
              <div className="flex gap-2 text-xs">
                <button onClick={() => setForm(s)} className="text-ink-700/60 hover:text-ink-900">ویرایش</button>
                <button onClick={() => remove(s.id)} className="text-rose-600">حذف</button>
              </div>
            </div>
            <div className="text-ink-700/60 text-sm font-tabular mt-1">{s.phone || '—'}</div>
            {s.address && <div className="text-ink-700/50 text-xs mt-1">{s.address}</div>}
          </div>
        ))}
        {items.length === 0 && <div className="col-span-full text-center text-ink-700/50 py-8">هنوز تامین‌کننده‌ای ثبت نشده است.</div>}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={save} className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-ink-900">{form.id ? 'ویرایش تامین‌کننده' : 'افزودن تامین‌کننده'}</h2>
              <button type="button" onClick={() => setForm(null)}><X size={18} /></button>
            </div>
            {error && <div className="mb-3 text-sm text-rose-600 bg-rose-600/10 rounded-lg px-3 py-2">{error}</div>}
            <div className="flex flex-col gap-3">
              <input required placeholder="نام" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-paper-200 px-3 py-2 text-sm" />
              <input placeholder="شماره تماس" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-lg border border-paper-200 px-3 py-2 text-sm font-tabular" />
              <input placeholder="آدرس" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} className="rounded-lg border border-paper-200 px-3 py-2 text-sm" />
              <textarea placeholder="یادداشت" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-lg border border-paper-200 px-3 py-2 text-sm" />
            </div>
            <button type="submit" className="w-full mt-4 rounded-lg bg-ink-900 text-white font-semibold py-2.5 hover:bg-ink-800">ذخیره</button>
          </form>
        </div>
      )}
    </div>
  );
}

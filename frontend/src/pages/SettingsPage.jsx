import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function SettingsPage() {
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    api.get('/settings').then(setForm);
  }, []);

  async function save(e) {
    e.preventDefault();
    setStatus('');
    try {
      await api.put('/settings', form);
      setStatus('ذخیره شد.');
    } catch (e) {
      setStatus(e.message);
    }
  }

  if (!form) return <div className="text-ink-700/60">در حال بارگذاری...</div>;

  return (
    <div>
      <h1 className="text-xl font-bold text-ink-900 mb-4">تنظیمات فروشگاه</h1>
      <form onSubmit={save} className="bg-white rounded-xl shadow-sm p-4 max-w-lg flex flex-col gap-3">
        <label className="text-sm font-medium text-ink-800">نام فروشگاه</label>
        <input value={form.store_name || ''} onChange={(e) => setForm({ ...form, store_name: e.target.value })} className="rounded-lg border border-paper-200 px-3 py-2 text-sm" />

        <label className="text-sm font-medium text-ink-800">شماره تماس</label>
        <input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-lg border border-paper-200 px-3 py-2 text-sm font-tabular" />

        <label className="text-sm font-medium text-ink-800">آدرس</label>
        <textarea value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} className="rounded-lg border border-paper-200 px-3 py-2 text-sm" />

        <label className="text-sm font-medium text-ink-800">متن پایین رسید</label>
        <textarea value={form.receipt_footer || ''} onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })} placeholder="مثلاً: پیام تشکر که در پایین رسید چاپ می‌شود" className="rounded-lg border border-paper-200 px-3 py-2 text-sm" />

        <button type="submit" className="rounded-lg bg-ink-900 text-white font-semibold py-2.5 hover:bg-ink-800">ذخیره تنظیمات</button>
        {status && <div className="text-sm text-emerald-700">{status}</div>}
      </form>
    </div>
  );
}

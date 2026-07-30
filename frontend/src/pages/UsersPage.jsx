import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Plus, X } from 'lucide-react';

const emptyForm = { id: null, username: '', password: '', full_name: '', role: 'cashier', is_active: true };

export default function UsersPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  function load() {
    api.get('/users').then(setItems).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      if (form.id) {
        await api.put(`/users/${form.id}`, { full_name: form.full_name, role: form.role, is_active: form.is_active, password: form.password || undefined });
      } else {
        await api.post('/users', { username: form.username, password: form.password, full_name: form.full_name, role: form.role });
      }
      setForm(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-bold text-ink-900">کاربران</h1>
        <button onClick={() => setForm(emptyForm)} className="flex items-center gap-1.5 bg-ink-900 text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-ink-800">
          <Plus size={16} /> افزودن کاربر
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[420px]">
          <thead><tr className="text-ink-700/60 border-b border-paper-200"><th className="px-4 py-3 text-start">نام</th><th className="px-4 py-3 text-start">نام کاربری</th><th className="px-4 py-3 text-start">نقش</th><th className="px-4 py-3"></th></tr></thead>
          <tbody className="divide-y divide-paper-200">
            {items.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">{u.full_name}</td>
                <td className="px-4 py-3 font-tabular">{u.username}</td>
                <td className="px-4 py-3">{u.role === 'admin' ? 'مدیر' : 'صندوق‌دار'}</td>
                <td className="px-4 py-3 text-end">
                  <button onClick={() => setForm({ ...u, password: '' })} className="text-ink-700/60 hover:text-ink-900 text-xs">ویرایش</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={save} className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-ink-900">{form.id ? 'ویرایش کاربر' : 'افزودن کاربر'}</h2>
              <button type="button" onClick={() => setForm(null)}><X size={18} /></button>
            </div>
            {error && <div className="mb-3 text-sm text-rose-600 bg-rose-600/10 rounded-lg px-3 py-2">{error}</div>}
            <div className="flex flex-col gap-3">
              {!form.id && <input required placeholder="نام کاربری" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="rounded-lg border border-paper-200 px-3 py-2 text-sm" />}
              <input required placeholder="نام کامل" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="rounded-lg border border-paper-200 px-3 py-2 text-sm" />
              <input type="password" placeholder={form.id ? 'رمز عبور جدید (اختیاری)' : 'رمز عبور'} required={!form.id} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="rounded-lg border border-paper-200 px-3 py-2 text-sm" />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded-lg border border-paper-200 px-3 py-2 text-sm">
                <option value="cashier">صندوق‌دار</option>
                <option value="admin">مدیر</option>
              </select>
              {form.id && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> فعال
                </label>
              )}
            </div>
            <button type="submit" className="w-full mt-4 rounded-lg bg-ink-900 text-white font-semibold py-2.5 hover:bg-ink-800">ذخیره</button>
          </form>
        </div>
      )}
    </div>
  );
}

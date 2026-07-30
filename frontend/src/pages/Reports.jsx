import { useEffect, useState } from 'react';
import { api } from '../api/client';

const TABS = ['فروش', 'وضعیت نسیه', 'کمبود موجودی', 'پرفروش‌ترین‌ها'];

export default function Reports() {
  const [tab, setTab] = useState(TABS[0]);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    const endpoint = {
      [TABS[0]]: '/reports/sales',
      [TABS[1]]: '/reports/loan-aging',
      [TABS[2]]: '/reports/low-stock',
      [TABS[3]]: '/reports/best-sellers',
    }[tab];
    api.get(endpoint).then(setRows).catch((e) => setError(e.message));
  }, [tab]);

  return (
    <div>
      <h1 className="text-xl font-bold text-ink-900 mb-4">گزارش‌ها</h1>

      <div className="flex gap-1 mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${tab === t ? 'bg-ink-900 text-white' : 'bg-white text-ink-700/70 hover:bg-paper-100'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <div className="text-rose-600 text-sm mb-3">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        {tab === TABS[0] && (
          <table className="w-full text-sm min-w-[480px]">
            <thead><tr className="text-ink-700/60 border-b border-paper-200"><th className="px-4 py-3 text-start">تاریخ</th><th className="px-4 py-3 text-start">صندوق‌دار</th><th className="px-4 py-3 text-end">تعداد فروش</th><th className="px-4 py-3 text-end">مجموع</th></tr></thead>
            <tbody className="divide-y divide-paper-200">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 font-tabular">{new Date(r.day).toLocaleDateString('en-US')}</td>
                  <td className="px-4 py-3">{r.cashier || '—'}</td>
                  <td className="px-4 py-3 text-end font-tabular">{Number(r.sales_count).toLocaleString('en-US')}</td>
                  <td className="px-4 py-3 text-end font-tabular">{Number(r.total).toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === TABS[1] && (
          <table className="w-full text-sm min-w-[480px]">
            <thead><tr className="text-ink-700/60 border-b border-paper-200"><th className="px-4 py-3 text-start">مشتری</th><th className="px-4 py-3 text-start">شماره تماس</th><th className="px-4 py-3 text-end">مانده حساب</th><th className="px-4 py-3 text-end">سقف اعتبار</th></tr></thead>
            <tbody className="divide-y divide-paper-200">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3 font-tabular">{r.phone || '—'}</td>
                  <td className="px-4 py-3 text-end font-tabular text-rose-600 font-semibold">{Number(r.balance).toLocaleString('en-US')}</td>
                  <td className="px-4 py-3 text-end font-tabular">{Number(r.credit_limit).toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === TABS[2] && (
          <table className="w-full text-sm min-w-[420px]">
            <thead><tr className="text-ink-700/60 border-b border-paper-200"><th className="px-4 py-3 text-start">محصول</th><th className="px-4 py-3 text-end">موجودی</th><th className="px-4 py-3 text-end">آستانه هشدار</th></tr></thead>
            <tbody className="divide-y divide-paper-200">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3 text-end font-tabular text-amber-600 font-semibold">{Number(r.stock).toLocaleString('en-US')}</td>
                  <td className="px-4 py-3 text-end font-tabular">{Number(r.low_stock_threshold).toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === TABS[3] && (
          <table className="w-full text-sm min-w-[420px]">
            <thead><tr className="text-ink-700/60 border-b border-paper-200"><th className="px-4 py-3 text-start">محصول</th><th className="px-4 py-3 text-end">تعداد فروش</th><th className="px-4 py-3 text-end">درآمد</th></tr></thead>
            <tbody className="divide-y divide-paper-200">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3 text-end font-tabular">{Number(r.qty_sold).toLocaleString('en-US')}</td>
                  <td className="px-4 py-3 text-end font-tabular">{Number(r.revenue).toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {rows.length === 0 && <div className="p-8 text-center text-ink-700/50 text-sm">داده‌ای برای نمایش وجود ندارد.</div>}
      </div>
    </div>
  );
}

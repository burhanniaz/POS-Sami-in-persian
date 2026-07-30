import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { TrendingUp, AlertTriangle, Wallet, Trophy } from 'lucide-react';

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className={`status-rail bg-white rounded-xl p-4 shadow-sm ${accent}`}>
      <div className="flex items-center gap-2 text-ink-700/70 text-sm mb-2">
        <Icon size={16} />
        {label}
      </div>
      <div className="text-2xl font-bold font-tabular text-ink-900">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/reports/dashboard').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="text-rose-600">{error}</div>;
  if (!data) return <div className="text-ink-700/60">در حال بارگذاری...</div>;

  return (
    <div>
      <h1 className="text-xl font-bold text-ink-900 mb-4">داشبورد</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={TrendingUp} label="فروش امروز" value={`${data.today_sales_total.toLocaleString('en-US')} (${data.today_sales_count.toLocaleString('en-US')})`} accent="border-emerald-600" />
        <StatCard icon={AlertTriangle} label="کالاهای رو به اتمام" value={data.low_stock_count.toLocaleString('en-US')} accent="border-amber-500" />
        <StatCard icon={Wallet} label="مجموع بدهی مشتریان" value={data.total_owed.toLocaleString('en-US')} accent="border-rose-600" />
        <StatCard icon={Trophy} label="مشتریان دارای وام" value={data.customers_with_loans.toLocaleString('en-US')} accent="border-ink-700" />
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm">
        <h2 className="font-semibold text-ink-900 mb-3">پرفروش‌ترین‌ها (30 روز اخیر)</h2>
        <div className="divide-y divide-paper-200">
          {data.best_sellers.length === 0 && <div className="text-ink-700/50 text-sm py-2">هنوز فروشی ثبت نشده است.</div>}
          {data.best_sellers.map((p, i) => (
            <div key={i} className="flex justify-between py-2 text-sm">
              <span className="text-ink-900">{p.name}</span>
              <span className="font-tabular text-ink-700/70">{Number(p.qty_sold).toLocaleString('en-US')} فروش</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

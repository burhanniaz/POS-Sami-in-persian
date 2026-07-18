import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { formatMoney, formatQty, formatDate } from "../lib/format.js";

export default function Reports() {
  const [dashboard, setDashboard] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);
  const [loanAging, setLoanAging] = useState([]);

  useEffect(() => {
    api.get("/reports/dashboard").then(setDashboard).catch(() => {});
    api.get("/reports/low-stock").then(setLowStock).catch(() => {});
    api.get("/reports/best-sellers").then(setBestSellers).catch(() => {});
    api.get("/reports/loan-aging").then(setLoanAging).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="rtl text-lg font-semibold">گزارش‌ها و داشبورد</h2>

      <div className="grid grid-cols-3 gap-3">
        <Metric label="فروش امروز" value={formatMoney(dashboard?.todaysSalesTotal || 0)} />
        <Metric label="تعداد فروش امروز" value={dashboard?.todaysSalesCount ?? "—"} />
        <Metric label="کالاهای کم‌موجودی" value={dashboard?.lowStockCount ?? "—"} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Panel title="کالاهای کم‌موجودی (همه ترمینال‌ها)">
          <Table
            head={["نام کالا", "موجودی", "حد هشدار"]}
            rows={lowStock.map((p) => [p.name, formatQty(p.stockQty), formatQty(p.lowStockThreshold)])}
            empty="موجودی کم ثبت نشده"
          />
        </Panel>

        <Panel title="پرفروش‌ترین کالاها">
          <Table
            head={["نام کالا", "تعداد فروخته‌شده", "درآمد"]}
            rows={bestSellers.map((b) => [b.name, formatQty(b.qtySold), formatMoney(b.revenue)])}
            empty="داده‌ای موجود نیست"
          />
        </Panel>
      </div>

      <Panel title="سررسید بدهی مشتریان">
        <Table
          head={["مشتری", "مانده بدهی", "سقف اعتبار", "روزهای باز بودن", "بازه"]}
          rows={loanAging.map((l) => [l.name, formatMoney(l.loanBalance), formatMoney(l.creditLimit), l.daysOpen ?? "—", l.bucket])}
          empty="بدهی بازی وجود ندارد"
        />
      </Panel>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="bg-card rounded-card p-4">
      <p className="rtl text-xs text-subtle mb-1">{label}</p>
      <p className="num text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="bg-card rounded-card p-4">
      <h3 className="rtl text-sm font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Table({ head, rows, empty }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="rtl text-subtle border-b border-line">
          {head.map((h) => (
            <th key={h} className="text-right py-2">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-line last:border-0">
            {r.map((c, j) => (
              <td key={j} className={`py-2 ${j === 0 ? "rtl" : "num"}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {rows.length === 0 && <caption className="rtl text-muted py-6 caption-bottom">{empty}</caption>}
    </table>
  );
}

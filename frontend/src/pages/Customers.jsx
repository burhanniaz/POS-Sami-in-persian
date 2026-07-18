import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { formatMoney } from "../lib/format.js";
import { Icon } from "../components/Icon.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function Customers() {
  const { auth } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    const data = await api.get(`/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    setCustomers(data);
  }

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function repay(customer) {
    const amountStr = window.prompt(`مبلغ بازپرداخت برای ${customer.name}:`, "");
    if (!amountStr) return;
    const amount = Number(amountStr);
    if (!amount || amount <= 0) return;
    await api.post(`/customers/${customer.id}/repay-loan`, { amount });
    load();
  }

  async function setCreditLimit(customer) {
    const amountStr = window.prompt(`سقف اعتبار جدید برای ${customer.name}:`, customer.creditLimit);
    if (amountStr === null) return;
    await api.put(`/customers/${customer.id}/credit-limit`, { creditLimit: Number(amountStr) });
    load();
  }

  async function deleteCustomer(customer) {
    if (!window.confirm(`مشتری «${customer.name}» حذف شود؟`)) return;
    setError("");
    try {
      await api.del(`/customers/${customer.id}`);
      load();
    } catch (err) {
      setError(err.data?.error || "خطا در حذف مشتری");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-10 bg-card rounded-xl flex items-center gap-2 px-3">
          <Icon name="search" size={16} className="text-muted" />
          <input
            className="flex-1 rtl text-sm outline-none placeholder:text-muted"
            placeholder="جستجوی مشتری (نام، تلفن، شماره ملی)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="h-10 px-4 rounded-xl bg-accent text-white text-sm rtl flex items-center gap-1"
        >
          <Icon name="plus" size={15} /> مشتری جدید
        </button>
      </div>

      {error && <p className="rtl text-xs text-danger">{error}</p>}

      <div className="bg-card rounded-card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="rtl text-xs text-subtle border-b border-line">
              <th className="text-right py-3 px-4">نام</th>
              <th className="text-right py-3 px-4">شماره ملی (CNIC)</th>
              <th className="text-right py-3 px-4">آدرس</th>
              <th className="text-right py-3 px-4">تلفن</th>
              <th className="text-right py-3 px-4">سقف اعتبار</th>
              <th className="text-right py-3 px-4">مانده بدهی</th>
              <th className="text-right py-3 px-4">اعتبار قابل استفاده</th>
              <th className="text-right py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-line last:border-0">
                <td className="rtl py-3 px-4 whitespace-nowrap">{c.name}</td>
                <td className="num py-3 px-4 text-subtle whitespace-nowrap">{c.cnic || "—"}</td>
                <td className="rtl py-3 px-4 text-subtle">{c.address || "—"}</td>
                <td className="num py-3 px-4 text-subtle whitespace-nowrap">{c.phone || "—"}</td>
                <td className="num py-3 px-4 whitespace-nowrap">{formatMoney(c.creditLimit)}</td>
                <td className="num py-3 px-4 whitespace-nowrap">{formatMoney(c.loanBalance)}</td>
                <td className="num py-3 px-4 whitespace-nowrap">{formatMoney(c.availableCredit)}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3 justify-end whitespace-nowrap">
                    <button onClick={() => repay(c)} className="rtl text-xs text-accent">
                      دریافت بازپرداخت
                    </button>
                    {auth.role === "admin" && (
                      <>
                        <button
                          onClick={() => {
                            setEditing(c);
                            setModalOpen(true);
                          }}
                          className="rtl text-xs text-subtle"
                        >
                          ویرایش
                        </button>
                        <button onClick={() => setCreditLimit(c)} className="rtl text-xs text-subtle">
                          تغییر سقف اعتبار
                        </button>
                        <button onClick={() => deleteCustomer(c)} className="rtl text-xs text-danger">
                          حذف
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && <p className="rtl text-sm text-muted text-center py-10">مشتری‌ای یافت نشد</p>}
      </div>

      {modalOpen && (
        <CustomerModal
          customer={editing}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function CustomerModal({ customer, onClose, onSaved }) {
  const [name, setName] = useState(customer?.name || "");
  const [cnic, setCnic] = useState(customer?.cnic || "");
  const [address, setAddress] = useState(customer?.address || "");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [creditLimit, setCreditLimit] = useState(customer?.creditLimit || 0);
  const [error, setError] = useState("");

  async function save() {
    if (!name) return setError("نام الزامی است");
    try {
      if (customer) {
        await api.put(`/customers/${customer.id}`, { name, cnic, address, phone });
      } else {
        await api.post("/customers", { name, cnic, address, phone, creditLimit });
      }
      onSaved();
    } catch (err) {
      setError(err.data?.error || "خطا در ذخیره");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-card w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="rtl text-lg font-semibold">{customer ? "ویرایش مشتری" : "مشتری جدید"}</h3>
          <button onClick={onClose} className="text-muted">
            <Icon name="x" size={18} />
          </button>
        </div>

        <label className="rtl block text-xs text-subtle mb-1">نام</label>
        <input className="w-full h-9 rounded-lg border border-line px-2 mb-3 text-sm rtl" value={name} onChange={(e) => setName(e.target.value)} />

        <label className="rtl block text-xs text-subtle mb-1">شماره ملی (CNIC)</label>
        <input className="w-full h-9 rounded-lg border border-line px-2 mb-3 text-sm num" value={cnic} onChange={(e) => setCnic(e.target.value)} placeholder="00000-0000000-0" />

        <label className="rtl block text-xs text-subtle mb-1">آدرس</label>
        <input className="w-full h-9 rounded-lg border border-line px-2 mb-3 text-sm rtl" value={address} onChange={(e) => setAddress(e.target.value)} />

        <label className="rtl block text-xs text-subtle mb-1">تلفن</label>
        <input className="w-full h-9 rounded-lg border border-line px-2 mb-3 text-sm num" value={phone} onChange={(e) => setPhone(e.target.value)} />

        {!customer && (
          <>
            <label className="rtl block text-xs text-subtle mb-1">سقف اعتبار اولیه</label>
            <input
              type="number"
              className="w-full h-9 rounded-lg border border-line px-2 mb-4 text-sm num"
              value={creditLimit}
              onChange={(e) => setCreditLimit(Number(e.target.value))}
            />
          </>
        )}

        {error && <p className="rtl text-xs text-danger mb-3">{error}</p>}

        <button onClick={save} className="w-full h-11 rounded-xl bg-accent text-white text-sm font-semibold rtl">
          ذخیره
        </button>
      </div>
    </div>
  );
}
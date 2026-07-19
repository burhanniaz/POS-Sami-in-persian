import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { formatMoney } from "../lib/format.js";
import { Icon } from "../components/Icon.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function Suppliers() {
  const { auth } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    const data = await api.get(`/suppliers${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    setSuppliers(data);
  }

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function addDebt(supplier) {
    const amountStr = window.prompt(`مبلغ بدهی جدید به ${supplier.name} (مثلا دریافت کالا به صورت نسیه):`, "");
    if (!amountStr) return;
    const amount = Number(amountStr);
    if (!amount || amount <= 0) return;
    await api.post(`/suppliers/${supplier.id}/add-debt`, { amount });
    load();
  }

  async function repay(supplier) {
    const amountStr = window.prompt(`مبلغ پرداختی به ${supplier.name}:`, "");
    if (!amountStr) return;
    const amount = Number(amountStr);
    if (!amount || amount <= 0) return;
    await api.post(`/suppliers/${supplier.id}/repay-loan`, { amount });
    load();
  }

  async function setCreditLimit(supplier) {
    const amountStr = window.prompt(`سقف اعتبار جدید برای ${supplier.name}:`, supplier.creditLimit);
    if (amountStr === null) return;
    await api.put(`/suppliers/${supplier.id}/credit-limit`, { creditLimit: Number(amountStr) });
    load();
  }

  async function deleteSupplier(supplier) {
    if (!window.confirm(`تامین‌کننده «${supplier.name}» حذف شود؟`)) return;
    setError("");
    try {
      await api.del(`/suppliers/${supplier.id}`);
      load();
    } catch (err) {
      setError(err.data?.error || "خطا در حذف تامین‌کننده");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-10 bg-card rounded-xl flex items-center gap-2 px-3">
          <Icon name="search" size={16} className="text-muted" />
          <input
            className="flex-1 rtl text-sm outline-none placeholder:text-muted"
            placeholder="جستجوی تامین‌کننده (نام، تماس، شماره ملی)…"
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
          <Icon name="plus" size={15} /> تامین‌کننده جدید
        </button>
      </div>

      {error && <p className="rtl text-xs text-danger">{error}</p>}

      <div className="bg-card rounded-card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="rtl text-xs text-subtle border-b border-line">
              <th className="text-right py-3 px-4">نام</th>
              <th className="text-right py-3 px-4">شماره ملی (NIC)</th>
              <th className="text-right py-3 px-4">آدرس</th>
              <th className="text-right py-3 px-4">تماس</th>
              <th className="text-right py-3 px-4">سقف اعتبار</th>
              <th className="text-right py-3 px-4">بدهی (نسیه)</th>
              <th className="text-right py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0">
                <td className="rtl py-3 px-4 whitespace-nowrap">{s.name}</td>
                <td className="num py-3 px-4 text-subtle whitespace-nowrap">{s.nic || "—"}</td>
                <td className="rtl py-3 px-4 text-subtle">{s.address || "—"}</td>
                <td className="num py-3 px-4 text-subtle whitespace-nowrap">{s.phone || "—"}</td>
                <td className="num py-3 px-4 whitespace-nowrap">{formatMoney(s.creditLimit)}</td>
                <td className="num py-3 px-4 whitespace-nowrap">{formatMoney(s.loanBalance)}</td>
                <td className="py-3 px-4">
                  <div className="flex gap-3 justify-end whitespace-nowrap">
                    <button onClick={() => addDebt(s)} className="rtl text-xs text-subtle">
                      ثبت بدهی
                    </button>
                    <button onClick={() => repay(s)} className="rtl text-xs text-accent">
                      پرداخت
                    </button>
                    {auth.role === "admin" && (
                      <>
                        <button
                          onClick={() => {
                            setEditing(s);
                            setModalOpen(true);
                          }}
                          className="rtl text-xs text-subtle"
                        >
                          ویرایش
                        </button>
                        <button onClick={() => setCreditLimit(s)} className="rtl text-xs text-subtle">
                          سقف اعتبار
                        </button>
                        <button onClick={() => deleteSupplier(s)} className="rtl text-xs text-danger">
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
        {suppliers.length === 0 && <p className="rtl text-sm text-muted text-center py-10">تامین‌کننده‌ای ثبت نشده</p>}
      </div>

      {modalOpen && (
        <SupplierModal
          supplier={editing}
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

function SupplierModal({ supplier, onClose, onSaved }) {
  const [name, setName] = useState(supplier?.name || "");
  const [nic, setNic] = useState(supplier?.nic || "");
  const [address, setAddress] = useState(supplier?.address || "");
  const [phone, setPhone] = useState(supplier?.phone || "");
  const [creditLimit, setCreditLimit] = useState(supplier?.creditLimit || 0);
  const [error, setError] = useState("");

  async function save() {
    if (!name) return setError("نام الزامی است");
    try {
      if (supplier) {
        await api.put(`/suppliers/${supplier.id}`, { name, nic, address, phone });
      } else {
        await api.post("/suppliers", { name, nic, address, phone, creditLimit });
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
          <h3 className="rtl text-lg font-semibold">{supplier ? "ویرایش تامین‌کننده" : "تامین‌کننده جدید"}</h3>
          <button onClick={onClose} className="text-muted">
            <Icon name="x" size={18} />
          </button>
        </div>

        <label className="rtl block text-xs text-subtle mb-1">نام</label>
        <input className="w-full h-9 rounded-lg border border-line px-2 mb-3 text-sm rtl" value={name} onChange={(e) => setName(e.target.value)} />

        <label className="rtl block text-xs text-subtle mb-1">شماره ملی (NIC)</label>
        <input className="w-full h-9 rounded-lg border border-line px-2 mb-3 text-sm num" value={nic} onChange={(e) => setNic(e.target.value)} placeholder="00000-0000000-0" />

        <label className="rtl block text-xs text-subtle mb-1">آدرس</label>
        <input className="w-full h-9 rounded-lg border border-line px-2 mb-3 text-sm rtl" value={address} onChange={(e) => setAddress(e.target.value)} />

        <label className="rtl block text-xs text-subtle mb-1">تماس</label>
        <input className="w-full h-9 rounded-lg border border-line px-2 mb-3 text-sm num" value={phone} onChange={(e) => setPhone(e.target.value)} />

        {!supplier && (
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
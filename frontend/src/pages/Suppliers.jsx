import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { Icon } from "../components/Icon.jsx";

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    setSuppliers(await api.get("/suppliers"));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="rtl text-lg font-semibold">تامین‌کنندگان</h2>
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

      <div className="bg-card rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="rtl text-xs text-subtle border-b border-line">
              <th className="text-right py-3 px-4">نام</th>
              <th className="text-right py-3 px-4">مسئول تماس</th>
              <th className="text-right py-3 px-4">تلفن</th>
              <th className="text-right py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0">
                <td className="rtl py-3 px-4">{s.name}</td>
                <td className="rtl py-3 px-4 text-subtle">{s.contact || "—"}</td>
                <td className="num py-3 px-4 text-subtle">{s.phone || "—"}</td>
                <td className="py-3 px-4 text-left">
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => {
                        setEditing(s);
                        setModalOpen(true);
                      }}
                      className="rtl text-xs text-accent"
                    >
                      ویرایش
                    </button>
                    <button
                      onClick={async () => {
                        if (window.confirm("حذف شود؟")) {
                          await api.del(`/suppliers/${s.id}`);
                          load();
                        }
                      }}
                      className="rtl text-xs text-danger"
                    >
                      حذف
                    </button>
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
  const [contact, setContact] = useState(supplier?.contact || "");
  const [phone, setPhone] = useState(supplier?.phone || "");
  const [error, setError] = useState("");

  async function save() {
    if (!name) return setError("نام الزامی است");
    try {
      if (supplier) {
        await api.put(`/suppliers/${supplier.id}`, { name, contact, phone });
      } else {
        await api.post("/suppliers", { name, contact, phone });
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
        <label className="rtl block text-xs text-subtle mb-1">مسئول تماس</label>
        <input className="w-full h-9 rounded-lg border border-line px-2 mb-3 text-sm rtl" value={contact} onChange={(e) => setContact(e.target.value)} />
        <label className="rtl block text-xs text-subtle mb-1">تلفن</label>
        <input className="w-full h-9 rounded-lg border border-line px-2 mb-4 text-sm num" value={phone} onChange={(e) => setPhone(e.target.value)} />
        {error && <p className="rtl text-xs text-danger mb-3">{error}</p>}
        <button onClick={save} className="w-full h-11 rounded-xl bg-accent text-white text-sm font-semibold rtl">
          ذخیره
        </button>
      </div>
    </div>
  );
}

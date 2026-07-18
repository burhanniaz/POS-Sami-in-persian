import { useEffect, useState } from "react";
import { api, resolveImageUrl } from "../api/client.js";
import { formatMoney, formatQty } from "../lib/format.js";
import { printReceipt } from "../lib/print.js";
import { Icon } from "../components/Icon.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function Inventory() {
  const { auth } = useAuth();
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    const data = await api.get(`/products${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    setProducts(data);
  }

  useEffect(() => {
    load();
    api.get("/suppliers").then(setSuppliers).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function adjustStock(product, delta) {
    const reason = window.prompt("دلیل اصلاح موجودی:", delta > 0 ? "دریافت کالا" : "اصلاح");
    if (reason === null) return;
    await api.post(`/products/${product.id}/adjust-stock`, { delta, reason });
    load();
  }

  async function printLabel(product) {
    const res = await api.get(`/products/${product.id}/print-label`);
    await printReceipt(res.printLabel, { plainTextFallback: `${product.name}\n${product.barcode}` });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-10 bg-card rounded-xl flex items-center gap-2 px-3">
          <Icon name="search" size={16} className="text-muted" />
          <input
            className="flex-1 rtl text-sm outline-none placeholder:text-muted"
            placeholder="جستجوی کالا، بارکد یا دسته…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {auth.role === "admin" && (
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="h-10 px-4 rounded-xl bg-accent text-white text-sm rtl flex items-center gap-1"
          >
            <Icon name="plus" size={15} /> کالای جدید
          </button>
        )}
      </div>

      <div className="bg-card rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="rtl text-xs text-subtle border-b border-line">
              <th className="text-right py-3 px-4"></th>
              <th className="text-right py-3 px-4">نام کالا</th>
              <th className="text-right py-3 px-4">بارکد</th>
              <th className="text-right py-3 px-4">دسته</th>
              <th className="text-right py-3 px-4">قیمت خرید</th>
              <th className="text-right py-3 px-4">قیمت فروش</th>
              <th className="text-right py-3 px-4">موجودی</th>
              <th className="text-right py-3 px-4">تامین‌کننده</th>
              <th className="text-right py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const low = Number(p.stockQty) <= Number(p.lowStockThreshold);
              return (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="py-2 px-4">
                    <div className="w-10 h-10 rounded-lg bg-paper overflow-hidden flex items-center justify-center text-muted shrink-0">
                      {p.imageUrl ? (
                        <img src={resolveImageUrl(p.imageUrl)} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Icon name="box" size={16} />
                      )}
                    </div>
                  </td>
                  <td className="rtl py-3 px-4">{p.name}</td>
                  <td className="num py-3 px-4 text-subtle">{p.barcode}</td>
                  <td className="rtl py-3 px-4 text-subtle">{p.category || "—"}</td>
                  <td className="num py-3 px-4">{formatMoney(p.costPrice)}</td>
                  <td className="num py-3 px-4">{formatMoney(p.salePrice)}</td>
                  <td className="py-3 px-4">
                    <span className={`num px-2 py-0.5 rounded ${low ? "bg-warn-light text-warn" : ""}`}>
                      {formatQty(p.stockQty)} {p.unit}
                    </span>
                  </td>
                  <td className="rtl py-3 px-4 text-subtle">{p.supplier?.name || "—"}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => adjustStock(p, 1)} className="w-7 h-7 rounded-lg bg-paper flex items-center justify-center">
                        <Icon name="plus" size={13} />
                      </button>
                      <button onClick={() => adjustStock(p, -1)} className="w-7 h-7 rounded-lg bg-paper flex items-center justify-center">
                        <Icon name="minus" size={13} />
                      </button>
                      <button onClick={() => printLabel(p)} className="w-7 h-7 rounded-lg bg-paper flex items-center justify-center">
                        <Icon name="print" size={13} />
                      </button>
                      {auth.role === "admin" && (
                        <button
                          onClick={() => {
                            setEditing(p);
                            setModalOpen(true);
                          }}
                          className="rtl text-xs text-accent"
                        >
                          ویرایش
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {products.length === 0 && <p className="rtl text-sm text-muted text-center py-10">کالایی یافت نشد</p>}
      </div>

      {modalOpen && (
        <ProductModal
          product={editing}
          suppliers={suppliers}
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

function ProductModal({ product, suppliers, onClose, onSaved }) {
  const [form, setForm] = useState(
    product || {
      name: "",
      barcode: "",
      category: "",
      costPrice: 0,
      salePrice: 0,
      stockQty: 0,
      unit: "piece",
      lowStockThreshold: 5,
      supplierId: "",
      imageUrl: "",
    }
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleImagePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const { imageUrl } = await api.uploadProductImage(file);
      set("imageUrl", imageUrl);
    } catch (err) {
      setError(err.data?.error || "خطا در آپلود تصویر");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setLoading(true);
    setError("");
    try {
      if (product) {
        await api.put(`/products/${product.id}`, form);
      } else {
        const res = await api.post("/products", form);
        if (res.printLabel) {
          await printReceipt(res.printLabel, {
            plainTextFallback: `${res.product.name}\n${res.product.barcode}`,
          });
        }
      }
      onSaved();
    } catch (err) {
      setError(err.data?.error || "خطا در ذخیره کالا");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-card w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="rtl text-lg font-semibold">{product ? "ویرایش کالا" : "کالای جدید"}</h3>
          <button onClick={onClose} className="text-muted">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <Field label="تصویر کالا">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl bg-paper overflow-hidden flex items-center justify-center text-muted shrink-0">
                {form.imageUrl ? (
                  <img src={resolveImageUrl(form.imageUrl)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="rtl text-[10px] text-muted">بدون تصویر</span>
                )}
              </div>
              <label className="rtl text-xs text-accent cursor-pointer">
                {uploading ? "در حال آپلود…" : "انتخاب تصویر"}
                <input type="file" accept="image/*" className="hidden" onChange={handleImagePick} disabled={uploading} />
              </label>
            </div>
          </Field>
          <Field label="نام کالا">
            <input className="w-full h-9 rounded-lg border border-line px-2 text-sm rtl" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="بارکد (خالی بگذارید تا خودکار تولید شود)">
            <input className="w-full h-9 rounded-lg border border-line px-2 text-sm num" value={form.barcode || ""} onChange={(e) => set("barcode", e.target.value)} disabled={!!product} />
          </Field>
          <Field label="دسته">
            <input className="w-full h-9 rounded-lg border border-line px-2 text-sm rtl" value={form.category || ""} onChange={(e) => set("category", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="قیمت خرید">
              <input type="number" className="w-full h-9 rounded-lg border border-line px-2 text-sm num" value={form.costPrice} onChange={(e) => set("costPrice", Number(e.target.value))} />
            </Field>
            <Field label="قیمت فروش">
              <input type="number" className="w-full h-9 rounded-lg border border-line px-2 text-sm num" value={form.salePrice} onChange={(e) => set("salePrice", Number(e.target.value))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="موجودی">
              <input type="number" className="w-full h-9 rounded-lg border border-line px-2 text-sm num" value={form.stockQty} onChange={(e) => set("stockQty", Number(e.target.value))} disabled={!!product} />
            </Field>
            <Field label="واحد">
              <select className="w-full h-9 rounded-lg border border-line px-2 text-sm rtl" value={form.unit} onChange={(e) => set("unit", e.target.value)}>
                <option value="piece">عدد</option>
                <option value="box">جعبه</option>
                <option value="kg">کیلوگرم</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="حد هشدار موجودی کم">
              <input type="number" className="w-full h-9 rounded-lg border border-line px-2 text-sm num" value={form.lowStockThreshold} onChange={(e) => set("lowStockThreshold", Number(e.target.value))} />
            </Field>
            <Field label="تامین‌کننده">
              <select className="w-full h-9 rounded-lg border border-line px-2 text-sm rtl" value={form.supplierId || ""} onChange={(e) => set("supplierId", e.target.value)}>
                <option value="">—</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        {error && <p className="rtl text-xs text-danger mt-3">{error}</p>}

        <button onClick={save} disabled={loading} className="w-full h-11 rounded-xl bg-accent text-white text-sm font-semibold rtl mt-4 disabled:opacity-60">
          ذخیره
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="rtl block text-xs text-subtle mb-1">{label}</label>
      {children}
    </div>
  );
}
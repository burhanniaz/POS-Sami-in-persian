import { useEffect, useState } from "react";
import { api, resolveImageUrl } from "../api/client.js";

const LABELS = {
  SYNC_POLL_INTERVAL_MS: "فاصله همگام‌سازی زنده (میلی‌ثانیه)",
  SESSION_TIMEOUT_MINUTES: "زمان قفل خودکار نشست (دقیقه)",
  DISCOUNT_APPROVAL_THRESHOLD_PERCENT: "آستانه تایید تخفیف (درصد)",
  DISCOUNT_APPROVAL_THRESHOLD_AMOUNT: "آستانه تایید تخفیف (مبلغ)",
  CURRENCY_THOUSANDS_SEPARATOR: "جداکننده هزارگان",
  RETURN_DEFAULT_RESTOCK: "بازگشت پیش‌فرض به موجودی هنگام مرجوعی",
};

// These are edited in the dedicated "Store branding" panel below, not the generic list
const BRANDING_KEYS = ["STORE_NAME", "STORE_ADDRESS", "STORE_PHONE", "STORE_LOGO_URL"];

export default function Settings() {
  const [settings, setSettings] = useState([]);
  const [cashiers, setCashiers] = useState([]);
  const [terminals, setTerminals] = useState([]);
  const [newCashierName, setNewCashierName] = useState("");
  const [newCashierPin, setNewCashierPin] = useState("");
  const [newTerminalName, setNewTerminalName] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  async function load() {
    setSettings(await api.get("/auth/settings"));
    setCashiers(await api.get("/auth/cashiers"));
    setTerminals(await api.get("/auth/terminals"));
  }

  useEffect(() => {
    load();
  }, []);

  async function updateSetting(key, value) {
    await api.put(`/auth/settings/${key}`, { value });
    load();
  }

  async function handleLogoPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      await api.uploadStoreLogo(file);
      load();
    } finally {
      setUploadingLogo(false);
    }
  }

  async function addCashier() {
    if (!newCashierName || !newCashierPin) return;
    await api.post("/auth/cashiers", { name: newCashierName, pin: newCashierPin });
    setNewCashierName("");
    setNewCashierPin("");
    load();
  }

  async function addTerminal() {
    if (!newTerminalName) return;
    await api.post("/auth/terminals", { name: newTerminalName });
    setNewTerminalName("");
    load();
  }

  const brandingMap = Object.fromEntries(settings.filter((s) => BRANDING_KEYS.includes(s.key)).map((s) => [s.key, s.value]));
  const otherSettings = settings.filter((s) => !BRANDING_KEYS.includes(s.key));

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <h2 className="rtl text-lg font-semibold">تنظیمات سیستم</h2>

      <div className="bg-card rounded-card p-4">
        <h3 className="rtl text-sm font-semibold mb-1">هویت فروشگاه (سربرگ رسید چاپی)</h3>
        <p className="rtl text-xs text-muted mb-3">این اطلاعات در بالای هر رسید چاپ‌شده نمایش داده می‌شود.</p>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-16 h-16 rounded-xl bg-paper overflow-hidden flex items-center justify-center text-muted shrink-0">
            {brandingMap.STORE_LOGO_URL ? (
              <img src={resolveImageUrl(brandingMap.STORE_LOGO_URL)} alt="" className="w-full h-full object-contain" />
            ) : (
              <span className="rtl text-[10px] text-muted">بدون لوگو</span>
            )}
          </div>
          <label className="rtl text-xs text-accent cursor-pointer">
            {uploadingLogo ? "در حال آپلود…" : "انتخاب لوگو"}
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoPick} disabled={uploadingLogo} />
          </label>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="rtl block text-xs text-subtle mb-1">نام فروشگاه</label>
            <input
              className="w-full h-9 rounded-lg border border-line px-2 text-sm rtl"
              defaultValue={brandingMap.STORE_NAME || ""}
              onBlur={(e) => updateSetting("STORE_NAME", e.target.value)}
            />
          </div>
          <div>
            <label className="rtl block text-xs text-subtle mb-1">آدرس</label>
            <input
              className="w-full h-9 rounded-lg border border-line px-2 text-sm rtl"
              defaultValue={brandingMap.STORE_ADDRESS || ""}
              onBlur={(e) => updateSetting("STORE_ADDRESS", e.target.value)}
            />
          </div>
          <div>
            <label className="rtl block text-xs text-subtle mb-1">شماره تماس</label>
            <input
              className="w-full h-9 rounded-lg border border-line px-2 text-sm num"
              defaultValue={brandingMap.STORE_PHONE || ""}
              onBlur={(e) => updateSetting("STORE_PHONE", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-card rounded-card p-4">
        <h3 className="rtl text-sm font-semibold mb-3">پارامترهای عمومی</h3>
        <div className="flex flex-col gap-3">
          {otherSettings.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-3">
              <label className="rtl text-xs text-subtle flex-1">{LABELS[s.key] || s.key}</label>
              <input
                className="w-32 h-8 rounded-lg border border-line px-2 num text-xs"
                defaultValue={s.value}
                onBlur={(e) => updateSetting(s.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-card p-4">
        <h3 className="rtl text-sm font-semibold mb-3">صندوق‌داران</h3>
        <div className="flex flex-col gap-2 mb-3">
          {cashiers.map((c) => (
            <div key={c.id} className="rtl text-sm border-b border-line pb-2 last:border-0">
              {c.name}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input placeholder="نام صندوق‌دار" className="flex-1 h-9 rounded-lg border border-line px-2 text-sm rtl" value={newCashierName} onChange={(e) => setNewCashierName(e.target.value)} />
          <input placeholder="پین" className="w-24 h-9 rounded-lg border border-line px-2 text-sm num" value={newCashierPin} onChange={(e) => setNewCashierPin(e.target.value)} />
          <button onClick={addCashier} className="h-9 px-4 rounded-lg bg-accent text-white text-sm rtl">
            افزودن
          </button>
        </div>
      </div>

      <div className="bg-card rounded-card p-4">
        <h3 className="rtl text-sm font-semibold mb-3">ترمینال‌ها</h3>
        <div className="flex flex-col gap-2 mb-3">
          {terminals.map((t) => (
            <div key={t.id} className="rtl text-sm border-b border-line pb-2 last:border-0">
              {t.name}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input placeholder="نام ترمینال (مثال: صندوق ۲)" className="flex-1 h-9 rounded-lg border border-line px-2 text-sm rtl" value={newTerminalName} onChange={(e) => setNewTerminalName(e.target.value)} />
          <button onClick={addTerminal} className="h-9 px-4 rounded-lg bg-accent text-white text-sm rtl">
            افزودن
          </button>
        </div>
      </div>
    </div>
  );
}
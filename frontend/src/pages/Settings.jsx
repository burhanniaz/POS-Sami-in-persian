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
            <CashierRow key={c.id} cashier={c} onChanged={load} />
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
            <TerminalRow key={t.id} terminal={t} onChanged={load} />
          ))}
        </div>
        <div className="flex gap-2">
          <input placeholder="نام ترمینال (مثال: صندوق ۲)" className="flex-1 h-9 rounded-lg border border-line px-2 text-sm rtl" value={newTerminalName} onChange={(e) => setNewTerminalName(e.target.value)} />
          <button onClick={addTerminal} className="h-9 px-4 rounded-lg bg-accent text-white text-sm rtl">
            افزودن
          </button>
        </div>
      </div>

      <AdminAccountPanel />
    </div>
  );
}

function CashierRow({ cashier, onChanged }) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(cashier.name);
  const [editingPin, setEditingPin] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  async function saveName() {
    if (!name.trim()) return;
    await api.put(`/auth/cashiers/${cashier.id}/name`, { name: name.trim() });
    setEditingName(false);
    onChanged();
  }

  async function savePin() {
    if (!pin) return;
    await api.put(`/auth/cashiers/${cashier.id}/pin`, { pin });
    setEditingPin(false);
    setPin("");
    onChanged();
  }

  async function remove() {
    if (!window.confirm(`صندوق‌دار «${cashier.name}» حذف شود؟`)) return;
    setError("");
    try {
      await api.del(`/auth/cashiers/${cashier.id}`);
      onChanged();
    } catch (err) {
      if (err.status === 409) {
        if (window.confirm("این صندوق‌دار سابقه فروش دارد و قابل حذف نیست. غیرفعال شود؟")) {
          await api.put(`/auth/cashiers/${cashier.id}/deactivate`);
          onChanged();
        }
      } else {
        setError(err.message);
      }
    }
  }

  return (
    <div className="flex flex-col gap-1 border-b border-line pb-2 last:border-0">
      <div className="flex items-center justify-between gap-2">
        {editingName ? (
          <div className="flex-1 flex gap-2">
            <input className="flex-1 h-8 rounded-lg border border-line px-2 text-sm rtl" value={name} onChange={(e) => setName(e.target.value)} />
            <button onClick={saveName} className="text-xs text-accent rtl">ذخیره</button>
            <button onClick={() => { setEditingName(false); setName(cashier.name); }} className="text-xs text-subtle rtl">انصراف</button>
          </div>
        ) : (
          <span className="rtl text-sm flex-1">
            {cashier.name} {cashier.active === false && <span className="text-xs text-subtle">(غیرفعال)</span>}
          </span>
        )}
        {!editingName && (
          <div className="flex gap-3 shrink-0">
            <button onClick={() => setEditingName(true)} className="text-xs text-accent rtl">ویرایش نام</button>
            <button onClick={() => setEditingPin(true)} className="text-xs text-accent rtl">تغییر پین</button>
            <button onClick={remove} className="text-xs text-red-600 rtl">حذف</button>
          </div>
        )}
      </div>
      {editingPin && (
        <div className="flex gap-2">
          <input placeholder="پین جدید" className="w-24 h-8 rounded-lg border border-line px-2 text-xs num" value={pin} onChange={(e) => setPin(e.target.value)} />
          <button onClick={savePin} className="text-xs text-accent rtl">ذخیره</button>
          <button onClick={() => { setEditingPin(false); setPin(""); }} className="text-xs text-subtle rtl">انصراف</button>
        </div>
      )}
      {error && <span className="rtl text-xs text-red-600">{error}</span>}
    </div>
  );
}

function TerminalRow({ terminal, onChanged }) {
  const [error, setError] = useState("");

  async function remove() {
    if (!window.confirm(`ترمینال «${terminal.name}» حذف شود؟`)) return;
    setError("");
    try {
      await api.del(`/auth/terminals/${terminal.id}`);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="flex flex-col gap-1 border-b border-line pb-2 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="rtl text-sm flex-1">{terminal.name}</span>
        <button onClick={remove} className="text-xs text-red-600 rtl shrink-0">حذف</button>
      </div>
      {error && <span className="rtl text-xs text-red-600">{error}</span>}
    </div>
  );
}

function AdminAccountPanel() {
  const [newUsername, setNewUsername] = useState("");
  const [usernamePassword, setUsernamePassword] = useState("");
  const [usernameMsg, setUsernameMsg] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");

  async function saveUsername() {
    setUsernameMsg("");
    try {
      await api.put("/auth/admin/username", { newUsername, currentPassword: usernamePassword });
      setUsernameMsg("نام کاربری بروزرسانی شد.");
      setNewUsername("");
      setUsernamePassword("");
    } catch (err) {
      setUsernameMsg(err.message);
    }
  }

  async function savePassword() {
    setPasswordMsg("");
    try {
      await api.put("/auth/admin/password", { currentPassword, newPassword });
      setPasswordMsg("رمز عبور بروزرسانی شد.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordMsg(err.message);
    }
  }

  return (
    <div className="bg-card rounded-card p-4">
      <h3 className="rtl text-sm font-semibold mb-3">حساب مدیر</h3>

      <div className="flex flex-col gap-2 mb-4">
        <label className="rtl text-xs text-subtle">تغییر نام کاربری</label>
        <input placeholder="نام کاربری جدید" className="h-9 rounded-lg border border-line px-2 text-sm rtl" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
        <input placeholder="رمز عبور فعلی" type="password" className="h-9 rounded-lg border border-line px-2 text-sm rtl" value={usernamePassword} onChange={(e) => setUsernamePassword(e.target.value)} />
        <button onClick={saveUsername} className="h-9 px-4 rounded-lg bg-accent text-white text-sm rtl self-start">ذخیره نام کاربری</button>
        {usernameMsg && <span className="rtl text-xs">{usernameMsg}</span>}
      </div>

      <div className="flex flex-col gap-2">
        <label className="rtl text-xs text-subtle">تغییر رمز عبور</label>
        <input placeholder="رمز عبور فعلی" type="password" className="h-9 rounded-lg border border-line px-2 text-sm rtl" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        <input placeholder="رمز عبور جدید (حداقل ۸ کاراکتر)" type="password" className="h-9 rounded-lg border border-line px-2 text-sm rtl" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <button onClick={savePassword} className="h-9 px-4 rounded-lg bg-accent text-white text-sm rtl self-start">ذخیره رمز عبور</button>
        {passwordMsg && <span className="rtl text-xs">{passwordMsg}</span>}
      </div>
    </div>
  );
}
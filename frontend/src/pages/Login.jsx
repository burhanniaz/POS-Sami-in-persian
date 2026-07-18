import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { Icon } from "../components/Icon.jsx";

export default function Login() {
  const { terminalId, chooseTerminal, cashierLogin, adminLogin } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("cashier"); // cashier | admin
  const [terminals, setTerminals] = useState([]);
  const [cashiers, setCashiers] = useState([]);
  const [selectedCashier, setSelectedCashier] = useState(null);
  const [pin, setPin] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/auth/terminals").then(setTerminals).catch(() => {});
    api.get("/auth/cashiers").then(setCashiers).catch(() => {});
  }, []);

  async function submitCashier() {
    setError("");
    if (!terminalId) return setError("ابتدا دستگاه (ترمینال) را انتخاب کنید");
    if (!selectedCashier) return setError("صندوق‌دار را انتخاب کنید");
    if (pin.length < 4) return setError("پین را کامل وارد کنید");
    setLoading(true);
    try {
      await cashierLogin(selectedCashier.id, pin);
      navigate("/pos");
    } catch (err) {
      setError(err.data?.error || "پین اشتباه است");
      setPin("");
    } finally {
      setLoading(false);
    }
  }

  async function submitAdmin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await adminLogin(username, password);
      navigate("/reports");
    } catch (err) {
      setError(err.data?.error || "نام کاربری یا رمز عبور اشتباه است");
    } finally {
      setLoading(false);
    }
  }

  function pressDigit(d) {
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    setError("");
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card rounded-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-[9px] bg-accent flex items-center justify-center text-white">
            <Icon name="store" size={18} />
          </div>
          <span className="rtl text-lg font-semibold flex-1">ورود به سیستم فروشگاهی</span>
        </div>

        <div className="mb-4">
          <label className="rtl block text-xs text-subtle mb-1">دستگاه (ترمینال)</label>
          <select
            className="w-full h-10 rounded-lg border border-line px-3 text-sm rtl"
            value={terminalId}
            onChange={(e) => chooseTerminal(e.target.value)}
          >
            <option value="">انتخاب دستگاه…</option>
            {terminals.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex bg-paper rounded-lg p-1 mb-5">
          <button
            className={`flex-1 h-9 rounded-md text-sm rtl ${mode === "cashier" ? "bg-card font-medium" : "text-subtle"}`}
            onClick={() => setMode("cashier")}
          >
            صندوق‌دار
          </button>
          <button
            className={`flex-1 h-9 rounded-md text-sm rtl ${mode === "admin" ? "bg-card font-medium" : "text-subtle"}`}
            onClick={() => setMode("admin")}
          >
            مدیر
          </button>
        </div>

        {mode === "cashier" ? (
          <div>
            <label className="rtl block text-xs text-subtle mb-1">صندوق‌دار</label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {cashiers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCashier(c);
                    setPin("");
                    setError("");
                  }}
                  className={`h-10 rounded-lg text-sm rtl border ${
                    selectedCashier?.id === c.id ? "border-accent bg-accent-light text-accent" : "border-line text-subtle"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className="flex justify-center gap-2 mb-4">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full ${i < pin.length ? "bg-accent" : "bg-line"}`}
                />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button
                  key={d}
                  onClick={() => pressDigit(d)}
                  className="h-12 rounded-lg bg-paper text-lg num hover:bg-line"
                >
                  {d}
                </button>
              ))}
              <button onClick={() => setPin("")} className="h-12 rounded-lg bg-paper text-xs text-subtle rtl">
                پاک کردن
              </button>
              <button onClick={() => pressDigit("0")} className="h-12 rounded-lg bg-paper text-lg num hover:bg-line">
                0
              </button>
              <button
                onClick={() => setPin(pin.slice(0, -1))}
                className="h-12 rounded-lg bg-paper text-subtle flex items-center justify-center"
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            {error && <p className="rtl text-xs text-danger mb-3">{error}</p>}

            <button
              onClick={submitCashier}
              disabled={loading}
              className="w-full h-11 rounded-xl bg-accent text-white text-sm font-medium rtl disabled:opacity-60"
            >
              ورود
            </button>
          </div>
        ) : (
          <form onSubmit={submitAdmin}>
            <label className="rtl block text-xs text-subtle mb-1">نام کاربری</label>
            <input
              className="w-full h-10 rounded-lg border border-line px-3 mb-3 text-sm rtl"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
            <label className="rtl block text-xs text-subtle mb-1">رمز عبور</label>
            <input
              type="password"
              className="w-full h-10 rounded-lg border border-line px-3 mb-4 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {error && <p className="rtl text-xs text-danger mb-3">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-accent text-white text-sm font-medium rtl disabled:opacity-60"
            >
              ورود
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const raw = localStorage.getItem("pos_auth");
    return raw ? JSON.parse(raw) : null;
  });
  const [terminalId, setTerminalId] = useState(() => localStorage.getItem("pos_terminal_id") || "");
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(10);
  const idleTimer = useRef(null);

  useEffect(() => {
    api
      .get("/auth/settings/public")
      .then((s) => {
        if (s.SESSION_TIMEOUT_MINUTES) setSessionTimeoutMinutes(Number(s.SESSION_TIMEOUT_MINUTES));
      })
      .catch(() => {});
  }, []);

  const persistAuth = useCallback((next) => {
    setAuth(next);
    if (next) {
      localStorage.setItem("pos_auth", JSON.stringify(next));
      localStorage.setItem("pos_token", next.token);
    } else {
      localStorage.removeItem("pos_auth");
      localStorage.removeItem("pos_token");
    }
  }, []);

  const chooseTerminal = useCallback((id) => {
    setTerminalId(id);
    localStorage.setItem("pos_terminal_id", id);
  }, []);

  const cashierLogin = useCallback(
    async (cashierId, pin) => {
      const res = await api.post("/auth/cashier/login", { cashierId, pin, terminalId });
      persistAuth({ role: "cashier", token: res.token, id: res.cashier.id, name: res.cashier.name, sessionId: res.sessionId, terminalId });
    },
    [terminalId, persistAuth]
  );

  const adminLogin = useCallback(
    async (username, password) => {
      const res = await api.post("/auth/admin/login", { username, password });
      persistAuth({ role: "admin", token: res.token, id: res.admin.id, name: res.admin.username });
    },
    [persistAuth]
  );

  const logout = useCallback(async () => {
    try {
      if (auth?.role === "cashier") await api.post("/auth/cashier/logout");
    } catch {
      // ignore, log out locally regardless
    }
    persistAuth(null);
  }, [auth, persistAuth]);

  // Session auto-lock after configured minutes of inactivity (cashier sessions only)
  useEffect(() => {
    if (!auth || auth.role !== "cashier") return undefined;

    const resetTimer = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(async () => {
        try {
          await api.post("/auth/cashier/auto-lock");
        } catch {
          // ignore
        }
        persistAuth(null);
      }, sessionTimeoutMinutes * 60 * 1000);
    };

    const events = ["mousemove", "keydown", "click", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [auth, sessionTimeoutMinutes, persistAuth]);

  return (
    <AuthContext.Provider
      value={{ auth, terminalId, chooseTerminal, cashierLogin, adminLogin, logout, sessionTimeoutMinutes }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

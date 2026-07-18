import { NavLink } from "react-router-dom";
import { Icon } from "./Icon.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const items = [
  { to: "/pos", icon: "store", label: "فروش" },
  { to: "/inventory", icon: "box", label: "کالاها" },
  { to: "/customers", icon: "users", label: "مشتریان" },
  { to: "/suppliers", icon: "truck", label: "تامین‌کنندگان" },
  { to: "/reports", icon: "chart", label: "گزارش‌ها" },
  { to: "/returns", icon: "returnIcon", label: "مرجوعی" },
];

export default function NavRail() {
  const { auth, logout } = useAuth();

  return (
    <nav className="w-16 bg-card rounded-card flex flex-col items-center py-4 gap-5 shrink-0">
      <div className="w-9 h-9 rounded-[9px] bg-accent flex items-center justify-center text-white">
        <Icon name="store" size={18} />
      </div>

      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          title={it.label}
          className={({ isActive }) =>
            `w-9 h-9 rounded-[9px] flex items-center justify-center transition-colors ${
              isActive ? "bg-accent-light text-accent" : "text-muted hover:text-subtle"
            }`
          }
        >
          <Icon name={it.icon} size={17} />
        </NavLink>
      ))}

      <div className="flex-1" />

      {auth?.role === "admin" && (
        <NavLink
          to="/settings"
          title="تنظیمات"
          className={({ isActive }) =>
            `w-9 h-9 rounded-[9px] flex items-center justify-center ${
              isActive ? "bg-accent-light text-accent" : "text-muted hover:text-subtle"
            }`
          }
        >
          <Icon name="settings" size={17} />
        </NavLink>
      )}

      <button title="خروج" onClick={logout} className="w-9 h-9 rounded-[9px] flex items-center justify-center text-muted hover:text-danger">
        <Icon name="power" size={17} />
      </button>
    </nav>
  );
}

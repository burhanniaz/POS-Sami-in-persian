import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard, ShoppingCart, Package, Users, Truck,
  RotateCcw, BarChart3, UserCog, Settings, Menu, X, LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'داشبورد', icon: LayoutDashboard, end: true },
  { to: '/pos', label: 'صندوق', icon: ShoppingCart },
  { to: '/products', label: 'محصولات', icon: Package },
  { to: '/customers', label: 'مشتریان', icon: Users },
  { to: '/suppliers', label: 'تامین‌کنندگان', icon: Truck },
  { to: '/returns', label: 'مرجوعی‌ها', icon: RotateCcw },
  { to: '/reports', label: 'گزارش‌ها', icon: BarChart3 },
  { to: '/users', label: 'کاربران', icon: UserCog, adminOnly: true },
  { to: '/settings', label: 'تنظیمات', icon: Settings, adminOnly: true },
];

// Bottom bar on mobile only surfaces the highest-frequency actions; rest live in the drawer.
const MOBILE_PRIMARY = ['/', '/pos', '/products', '/customers'];

function NavItems({ items, onClick, orientation = 'vertical' }) {
  return (
    <nav className={orientation === 'vertical' ? 'flex flex-col gap-1' : 'flex'}>
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onClick}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
             ${isActive ? 'bg-ink-800 text-white' : 'text-paper-200/80 hover:bg-ink-800/60 hover:text-white'}`
          }
        >
          <Icon size={18} strokeWidth={2} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();

  const visibleItems = NAV_ITEMS.filter((i) => !i.adminOnly || user?.role === 'admin');
  const mobilePrimary = visibleItems.filter((i) => MOBILE_PRIMARY.includes(i.to));

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex bg-paper-100">
      {/* Desktop / tablet sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 bg-ink-900 p-4 gap-6">
        <div>
          <div className="text-white font-bold text-lg tracking-tight">صندوق فروش</div>
          <div className="text-paper-200/60 text-xs mt-0.5">سامانه مدیریت فروشگاه</div>
        </div>
        <NavItems items={visibleItems} />
        <div className="mt-auto pt-4 border-t border-ink-800">
          <div className="text-paper-200/70 text-xs mb-2 truncate">{user?.full_name}</div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-rose-600 text-sm font-medium hover:text-rose-400"
          >
            <LogOut size={16} /> خروج از حساب
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-ink-900 flex items-center justify-between px-4">
        <button onClick={() => setDrawerOpen(true)} aria-label="باز کردن منو" className="text-white p-1">
          <Menu size={22} />
        </button>
        <div className="text-white font-bold">صندوق فروش</div>
        <div className="w-8" />
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-72 bg-ink-900 p-4 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="text-white font-bold text-lg">صندوق فروش</div>
              <button onClick={() => setDrawerOpen(false)} className="text-white p-1" aria-label="بستن منو">
                <X size={20} />
              </button>
            </div>
            <NavItems items={visibleItems} onClick={() => setDrawerOpen(false)} />
            <div className="mt-auto pt-4 border-t border-ink-800">
              <div className="text-paper-200/70 text-xs mb-2 truncate">{user?.full_name}</div>
              <button onClick={handleLogout} className="flex items-center gap-2 text-rose-600 text-sm font-medium">
                <LogOut size={16} /> خروج از حساب
              </button>
            </div>
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setDrawerOpen(false)} />
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 pt-14 pb-16 md:pt-0 md:pb-0">
        <div className="p-4 md:p-6 max-w-6xl mx-auto">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 h-16 bg-ink-900 border-t border-ink-800">
        <div className="flex h-full">
          {mobilePrimary.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium
                 ${isActive ? 'text-emerald-600' : 'text-paper-200/70'}`
              }
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}

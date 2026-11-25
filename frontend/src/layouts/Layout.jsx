import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { NotificationAPI } from "../services/api";
import { Avatar } from "../components/ui";

const NAV = [
  { to: "/", icon: "📊", label: "Dashboard" },
  { to: "/medicines", icon: "💊", label: "Medicines" },
  { to: "/stock", icon: "🗃️", label: "Stock Management" },
  { to: "/issue", icon: "📤", label: "Issue Medicine" },
  { to: "/alerts", icon: "🚨", label: "Shortage Alerts" },
  { to: "/expiry", icon: "⏳", label: "Expiry Monitor" },
  { to: "/prediction", icon: "📈", label: "Demand Prediction" },
  { to: "/suppliers", icon: "🏭", label: "Suppliers" },
  { to: "/reports", icon: "📑", label: "Reports" },
  { to: "/notifications", icon: "🔔", label: "Notifications" },
  { to: "/settings", icon: "⚙️", label: "Settings" },
];

function SidebarContent({ onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-medical-400 to-tealish-500 shadow-soft">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
            <rect x="8" y="2" width="8" height="20" rx="3" />
            <path d="M11 8h2M11 12h2M11 16h2" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-extrabold tracking-wide text-white">MedTrack</p>
          <p className="text-[11px] font-medium text-medical-100/60">Shortage Tracker</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {NAV.map((item) => {
          const active =
            item.to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                active
                  ? "bg-white/10 text-white shadow-sm ring-1 ring-white/10"
                  : "text-medical-100/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-rose-200 transition hover:bg-white/5 hover:text-rose-100"
        >
          <span className="text-base leading-none">🚪</span>
          Logout
        </button>
        <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2.5">
          <Avatar name={user?.username || "U"} size={30} />
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-white">{user?.username}</p>
            <p className="truncate text-[11px] capitalize text-medical-100/50">{user?.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const ref = useRef(null);

  const load = async () => {
    try {
      const res = await NotificationAPI.list();
      setItems(res.data);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unread = items.filter((n) => !n.is_read).length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100"
        aria-label="Notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-40 w-96 max-w-[90vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-slate-800">Notifications</p>
            <button
              className="text-xs font-semibold text-medical-600 hover:text-medical-700"
              onClick={async () => {
                await NotificationAPI.markAllRead();
                load();
              }}
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-400">No notifications yet</p>
            )}
            {items.slice(0, 12).map((n) => (
              <div key={n.id} className={`border-b border-slate-50 px-4 py-3 ${n.is_read ? "" : "bg-medical-50/40"}`}>
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-medical-500" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700">{n.title}</p>
                    <p className="text-xs text-slate-500">{n.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchBox() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  return (
    <form
      className="hidden w-72 md:block"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm transition focus:border-medical-400 focus:outline-none focus:ring-2 focus:ring-medical-200"
          placeholder="Search medicines, batches, suppliers..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
    </form>
  );
}

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-gradient-to-b from-medical-900 via-medical-950 to-medical-900 lg:flex">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-gradient-to-b from-medical-900 via-medical-950 to-medical-900 shadow-soft">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button
              className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>

            <SearchBox />

            <div className="ml-auto flex items-center gap-2 sm:gap-4">
              <div className="hidden text-right sm:block">
                <p className="text-xs font-bold text-slate-700">{dateStr}</p>
                <p className="text-[11px] font-medium text-slate-400">{timeStr}</p>
              </div>
              <NotificationsDropdown />
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1 pl-1 pr-3 shadow-sm">
                <Avatar name="MT" size={30} />
                <div className="hidden sm:block">
                  <p className="text-xs font-bold text-slate-700">MedTrack</p>
                  <p className="text-[11px] text-slate-400">Pharmacy Admin</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>

        <footer className="px-6 py-4 text-center text-xs text-slate-400">
          MedTrack · Medicine Shortage Tracking & Alert System · Predictions are estimates, not medical advice
        </footer>
      </div>
    </div>
  );
}

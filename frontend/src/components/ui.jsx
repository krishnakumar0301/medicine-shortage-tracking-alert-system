import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

export function Spinner({ size = 20, className = "" }) {
  return (
    <svg
      className={`animate-spin text-medical-600 ${className}`}
      style={{ width: size, height: size }}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function PageLoader({ label = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-500">
      <Spinner size={34} />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

export function EmptyState({ icon = "📦", title = "Nothing here yet", message, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-medical-50 text-3xl">
        {icon}
      </div>
      <h3 className="text-base font-bold text-slate-700">{title}</h3>
      {message && <p className="max-w-md text-sm text-slate-500">{message}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} />;
}

export function Card({ children, className = "" }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const STATUS_STYLES = {
  healthy: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  low: "bg-amber-50 text-amber-700 ring-amber-200",
  critical: "bg-orange-50 text-orange-700 ring-orange-200",
  out: "bg-rose-50 text-rose-700 ring-rose-200",
  over: "bg-sky-50 text-sky-700 ring-sky-200",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  inactive: "bg-slate-100 text-slate-600 ring-slate-200",
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  ordered: "bg-sky-50 text-sky-700 ring-sky-200",
  received: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelled: "bg-slate-100 text-slate-500 ring-slate-200",
  safe: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  expiring_soon: "bg-amber-50 text-amber-700 ring-amber-200",
  expired: "bg-rose-50 text-rose-700 ring-rose-200",
  unknown: "bg-slate-100 text-slate-600 ring-slate-200",
  no_stock: "bg-slate-100 text-slate-500 ring-slate-200",
  healthy_stock: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  in: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  out_txn: "bg-rose-50 text-rose-700 ring-rose-200",
  adjustment: "bg-sky-50 text-sky-700 ring-sky-200",
};

const STATUS_DOT = {
  healthy: "bg-emerald-500",
  safe: "bg-emerald-500",
  active: "bg-emerald-500",
  low: "bg-amber-500",
  expiring_soon: "bg-amber-500",
  pending: "bg-amber-500",
  critical: "bg-orange-500",
  ordered: "bg-sky-500",
  out: "bg-rose-500",
  expired: "bg-rose-500",
  cancelled: "bg-slate-400",
  inactive: "bg-slate-400",
};

const STATUS_LABEL = {
  healthy: "Healthy",
  low: "Low",
  critical: "Critical",
  out: "Out of Stock",
  over: "Over Max",
  active: "Active",
  inactive: "Inactive",
  pending: "Pending",
  ordered: "Ordered",
  received: "Received",
  cancelled: "Cancelled",
  safe: "Safe",
  expiring_soon: "Expiring Soon",
  expired: "Expired",
  unknown: "Unknown",
  no_stock: "No Stock",
  in: "Stock In",
  out_txn: "Stock Out",
  adjustment: "Adjustment",
};

export function StatusBadge({ status, dot = true }) {
  return (
    <span
      className={`badge ring-1 ${STATUS_STYLES[status] || "bg-slate-50 text-slate-600 ring-slate-200"}`}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            STATUS_DOT[status] || "bg-slate-400"
          }`}
        />
      )}
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export function AlertTypeBadge({ type }) {
  const map = {
    out_of_stock: { label: "Out of Stock", cls: "bg-rose-600" },
    low_stock: { label: "Critical Shortage", cls: "bg-orange-600" },
    expiring_soon: { label: "Expiring Soon", cls: "bg-amber-500" },
    expired: { label: "Expired", cls: "bg-rose-600" },
    restock: { label: "Restock Recommended", cls: "bg-sky-600" },
    healthy: { label: "Healthy", cls: "bg-emerald-600" },
  };
  const cfg = map[type] || { label: type, cls: "bg-slate-500" };
  return (
    <span className={`badge text-white ${cfg.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
      {cfg.label}
    </span>
  );
}

export function StatCard({ label, value, icon, tone = "medical", sub, onClick, loading }) {
  const tones = {
    medical: "from-medical-700 to-medical-500",
    teal: "from-tealish-600 to-tealish-400",
    green: "from-emerald-600 to-emerald-400",
    amber: "from-amber-500 to-amber-400",
    rose: "from-rose-600 to-rose-400",
    orange: "from-orange-600 to-orange-400",
    slate: "from-slate-600 to-slate-400",
  };
  return (
    <div
      onClick={onClick}
      className={`card group relative overflow-hidden p-5 ${onClick ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-soft" : ""}`}
    >
      <div
        className={`absolute -right-4 -top-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${tones[tone]} text-white opacity-15 transition group-hover:scale-110`}
      >
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-16" />
        ) : (
          <p className="mt-1 text-3xl font-extrabold text-slate-800">{value}</p>
        )}
        {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center">
      <div
        className={`card my-8 w-full ${wide ? "max-w-3xl" : "max-w-lg"} animate-[fadeIn_.15s_ease-out]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-bold text-slate-800">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = "Delete", danger = true, loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-slate-600">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className={danger ? "btn-danger" : "btn-primary"}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? <Spinner size={16} className="text-white" /> : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

let toastListeners = [];
export function toast(message, type = "success") {
  toastListeners.forEach((fn) => fn({ id: Date.now() + Math.random(), message, type }));
}

export function ToastHost() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const listener = (t) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 4200);
    };
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((fn) => fn !== listener);
    };
  }, []);

  const icons = {
    success: (
      <svg className="text-emerald-500" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    ),
    error: (
      <svg className="text-rose-500" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
    ),
    info: (
      <svg className="text-medical-500" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M12 8h.01" />
      </svg>
    ),
  };

  return createPortal(
    <div className="fixed right-4 top-4 z-[60] flex w-80 flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className="animate-[fadeIn_.2s_ease-out] rounded-xl border border-slate-200 bg-white p-3.5 shadow-soft"
        >
          <div className="flex items-start gap-2.5">
            {icons[t.type] || icons.info}
            <p className="text-sm font-medium text-slate-700">{t.message}</p>
          </div>
        </div>
      ))}
    </div>,
    document.body
  );
}

export function Pagination({ page, pageSize, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm">
      <p className="text-slate-500">
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          className="btn-secondary !px-2.5 !py-1.5"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Prev
        </button>
        <span className="px-2 font-semibold text-slate-700">
          {page} / {pages}
        </span>
        <button
          className="btn-secondary !px-2.5 !py-1.5"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search...", className = "" }) {
  return (
    <div className={`relative ${className}`}>
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
        className="input !pl-9"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export function PageTitle({ title, subtitle, action }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-extrabold text-slate-800">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function NavLink({ to, icon, children, active }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
        active
          ? "bg-white/10 text-white shadow-sm"
          : "text-medical-100/70 hover:bg-white/5 hover:text-white"
      }`}
    >
      <span className="text-base">{icon}</span>
      {children}
    </Link>
  );
}

export function ProgressBar({ value, max = 100, tone = "medical" }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const colors = {
    medical: "bg-medical-600",
    teal: "bg-tealish-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full ${colors[tone] || colors.medical} transition-all`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Avatar({ name, size = 36 }) {
  const initials = (name || "U")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <div
      className="flex items-center justify-center rounded-full bg-gradient-to-br from-medical-700 to-tealish-500 font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}

export function PillIcon({ children, className = "" }) {
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-medical-50 text-xl text-medical-700 ${className}`}
    >
      {children}
    </div>
  );
}

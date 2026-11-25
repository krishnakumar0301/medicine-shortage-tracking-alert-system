import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { DashboardAPI } from "../services/api";
import {
  Card,
  CardHeader,
  PageLoader,
  StatCard,
  PageTitle,
  AlertTypeBadge,
  ProgressBar,
  EmptyState,
  toast,
} from "../components/ui";

const PIE_COLORS = ["#f43f5e", "#f59e0b", "#10b981", "#3b98f6", "#94a3b8"];

const PRIORITY_TONE = {
  critical: { label: "Critical", cls: "bg-rose-600" },
  high: { label: "High", cls: "bg-orange-600" },
  medium: { label: "Medium", cls: "bg-amber-500" },
  low: { label: "Low", cls: "bg-emerald-600" },
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    DashboardAPI.get()
      .then((res) => setData(res.data))
      .catch(() => toast("Failed to load dashboard", "error"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader label="Loading dashboard..." />;
  if (!data) return <EmptyState title="Unable to load dashboard" />;

  const statMap = {};
  data.stats.forEach((s) => (statMap[s.key] = s));

  const healthTone =
    data.health_score >= 80 ? "emerald" : data.health_score >= 60 ? "teal" : data.health_score >= 40 ? "amber" : "rose";

  return (
    <div>
      <PageTitle
        title="Inventory Dashboard"
        subtitle="Real-time overview of stock health, shortages and expiry risks"
        action={
          <Link to="/medicines/add" className="btn-primary">
            <span>＋</span> Add Medicine
          </Link>
        }
      />

      {/* Health banner */}
      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <div className="card flex items-center gap-4 p-5 lg:col-span-1">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <svg width="80" height="80" viewBox="0 0 36 36" className="-rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-slate-100" strokeWidth="3.5" />
              <circle
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                stroke={healthTone === "emerald" ? "#10b981" : healthTone === "amber" ? "#f59e0b" : healthTone === "rose" ? "#f43f5e" : "#14b8a6"}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={`${(data.health_score / 100) * 100} 100`}
              />
            </svg>
            <div className="absolute text-center">
              <p className="text-xl font-extrabold text-slate-800">{data.health_score}%</p>
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Inventory Health</p>
            <p className={`text-sm font-bold ${healthTone === "emerald" ? "text-emerald-600" : healthTone === "amber" ? "text-amber-600" : healthTone === "rose" ? "text-rose-600" : "text-tealish-500"}`}>
              {data.health_label}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Based on stock availability, expiry risk, demand and restock status.
            </p>
          </div>
        </div>

        <div className="card flex items-center gap-3 p-5 lg:col-span-2">
          <span className="text-2xl">📌</span>
          <div>
            <p className="text-sm font-bold text-slate-800">Stock levels reflect live batch data</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Every restock and issue automatically creates an auditable transaction. Shortage and expiry
              alerts update in real time whenever stock changes.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-7">
        <StatCard label="Total Medicines" value={statMap.total_medicines?.value ?? 0} icon="💊" tone="medical" sub={statMap.total_medicines?.sub} />
        <StatCard label="Available Stock" value={statMap.total_stock?.value ?? 0} icon="🗃️" tone="teal" sub={statMap.total_stock?.sub} />
        <StatCard label="Low Stock" value={statMap.low_stock?.value ?? 0} icon="🟠" tone="amber" sub={statMap.low_stock?.sub} onClick={() => navigate("/medicines?stock_status=critical")} />
        <StatCard label="Out of Stock" value={statMap.out_stock?.value ?? 0} icon="⛔" tone="rose" sub={statMap.out_stock?.sub} onClick={() => navigate("/medicines?stock_status=out")} />
        <StatCard label="Expiring Soon" value={statMap.expiring?.value ?? 0} icon="⏳" tone="orange" sub={statMap.expiring?.sub} onClick={() => navigate("/expiry?status=expiring_soon")} />
        <StatCard label="Expired" value={statMap.expired?.value ?? 0} icon="⚠️" tone="rose" sub={statMap.expired?.sub} onClick={() => navigate("/expiry?status=expired")} />
        <StatCard label="Restock Needed" value={statMap.restock?.value ?? 0} icon="📦" tone="slate" sub={statMap.restock?.sub} onClick={() => navigate("/prediction")} />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        {/* Alerts */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Active Alerts"
            subtitle="Shortages, expiries and restock recommendations"
            action={<Link to="/alerts" className="text-xs font-bold text-medical-600 hover:text-medical-700">View all →</Link>}
          />
          <div className="max-h-72 space-y-2 overflow-y-auto p-4">
            {data.alerts.length === 0 && (
              <EmptyState icon="✅" title="All clear" message="No active alerts. Stock is healthy." />
            )}
            {data.alerts.map((a, i) => (
              <div
                key={i}
                className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition hover:border-medical-200 hover:bg-medical-50/40"
                onClick={() => a.medicine_id && navigate(`/medicines/${a.medicine_id}`)}
              >
                <div className="flex items-start gap-3">
                  <AlertTypeBadge type={a.type} />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{a.message}</p>
                    {a.medicine_name && (
                      <p className="mt-0.5 text-xs font-semibold text-medical-600">{a.medicine_name}</p>
                    )}
                  </div>
                </div>
                <span className="text-lg">{a.type === "low_stock" || a.type === "out_of_stock" ? "🔴" : a.type === "expiring_soon" ? "🟡" : a.type === "expired" ? "⛔" : "🟠"}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Restock priority */}
        <Card>
          <CardHeader title="Smart Restock Priority" subtitle="Ranked by shortage risk and demand" />
          <div className="max-h-72 space-y-2 overflow-y-auto p-4">
            {data.priorities.length === 0 && <EmptyState icon="📦" title="No priorities" />}
            {data.priorities.map((p) => {
              const tone = PRIORITY_TONE[p.priority] || PRIORITY_TONE.low;
              return (
                <div
                  key={p.medicine_id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:bg-slate-50"
                  onClick={() => navigate(`/medicines/${p.medicine_id}`)}
                >
                  <span className={`badge text-white ${tone.cls}`}>{tone.label}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-700">{p.medicine_name}</p>
                    <p className="text-xs text-slate-400">
                      Stock {p.current_stock} · Reorder {p.recommended_reorder}
                    </p>
                  </div>
                  <span className="text-xs font-extrabold text-slate-300">{p.priority_score}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Stock by Category" subtitle="Units on shelf per medicine category" />
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.stock_by_category} dataKey="stock" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name}`}>
                  {data.stock_by_category.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Stock In vs Stock Out" subtitle="Monthly movement over the last 6 months" />
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.stock_in_out}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="stock_in" name="Stock In" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="stock_out" name="Stock Out" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Monthly Medicine Usage" subtitle="Units consumed per month" />
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthly_usage}>
                <defs>
                  <linearGradient id="usageGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b98f6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3b98f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="usage" name="Usage" stroke="#3b98f6" strokeWidth={2} fill="url(#usageGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Expiry Distribution" subtitle="Medicines by remaining shelf life" />
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.expiry_distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Medicines" radius={[4, 4, 0, 0]}>
                  {data.expiry_distribution.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "#f43f5e" : i <= 2 ? "#f59e0b" : "#3b98f6"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader title="Inventory Timeline" subtitle="Recent stock activity across the pharmacy" />
        <div className="p-5">
          <div className="relative space-y-0 pl-6">
            <div className="absolute bottom-2 left-2.5 top-2 w-px bg-slate-200" />
            {data.timeline.map((t, i) => (
              <div key={i} className="relative pb-4 last:pb-0">
                <span
                  className={`absolute -left-[19px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white ${
                    t.type === "in" ? "bg-emerald-500" : t.type === "out" ? "bg-rose-500" : t.type === "alert" ? "bg-amber-500" : "bg-medical-500"
                  }`}
                />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <p className="text-sm font-medium text-slate-700">{t.text}</p>
                  {t.medicine_name && (
                    <button
                      className="text-xs font-bold text-medical-600 hover:underline"
                      onClick={() => t.medicine_id && navigate(`/medicines/${t.medicine_id}`)}
                    >
                      {t.medicine_name}
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  {new Date(t.date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertAPI } from "../services/api";
import {
  AlertTypeBadge,
  Card,
  EmptyState,
  PageLoader,
  PageTitle,
  toast,
} from "../components/ui";

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    Promise.all([AlertAPI.list("active"), AlertAPI.summary()])
      .then(([a, s]) => {
        setAlerts(a.data);
        setSummary(s.data);
      })
      .catch(() => toast("Failed to load alerts", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const resolve = async (id) => {
    await AlertAPI.resolve(id);
    toast("Alert resolved");
    load();
  };

  const resolveAll = async () => {
    await AlertAPI.resolveAll();
    toast("All alerts resolved");
    load();
  };

  const total = summary.total || 0;
  const filterCards = [
    { key: "out_of_stock", label: "Out of Stock", count: summary.out_of_stock || 0, icon: "⛔", cls: "from-rose-600 to-rose-400" },
    { key: "low_stock", label: "Critical Shortage", count: summary.low_stock || 0, icon: "🔴", cls: "from-orange-600 to-orange-400" },
    { key: "expiring_soon", label: "Expiring Soon", count: summary.expiring_soon || 0, icon: "🟡", cls: "from-amber-500 to-amber-400" },
    { key: "expired", label: "Expired", count: summary.expired || 0, icon: "⚠️", cls: "from-rose-600 to-rose-500" },
  ];

  const [filter, setFilter] = useState("");

  return (
    <div>
      <PageTitle
        title="Shortage Alerts"
        subtitle="Automatic alerts generated from stock levels and expiry dates"
        action={
          total > 0 ? (
            <button className="btn-secondary" onClick={resolveAll}>Mark all resolved</button>
          ) : undefined
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <button
          onClick={() => setFilter("")}
          className={`card relative overflow-hidden p-5 text-left transition ${!filter ? "ring-2 ring-medical-400" : "hover:shadow-soft"}`}
        >
          <div className="absolute -right-3 -top-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-medical-700 to-medical-500 text-white opacity-15 text-xl">🚨</div>
          <p className="text-xs font-semibold uppercase text-slate-500">Total Active</p>
          <p className="mt-1 text-3xl font-extrabold text-slate-800">{total}</p>
        </button>
        {filterCards.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(filter === c.key ? "" : c.key)}
            className={`card relative overflow-hidden p-5 text-left transition ${filter === c.key ? "ring-2 ring-medical-400" : "hover:shadow-soft"}`}
          >
            <div className={`absolute -right-3 -top-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${c.cls} text-white opacity-15 text-xl`}>{c.icon}</div>
            <p className="text-xs font-semibold uppercase text-slate-500">{c.label}</p>
            <p className="mt-1 text-3xl font-extrabold text-slate-800">{c.count}</p>
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <PageLoader label="Loading alerts..." />
        ) : (filter ? alerts.filter((a) => a.alert_type === filter) : alerts).length === 0 ? (
          <EmptyState
            icon="✅"
            title="No active alerts"
            message="All medicines are above minimum stock and no expiries are due."
          />
        ) : (
          <div className="divide-y divide-slate-50">
            {(filter ? alerts.filter((a) => a.alert_type === filter) : alerts).map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 p-4 transition hover:bg-slate-50/60">
                <div className="flex items-start gap-3">
                  <span className="mt-1 text-lg">
                    {a.alert_type === "out_of_stock" ? "🔴" : a.alert_type === "low_stock" ? "🔴" : a.alert_type === "expiring_soon" ? "🟡" : a.alert_type === "expired" ? "⚠️" : "🟠"}
                  </span>
                  <div>
                    <div className="mb-1"><AlertTypeBadge type={a.alert_type} /></div>
                    <p className="text-sm font-medium text-slate-700">{a.message}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{new Date(a.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button className="btn-success !px-3 !py-1.5 text-xs" onClick={() => navigate(`/medicines/${a.medicine_id}?restock=1`)}>
                    Reload Stock
                  </button>
                  <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => navigate(`/medicines/${a.medicine_id}`)}>
                    View
                  </button>
                  <button className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => resolve(a.id)} title="Resolve">
                    ✓
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ExpiryAPI } from "../services/api";
import {
  Card,
  EmptyState,
  PageLoader,
  PageTitle,
  Pagination,
  StatusBadge,
  toast,
} from "../components/ui";

export default function Expiry() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const status = params.get("status") || "";
  const medicineId = params.get("medicine") || "";
  const page = parseInt(params.get("page") || "1", 10);

  const load = useCallback(() => {
    setLoading(true);
    ExpiryAPI.monitor({ status: status || undefined, medicine_id: medicineId || undefined, page, page_size: 15 })
      .then((res) => setData(res.data))
      .catch(() => toast("Failed to load expiry data", "error"))
      .finally(() => setLoading(false));
  }, [status, medicineId, page]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next);
  };

  const statCards = [
    { label: "Expired", value: data?.stats?.expired ?? 0, icon: "⚠️", cls: "from-rose-600 to-rose-400", filter: "expired" },
    { label: "Expiring Soon", value: data?.stats?.expiring_soon ?? 0, icon: "⏳", cls: "from-amber-500 to-amber-400", filter: "expiring_soon" },
    { label: "Safe", value: data?.stats?.safe ?? 0, icon: "✅", cls: "from-emerald-600 to-emerald-400", filter: "safe" },
  ];

  return (
    <div>
      <PageTitle
        title="Expiry Monitor"
        subtitle={`Medicines grouped by remaining shelf life (warning window: ${data?.warning_days ?? 30} days)`}
        action={<Link to="/settings" className="btn-secondary">Configure warning window</Link>}
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statCards.map((c) => (
          <button
            key={c.label}
            onClick={() => setFilter("status", status === c.filter ? "" : c.filter)}
            className={`card relative overflow-hidden p-5 text-left transition ${status === c.filter ? "ring-2 ring-medical-400" : "hover:shadow-soft"}`}
          >
            <div className={`absolute -right-3 -top-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${c.cls} text-white opacity-15 text-xl`}>{c.icon}</div>
            <p className="text-xs font-semibold uppercase text-slate-500">{c.label}</p>
            <p className="mt-1 text-3xl font-extrabold text-slate-800">{c.value}</p>
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <PageLoader label="Checking expiry dates..." />
        ) : data && data.items.length === 0 ? (
          <EmptyState
            icon="⏳"
            title="No batches in this category"
            message="Nothing matches the selected expiry status."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="border-b border-slate-100 bg-slate-50/60">
                <tr>
                  <th className="th">Medicine</th>
                  <th className="th">Batch</th>
                  <th className="th">Quantity</th>
                  <th className="th">Expiry Date</th>
                  <th className="th">Days Remaining</th>
                  <th className="th">Status</th>
                  <th className="th">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.items.map((r) => (
                  <tr key={r.batch_id} className="transition hover:bg-slate-50/50">
                    <td className="td">
                      <Link to={`/medicines/${r.medicine_id}`} className="font-bold text-slate-800 hover:text-medical-700">{r.medicine_name}</Link>
                      <p className="text-xs text-slate-400">{r.medicine_code}</p>
                    </td>
                    <td className="td text-xs font-semibold">{r.batch_number}</td>
                    <td className="td">{r.quantity} {r.unit}</td>
                    <td className="td text-xs">{r.expiry_date || "—"}</td>
                    <td className="td">
                      {r.status === "expired" ? (
                        <span className="text-xs font-bold text-rose-600">Expired {Math.abs(r.days_remaining)}d ago</span>
                      ) : r.status === "expiring_soon" ? (
                        <span className="text-xs font-bold text-amber-600">Expires in {r.days_remaining} days</span>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-600">Expires in {r.days_remaining} days</span>
                      )}
                    </td>
                    <td className="td"><StatusBadge status={r.status} /></td>
                    <td className="td">
                      {r.status === "expired" ? (
                        <span className="badge bg-slate-100 text-slate-500">Not issuable</span>
                      ) : r.status === "expiring_soon" ? (
                        <Link to={`/medicines/${r.medicine_id}?restock=1`} className="btn-success !px-3 !py-1 text-xs">Use / Restock</Link>
                      ) : (
                        <Link to={`/issue?medicine=${r.medicine_id}`} className="btn-secondary !px-3 !py-1 text-xs">Issue</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={15} total={data?.total || 0} onChange={(p) => setFilter("page", String(p))} />
      </Card>
    </div>
  );
}

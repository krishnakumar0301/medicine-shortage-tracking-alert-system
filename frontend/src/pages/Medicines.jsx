import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MedicineAPI } from "../services/api";
import {
  Card,
  EmptyState,
  PageLoader,
  PageTitle,
  Pagination,
  SearchInput,
  Spinner,
  StatusBadge,
  toast,
} from "../components/ui";

export function daysLabel(days) {
  if (days === null || days === undefined) return "—";
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Expires today";
  return `${days}d left`;
}

export default function Medicines() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const q = params.get("q") || "";
  const category = params.get("category") || "";
  const stockStatus = params.get("stock_status") || "";
  const expiry = params.get("expiry") || "";
  const sortBy = params.get("sort_by") || "name";
  const page = parseInt(params.get("page") || "1", 10);

  const load = useCallback(() => {
    setLoading(true);
    MedicineAPI.list({
      search: q,
      category,
      stock_status: stockStatus,
      expiry,
      sort_by: sortBy,
      page,
      page_size: 10,
    })
      .then((res) => setData(res.data))
      .catch(() => toast("Failed to load medicines", "error"))
      .finally(() => setLoading(false));
  }, [q, category, stockStatus, expiry, sortBy, page]);

  useEffect(() => {
    load();
  }, [load]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next);
  };

  const refresh = () => load();

  return (
    <div>
      <PageTitle
        title="Medicines"
        subtitle={`${data?.total ?? 0} medicines in the catalog`}
        action={
          <Link to="/medicines/add" className="btn-primary">
            <span>＋</span> Add Medicine
          </Link>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[220px] flex-1">
            <label className="label">Search</label>
            <SearchInput
              value={q}
              onChange={(v) => setParam("q", v)}
              placeholder="Name, generic, code, brand..."
            />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={category} onChange={(e) => setParam("category", e.target.value)}>
              <option value="">All categories</option>
              {(data?.categories || []).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Stock Status</label>
            <select className="input" value={stockStatus} onChange={(e) => setParam("stock_status", e.target.value)}>
              <option value="">All</option>
              <option value="healthy">Healthy</option>
              <option value="low">Low</option>
              <option value="critical">Critical</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>
          <div>
            <label className="label">Expiry</label>
            <select className="input" value={expiry} onChange={(e) => setParam("expiry", e.target.value)}>
              <option value="">All</option>
              <option value="safe">Safe</option>
              <option value="expiring_soon">Expiring Soon</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          <div>
            <label className="label">Sort</label>
            <select className="input" value={sortBy} onChange={(e) => setParam("sort_by", e.target.value)}>
              <option value="name">Name (A-Z)</option>
              <option value="code">Code</option>
              <option value="category">Category</option>
              <option value="stock">Stock status</option>
              <option value="stock_level">Stock level</option>
              <option value="expiry">Expiry</option>
            </select>
          </div>
        </div>
      </Card>

      {loading ? (
        <PageLoader label="Loading medicines..." />
      ) : data && data.items.length === 0 ? (
        <Card>
          <EmptyState
            icon="💊"
            title="No medicines found"
            message="Try adjusting your filters or add a new medicine."
            action={<Link to="/medicines/add" className="btn-primary">Add Medicine</Link>}
          />
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead className="border-b border-slate-100 bg-slate-50/60">
                <tr>
                  <th className="th">Medicine</th>
                  <th className="th">Category</th>
                  <th className="th">Stock</th>
                  <th className="th">Status</th>
                  <th className="th">Expiry</th>
                  <th className="th">Monthly Use</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.items.map((m) => (
                  <tr key={m.id} className="cursor-pointer transition hover:bg-medical-50/30" onClick={() => navigate(`/medicines/${m.id}`)}>
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-medical-50 text-lg">
                          💊
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{m.name}</p>
                          <p className="text-xs text-slate-400">
                            {m.medicine_code} · {m.generic_name || "—"} · {m.strength || ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="td">
                      <span className="badge bg-medical-50 text-medical-700">{m.category}</span>
                    </td>
                    <td className="td">
                      <span className="font-extrabold text-slate-800">{m.current_stock}</span>
                      <span className="text-xs text-slate-400"> {m.unit}</span>
                    </td>
                    <td className="td">
                      <StatusBadge status={m.stock_status} />
                    </td>
                    <td className="td">
                      {m.alert_count > 0 && m.expiry_status === "expired" ? (
                        <span className="text-xs font-bold text-rose-600">{daysLabel(m.days_to_expiry)}</span>
                      ) : m.expiry_status === "expiring_soon" ? (
                        <span className="text-xs font-bold text-amber-600">{daysLabel(m.days_to_expiry)}</span>
                      ) : m.expiry_status === "safe" ? (
                        <span className="text-xs font-semibold text-emerald-600">{daysLabel(m.days_to_expiry)}</span>
                      ) : (
                        <span className="text-xs text-slate-400">{daysLabel(m.days_to_expiry)}</span>
                      )}
                    </td>
                    <td className="td text-xs font-semibold text-slate-600">{m.avg_monthly_usage}</td>
                    <td className="td" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <button
                          className="rounded-lg p-1.5 text-medical-600 transition hover:bg-medical-50"
                          title="View"
                          onClick={() => navigate(`/medicines/${m.id}`)}
                        >
                          <EyeIcon />
                        </button>
                        <Link to={`/medicines/${m.id}/edit`} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100" title="Edit">
                          <EditIcon />
                        </Link>
                        <button
                          className="rounded-lg p-1.5 text-sky-600 transition hover:bg-sky-50"
                          title="Reload Stock"
                          onClick={() => navigate(`/medicines/${m.id}?restock=1`)}
                        >
                          <PlusIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={10} total={data?.total || 0} onChange={(p) => setParam("page", String(p))} />
        </Card>
      )}
    </div>
  );
}

export function EyeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
export function EditIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}
export function PlusIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
export function TrashIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}

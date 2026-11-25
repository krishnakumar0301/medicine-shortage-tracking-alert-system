import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MedicineAPI, StockAPI } from "../services/api";
import { Card, PageLoader, PageTitle, Pagination, StatusBadge } from "../components/ui";

export default function StockHistory() {
  const [medicines, setMedicines] = useState([]);
  const [data, setData] = useState({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ type: "", medicine_id: "", start: "", end: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    MedicineAPI.options().then((res) => setMedicines(res.data)).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    StockAPI.history({
      transaction_type: filters.type || undefined,
      medicine_id: filters.medicine_id || undefined,
      start: filters.start || undefined,
      end: filters.end || undefined,
      page,
      page_size: 20,
    })
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = (k, v) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  return (
    <div>
      <PageTitle
        title="Stock History"
        subtitle="Complete auditable record of all inventory movements"
        action={<Link to="/stock" className="btn-secondary">← Back to Stock</Link>}
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="label">Medicine</label>
            <select className="input" value={filters.medicine_id} onChange={(e) => setFilter("medicine_id", e.target.value)}>
              <option value="">All</option>
              {medicines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={filters.type} onChange={(e) => setFilter("type", e.target.value)}>
              <option value="">All</option>
              <option value="in">Stock In</option>
              <option value="out">Stock Out</option>
              <option value="adjustment">Adjustment</option>
            </select>
          </div>
          <div>
            <label className="label">From</label>
            <input type="date" className="input" value={filters.start} onChange={(e) => setFilter("start", e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={filters.end} onChange={(e) => setFilter("end", e.target.value)} />
          </div>
        </div>
      </Card>

      <Card>
        {loading ? (
          <PageLoader label="Loading history..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead className="border-b border-slate-100 bg-slate-50/60">
                <tr>
                  <th className="th">Date & Time</th>
                  <th className="th">Medicine</th>
                  <th className="th">Batch</th>
                  <th className="th">Type</th>
                  <th className="th">Qty</th>
                  <th className="th">Stock Before → After</th>
                  <th className="th">Reference</th>
                  <th className="th">Recipient / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.items.length === 0 && (
                  <tr><td colSpan="8" className="td py-12 text-center text-slate-400">No transactions match your filters.</td></tr>
                )}
                {data.items.map((t) => (
                  <tr key={t.id} className="transition hover:bg-slate-50/50">
                    <td className="td text-xs whitespace-nowrap">{new Date(t.transaction_date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td className="td font-semibold">{t.medicine_name}</td>
                    <td className="td text-xs">{t.batch_number || "—"}</td>
                    <td className="td"><StatusBadge status={t.transaction_type === "in" ? "in" : t.transaction_type === "out" ? "out_txn" : "adjustment"} /></td>
                    <td className="td font-bold">{t.quantity}</td>
                    <td className="td text-xs">{t.previous_stock} → <span className="font-bold">{t.new_stock}</span></td>
                    <td className="td text-xs text-slate-400">{t.reference_number || "—"}</td>
                    <td className="td text-xs text-slate-400">{t.recipient || t.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={20} total={data.total} onChange={setPage} />
      </Card>
    </div>
  );
}

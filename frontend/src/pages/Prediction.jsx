import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { PredictionAPI, RestockAPI, errorMessage } from "../services/api";
import {
  Card,
  CardHeader,
  EmptyState,
  Modal,
  PageLoader,
  PageTitle,
  SearchInput,
  Spinner,
  StatusBadge,
  toast,
} from "../components/ui";

export default function Prediction() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState("");
  const [restockMed, setRestockMed] = useState(null);
  const [restockQty, setRestockQty] = useState("");
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    PredictionAPI.all()
      .then((res) => setItems(res.data))
      .catch(() => toast("Failed to load predictions", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const mid = params.get("medicine");
    if (mid) {
      PredictionAPI.forMedicine(mid).then((res) => setSelected(res.data)).catch(() => {});
    }
  }, [params]);

  const filtered = items.filter(
    (p) => p.medicine_name.toLowerCase().includes(q.toLowerCase()) || String(p.medicine_id) === q
  );

  const createRestock = async () => {
    if (!restockQty || Number(restockQty) <= 0) {
      toast("Enter a valid quantity", "error");
      return;
    }
    setCreating(true);
    try {
      await RestockAPI.create({
        medicine_id: restockMed.medicine_id,
        quantity: Number(restockQty),
        reason: "Recommended reorder quantity",
      });
      toast("Restock request created.");
      setRestockMed(null);
      setRestockQty("");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setCreating(false);
    }
  };

  const stockTone = (status) => (status === "healthy" ? "emerald" : status === "low" ? "amber" : status === "critical" ? "orange" : "rose");

  return (
    <div>
      <PageTitle
        title="Demand Prediction"
        subtitle="Historical usage based forecasts with reorder recommendations"
        action={
          <button className="btn-secondary" onClick={load}>↻ Refresh</button>
        }
      />

      <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-700">
        ℹ️ Predictions are estimates for planning purposes only and are <strong>not medical advice</strong>. They use
        simple time-series regression over the last 120 days of usage combined with safety stock and lead time.
      </div>

      {loading ? (
        <PageLoader label="Computing demand forecasts..." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader title="Reorder Priority" subtitle="Sorted by recommended reorder quantity" />
            <div className="p-4">
              <SearchInput value={q} onChange={setQ} placeholder="Filter by medicine..." className="mb-3" />
              <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                {filtered.length === 0 && <EmptyState icon="📈" title="No predictions" />}
                {filtered.map((p) => (
                  <div
                    key={p.medicine_id}
                    className={`cursor-pointer rounded-xl border p-3 transition hover:border-medical-300 ${
                      selected?.medicine_id === p.medicine_id ? "border-medical-400 bg-medical-50/50" : "border-slate-100"
                    }`}
                    onClick={() => setSelected(p)}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-800">{p.medicine_name}</p>
                      <StatusBadge status={p.current_stock <= 0 ? "out" : p.current_stock <= p.reorder_point ? "critical" : "healthy"} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Stock <span className="font-bold">{p.current_stock}</span> · Predicted{" "}
                      <span className="font-bold text-medical-600">{Math.round(p.predicted_next_month)}</span>/mo
                    </p>
                    {p.recommended_reorder_qty > 0 && (
                      <p className="mt-1 inline-block rounded-lg bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-600">
                        Reorder: {Math.ceil(p.recommended_reorder_qty)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <div className="lg:col-span-2">
            {selected ? (
              <>
                <Card className="mb-5">
                  <CardHeader
                    title={selected.medicine_name}
                    subtitle="Demand forecast — next 30 days"
                    action={<button className="btn-ghost !py-1.5 text-xs" onClick={() => setSelected(null)}>Close</button>}
                  />
                  <div className="h-64 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={selected.forecast}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="predicted" name="Predicted daily usage" stroke="#3b98f6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Analysis" subtitle="Estimate only — not medical advice" />
                  <div className="grid gap-4 p-5 sm:grid-cols-3">
                    {[
                      { label: "Current Stock", value: `${selected.current_stock}`, tone: "text-slate-800" },
                      { label: "Avg Daily Usage", value: `${selected.avg_daily_usage}`, tone: "text-slate-800" },
                      { label: "Avg Monthly Usage", value: `${selected.avg_monthly_usage}`, tone: "text-slate-800" },
                      { label: "Predicted Next Month", value: `${Math.round(selected.predicted_next_month)}`, tone: "text-medical-600" },
                      { label: "Safety Stock", value: `${Math.ceil(selected.safety_stock)}`, tone: "text-slate-800" },
                      { label: "Reorder Point", value: `${Math.ceil(selected.reorder_point)}`, tone: "text-amber-600" },
                    ].map((c) => (
                      <div key={c.label} className="rounded-xl bg-slate-50 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{c.label}</p>
                        <p className={`mt-1 text-2xl font-extrabold ${c.tone}`}>{c.value}</p>
                      </div>
                    ))}
                    <div className="rounded-xl border-2 border-orange-200 bg-orange-50 p-4 sm:col-span-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-500">Recommended Reorder Quantity</p>
                      <p className="mt-1 text-3xl font-extrabold text-orange-600">
                        {Math.max(0, Math.ceil(selected.recommended_reorder_qty))} units
                      </p>
                      <p className="mt-1 text-xs text-orange-500/80">
                        Predicted demand + safety stock − current stock. Days of supply remaining:{" "}
                        {selected.avg_daily_usage > 0 ? Math.round(selected.current_stock / selected.avg_daily_usage) : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end border-t border-slate-100 px-5 py-4">
                    <button
                      className="btn-primary"
                      onClick={() => {
                        setRestockMed(selected);
                        setRestockQty(Math.max(0, Math.ceil(selected.recommended_reorder_qty)));
                      }}
                    >
                      Create Restock Request
                    </button>
                  </div>
                </Card>
              </>
            ) : (
              <Card>
                <EmptyState
                  icon="📈"
                  title="Select a medicine"
                  message="Choose a medicine from the list to see its demand forecast, safety stock and reorder recommendation."
                />
              </Card>
            )}
          </div>
        </div>
      )}

      <Modal open={!!restockMed} onClose={() => setRestockMed(null)} title={`Create Restock Request — ${restockMed?.medicine_name}`}>
        {restockMed && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-center text-sm">
              <div>
                <p className="text-[11px] text-slate-400">Current stock</p>
                <p className="text-lg font-extrabold text-slate-800">{restockMed.current_stock}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Recommended</p>
                <p className="text-lg font-extrabold text-orange-600">{Math.ceil(restockMed.recommended_reorder_qty)}</p>
              </div>
            </div>
            <div>
              <label className="label">Reorder quantity *</label>
              <input type="number" min="1" className="input" value={restockQty} onChange={(e) => setRestockQty(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setRestockMed(null)}>Cancel</button>
              <button className="btn-primary" onClick={createRestock} disabled={creating}>
                {creating ? <Spinner size={16} className="text-white" /> : "Submit Request"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MedicineAPI, SettingsAPI, StockAPI, errorMessage } from "../services/api";
import {
  Card,
  EmptyState,
  Modal,
  PageLoader,
  PageTitle,
  Pagination,
  SearchInput,
  Spinner,
  StatusBadge,
  toast,
} from "../components/ui";

const TABS = [
  { id: "in", label: "Stock In" },
  { id: "out", label: "Stock Out" },
  { id: "adjust", label: "Adjustment" },
  { id: "history", label: "Stock History" },
];

export default function Stock() {
  const [tab, setTab] = useState("in");
  const [medicines, setMedicines] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState("");
  const [form, setForm] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [history, setHistory] = useState({ items: [], total: 0 });
  const [histFilters, setHistFilters] = useState({ type: "", medicine_id: "" });

  const loadMeta = useCallback(() => {
    Promise.all([MedicineAPI.options(), SettingsAPI.meta()])
      .then(([med, meta]) => {
        setMedicines(med.data);
        setSuppliers(meta.data.suppliers);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const loadHistory = useCallback((page = 1) => {
    StockAPI.history({ transaction_type: histFilters.type || undefined, medicine_id: histFilters.medicine_id || undefined, page, page_size: 12 })
      .then((res) => setHistory({ items: res.data.items, total: res.data.total }))
      .catch(() => {});
  }, [histFilters]);

  useEffect(() => {
    if (tab === "history") {
      setLoading(true);
      loadHistory();
      setLoading(false);
    }
  }, [tab, loadHistory]);

  useEffect(() => {
    StockAPI.outBatches()
      .then((res) => setBatches(res.data))
      .catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!selected) {
      toast("Select a medicine first", "error");
      return;
    }
    const qty = Number(form.quantity);
    if (!qty || qty <= 0) {
      toast("Enter a valid quantity", "error");
      return;
    }
    setSubmitting(true);
    try {
      if (tab === "in") {
        if (!form.batch_number?.trim()) throw new Error("Batch number is required");
        await StockAPI.in(selected, {
          quantity: qty,
          batch_number: form.batch_number,
          manufacturing_date: form.manufacturing_date || null,
          expiry_date: form.expiry_date || null,
          purchase_price: form.purchase_price === "" ? null : Number(form.purchase_price),
          supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
          notes: form.notes || null,
        });
        toast("Stock-in recorded successfully.");
      } else if (tab === "out") {
        await StockAPI.out(selected, {
          quantity: qty,
          batch_id: form.batch_id ? Number(form.batch_id) : null,
          reference_number: form.reference_number || null,
          recipient: form.recipient || null,
          notes: form.notes || null,
        });
        toast("Stock issued successfully.");
      } else {
        await StockAPI.adjust(selected, {
          quantity: qty,
          adjustment_type: form.adjustment_type || "in",
          batch_id: form.batch_id ? Number(form.batch_id) : null,
          reason: form.reason || null,
        });
        toast("Stock adjustment recorded.");
      }
      setForm({});
      loadMeta();
      StockAPI.outBatches().then((res) => setBatches(res.data)).catch(() => {});
      if (tab === "history") loadHistory();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const med = medicines.find((x) => String(x.id) === String(selected));
  const medBatches = batches.filter((b) => String(b.medicine_id) === String(selected));

  return (
    <div>
      <PageTitle
        title="Stock Management"
        subtitle="Record stock movements. Every change creates an audited transaction."
        action={
          <Link to="/stock/history" className="btn-secondary">Full History</Link>
        }
      />

      <Card className="mb-5 overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-slate-100 bg-slate-50/60">
            <tr>
              <th className="th">Medicine</th>
              <th className="th">Current</th>
              <th className="th">Min / Max</th>
              <th className="th">Status</th>
              <th className="th">Last Restocked</th>
              <th className="th">Last Issued</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {medicines.map((m) => (
              <tr key={m.id} className="transition hover:bg-slate-50/50">
                <td className="td font-bold text-slate-800">{m.name}</td>
                <td className="td">
                  <span className="font-extrabold">{m.current_stock}</span> <span className="text-xs text-slate-400">{m.unit}</span>
                </td>
                <td className="td text-xs"><span className="font-semibold">{m.minimum_stock}</span> / <span className="font-semibold">{m.maximum_stock}</span></td>
                <td className="td"><StatusBadge status={m.stock_status} /></td>
                <td className="td text-xs text-slate-500">—</td>
                <td className="td text-xs text-slate-500">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === t.id
                ? "bg-medical-700 text-white shadow-sm"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "history" ? (
        <Card>
          <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
            <select className="input !w-52" value={histFilters.medicine_id} onChange={(e) => setHistFilters({ ...histFilters, medicine_id: e.target.value })}>
              <option value="">All medicines</option>
              {medicines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select className="input !w-40" value={histFilters.type} onChange={(e) => setHistFilters({ ...histFilters, type: e.target.value })}>
              <option value="">All types</option>
              <option value="in">Stock In</option>
              <option value="out">Stock Out</option>
              <option value="adjustment">Adjustment</option>
            </select>
          </div>
          {loading ? (
            <PageLoader label="Loading history..." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="border-b border-slate-100 bg-slate-50/60">
                  <tr>
                    <th className="th">Date</th>
                    <th className="th">Medicine</th>
                    <th className="th">Batch</th>
                    <th className="th">Type</th>
                    <th className="th">Qty</th>
                    <th className="th">Stock</th>
                    <th className="th">Ref / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {history.items.length === 0 && (
                    <tr><td colSpan="7" className="td py-10 text-center text-slate-400">No transactions found.</td></tr>
                  )}
                  {history.items.map((t) => (
                    <tr key={t.id}>
                      <td className="td text-xs">{new Date(t.transaction_date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</td>
                      <td className="td font-semibold">{t.medicine_name}</td>
                      <td className="td text-xs">{t.batch_number || "—"}</td>
                      <td className="td"><StatusBadge status={t.transaction_type === "in" ? "in" : t.transaction_type === "out" ? "out_txn" : "adjustment"} /></td>
                      <td className="td font-bold">{t.quantity}</td>
                      <td className="td text-xs">{t.previous_stock} → {t.new_stock}</td>
                      <td className="td text-xs text-slate-400">{t.reference_number || t.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={1} pageSize={12} total={history.total} onChange={(p) => loadHistory(p)} />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <h3 className="border-b border-slate-100 px-5 py-4 text-sm font-bold text-slate-800">
              {tab === "in" ? "Stock In (Restock / Receive)" : tab === "out" ? "Issue / Stock Out" : "Stock Adjustment"}
            </h3>
            <form onSubmit={submit} className="space-y-3 p-5">
              <div>
                <label className="label">Medicine *</label>
                <select className="input" value={selected} onChange={(e) => { setSelected(e.target.value); setForm({}); }}>
                  <option value="">Select medicine</option>
                  {medicines.map((m) => <option key={m.id} value={m.id}>{m.name} — stock {m.current_stock}</option>)}
                </select>
              </div>

              {med && tab !== "history" && (
                <div className="rounded-lg bg-medical-50/60 p-2.5 text-xs text-medical-700">
                  Current stock: <strong>{med.current_stock} {med.unit}</strong>
                </div>
              )}

              {tab === "in" && (
                <>
                  <div><label className="label">Quantity to add *</label><input type="number" min="1" required className="input" value={form.quantity || ""} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
                  <div><label className="label">Batch number *</label><input required className="input" value={form.batch_number || ""} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label">Mfg date</label><input type="date" className="input" value={form.manufacturing_date || ""} onChange={(e) => setForm({ ...form, manufacturing_date: e.target.value })} /></div>
                    <div><label className="label">Expiry date</label><input type="date" className="input" value={form.expiry_date || ""} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Supplier</label>
                      <select className="input" value={form.supplier_id || ""} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                        <option value="">—</option>
                        {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div><label className="label">Purchase price</label><input type="number" min="0" step="0.01" className="input" value={form.purchase_price || ""} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} /></div>
                  </div>
                </>
              )}

              {tab === "out" && (
                <>
                  <div><label className="label">Quantity to issue *</label><input type="number" min="1" required className="input" value={form.quantity || ""} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
                  <div>
                    <label className="label">Batch (FEFO order, optional)</label>
                    <select className="input" value={form.batch_id || ""} onChange={(e) => setForm({ ...form, batch_id: e.target.value })}>
                      <option value="">Auto (FEFO)</option>
                      {medBatches.map((b) => <option key={b.batch_id} value={b.batch_id}>{b.batch_number} — {b.quantity} left ({b.days_remaining}d)</option>)}
                    </select>
                    {medBatches.length > 0 && (
                      <p className="mt-1 text-[11px] text-slate-400">💡 FEFO: earliest-expiry batch is issued first automatically.</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label">Reference no.</label><input className="input" value={form.reference_number || ""} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} /></div>
                    <div><label className="label">Recipient</label><input className="input" value={form.recipient || ""} onChange={(e) => setForm({ ...form, recipient: e.target.value })} /></div>
                  </div>
                </>
              )}

              {tab === "adjust" && (
                <>
                  <div>
                    <label className="label">Adjustment type</label>
                    <select className="input" value={form.adjustment_type || "in"} onChange={(e) => setForm({ ...form, adjustment_type: e.target.value })}>
                      <option value="in">Add stock (+)</option>
                      <option value="out">Remove stock (−)</option>
                    </select>
                  </div>
                  <div><label className="label">Quantity *</label><input type="number" min="1" required className="input" value={form.quantity || ""} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
                  <div>
                    <label className="label">Batch (optional)</label>
                    <select className="input" value={form.batch_id || ""} onChange={(e) => setForm({ ...form, batch_id: e.target.value })}>
                      <option value="">All batches</option>
                      {medBatches.map((b) => <option key={b.batch_id} value={b.batch_id}>{b.batch_number} — {b.quantity}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Reason</label><input className="input" value={form.reason || ""} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
                </>
              )}

              <div><label className="label">Notes</label><input className="input" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

              <button type="submit" className="btn-primary w-full" disabled={submitting}>
                {submitting ? <Spinner size={16} className="text-white" /> : tab === "in" ? "Record Stock In" : tab === "out" ? "Issue Stock" : "Apply Adjustment"}
              </button>
            </form>
          </Card>

          <Card className="lg:col-span-2">
            <h3 className="border-b border-slate-100 px-5 py-4 text-sm font-bold text-slate-800">
              {selected && med ? `FEFO Batches — ${med.name}` : "Usable Batches (FEFO)"}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead className="border-b border-slate-100 bg-slate-50/60">
                  <tr>
                    <th className="th">Batch</th>
                    <th className="th">Medicine</th>
                    <th className="th">Qty</th>
                    <th className="th">Expiry</th>
                    <th className="th">Days Left</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(selected ? medBatches : batches).length === 0 && (
                    <tr><td colSpan="5" className="td py-10 text-center"><EmptyState icon="🗃️" title="No usable batches" message="Select a medicine to see its FEFO batch order." /></td></tr>
                  )}
                  {(selected ? medBatches : batches).map((b) => (
                    <tr key={b.batch_id}>
                      <td className="td font-bold">{b.batch_number}</td>
                      <td className="td">{b.medicine_name}</td>
                      <td className="td font-semibold">{b.quantity} {b.unit}</td>
                      <td className="td text-xs">{b.expiry_date || "—"}</td>
                      <td className="td">
                        {b.days_remaining === null ? <span className="text-xs text-slate-400">—</span> : b.days_remaining < 0 ? <span className="text-xs font-bold text-rose-600">Expired</span> : b.days_remaining <= 30 ? <span className="text-xs font-bold text-amber-600">{b.days_remaining}d</span> : <span className="text-xs font-semibold text-emerald-600">{b.days_remaining}d</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

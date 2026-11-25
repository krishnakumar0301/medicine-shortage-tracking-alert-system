import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MedicineAPI, StockAPI, errorMessage } from "../services/api";
import { Card, PageLoader, PageTitle, Spinner, StatusBadge, toast } from "../components/ui";

export default function Issue() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [medicines, setMedicines] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selected, setSelected] = useState(params.get("medicine") || "");
  const [form, setForm] = useState({
    quantity: "",
    batch_id: "",
    reference_number: "",
    recipient: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([MedicineAPI.options(), StockAPI.outBatches()])
      .then(([m, b]) => {
        setMedicines(m.data);
        setBatches(b.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const med = medicines.find((x) => String(x.id) === String(selected));
  const medBatches = useMemo(
    () => batches.filter((b) => String(b.medicine_id) === String(selected)).sort((a, b) => (a.days_remaining ?? 9999) - (b.days_remaining ?? 9999)),
    [batches, selected]
  );

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!selected) {
      toast("Select a medicine", "error");
      return;
    }
    const qty = Number(form.quantity);
    if (!qty || qty <= 0) {
      toast("Enter a valid quantity", "error");
      return;
    }
    setSubmitting(true);
    try {
      await StockAPI.out(selected, {
        quantity: qty,
        batch_id: form.batch_id ? Number(form.batch_id) : null,
        reference_number: form.reference_number || null,
        recipient: form.recipient || null,
        notes: form.notes || null,
      });
      toast("Medicine issued successfully.");
      const res = await MedicineAPI.options();
      setMedicines(res.data);
      const b = await StockAPI.outBatches();
      setBatches(b.data);
      setForm({ quantity: "", batch_id: "", reference_number: "", recipient: "", notes: "" });
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageLoader label="Loading..." />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Issue Medicine (Stock Out)" subtitle="Record medicine issued to wards, patients or departments" />

      <Card>
        <form onSubmit={onSubmit} className="space-y-4 p-5">
          <div>
            <label className="label">Medicine *</label>
            <select className="input" value={selected} onChange={(e) => { setSelected(e.target.value); setForm({ ...form, batch_id: "" }); }}>
              <option value="">Select medicine</option>
              {medicines.filter((m) => m.current_stock > 0).map((m) => (
                <option key={m.id} value={m.id}>{m.name} — {m.current_stock} {m.unit}</option>
              ))}
            </select>
            {med && (
              <div className="mt-2 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <p className="text-sm text-slate-600">
                  Available: <span className="font-extrabold text-slate-800">{med.current_stock} {med.unit}</span>
                </p>
                <StatusBadge status={med.stock_status} />
              </div>
            )}
          </div>

          {selected && (
            <div className="rounded-xl border border-slate-100 bg-medical-50/40 p-3">
              <p className="text-xs font-bold text-medical-700">FEFO recommendation</p>
              {medBatches.length === 0 ? (
                <p className="mt-1 text-xs text-slate-500">No usable (non-expired) batches in stock.</p>
              ) : (
                <p className="mt-1 text-xs text-slate-600">
                  Use <strong>{medBatches[0].batch_number}</strong> first — expires {medBatches[0].expiry_date || "unknown"} ({medBatches[0].days_remaining ?? "?"} days left, {medBatches[0].quantity} units).
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Batch (optional, FEFO default)</label>
              <select className="input" value={form.batch_id} onChange={(e) => setForm({ ...form, batch_id: e.target.value })}>
                <option value="">Auto — earliest expiry first</option>
                {medBatches.map((b) => (
                  <option key={b.batch_id} value={b.batch_id}>{b.batch_number} · {b.quantity} · {b.days_remaining}d left</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Quantity *</label>
              <input type="number" min="1" max={med?.current_stock} required className="input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              <p className="mt-1 text-[11px] text-slate-400">Cannot exceed available stock ({med?.current_stock ?? 0}).</p>
            </div>
            <div>
              <label className="label">Reference number</label>
              <input className="input" placeholder="e.g. ISS-WARD-1200" value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} />
            </div>
            <div>
              <label className="label">Recipient / Patient / Ward</label>
              <input className="input" placeholder="e.g. Ward 3 / Bed 12" value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-400">Expired medicines are never issued automatically.</p>
            <button type="submit" className="btn-danger !px-6" disabled={submitting}>
              {submitting ? <Spinner size={16} className="text-white" /> : "Issue Medicine"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

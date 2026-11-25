import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MedicineAPI, StockAPI, SupplierAPI, errorMessage } from "../services/api";
import {
  Card,
  CardHeader,
  ConfirmDialog,
  Modal,
  PageLoader,
  PageTitle,
  ProgressBar,
  Spinner,
  StatusBadge,
  toast,
} from "../components/ui";
import { EditIcon, TrashIcon, PlusIcon } from "./Medicines";

const EMPTY_RESTOCK = {
  quantity: "",
  batch_number: "",
  manufacturing_date: "",
  expiry_date: "",
  purchase_price: "",
  supplier_id: "",
  notes: "",
};

export default function MedicineDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [m, setM] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restockOpen, setRestockOpen] = useState(!!params.get("restock"));
  const [restockForm, setRestockForm] = useState(EMPTY_RESTOCK);
  const [restocking, setRestocking] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [tab, setTab] = useState("overview");

  const load = useCallback(() => {
    setLoading(true);
    MedicineAPI.get(id)
      .then((res) => setM(res.data))
      .catch(() => toast("Failed to load medicine", "error"))
      .finally(() => setLoading(false));
    MedicineAPI.history(id).then((res) => setHistory(res.data.items)).catch(() => {});
  }, [id]);

  useEffect(() => {
    load();
    SupplierAPI.list().then((res) => setSuppliers(res.data)).catch(() => {});
    if (params.get("restock")) setRestockOpen(true);
  }, [load, params]);

  const onRestock = async (e) => {
    e.preventDefault();
    if (!restockForm.quantity || Number(restockForm.quantity) <= 0) {
      toast("Enter a valid quantity", "error");
      return;
    }
    if (!restockForm.batch_number.trim()) {
      toast("Batch number is required", "error");
      return;
    }
    if (restockForm.expiry_date && restockForm.manufacturing_date && restockForm.expiry_date < restockForm.manufacturing_date) {
      toast("Expiry date must not be earlier than manufacturing date", "error");
      return;
    }
    setRestocking(true);
    try {
      await StockAPI.in(id, {
        quantity: Number(restockForm.quantity),
        batch_number: restockForm.batch_number,
        manufacturing_date: restockForm.manufacturing_date || null,
        expiry_date: restockForm.expiry_date || null,
        purchase_price: restockForm.purchase_price === "" ? null : Number(restockForm.purchase_price),
        supplier_id: restockForm.supplier_id ? Number(restockForm.supplier_id) : null,
        notes: restockForm.notes || null,
      });
      toast("Stock successfully replenished.");
      setRestockOpen(false);
      setRestockForm(EMPTY_RESTOCK);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setRestocking(false);
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    try {
      const res = await MedicineAPI.remove(id);
      toast(res.data.message);
      navigate("/medicines");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <PageLoader label="Loading medicine..." />;
  if (!m) return null;

  const usableBatches = m.batches.filter((b) => b.quantity > 0);
  const minPct = m.maximum_stock > 0 ? (m.minimum_stock / m.maximum_stock) * 100 : 20;
  const stockPct = m.maximum_stock > 0 ? (m.current_stock / m.maximum_stock) * 100 : 100;

  return (
    <div>
      <PageTitle
        title={m.name}
        subtitle={`${m.medicine_code} · ${m.category} · ${m.strength || ""} ${m.dosage_form || ""}`}
        action={
          <div className="flex gap-2">
            <Link to={`/medicines/${m.id}/edit`} className="btn-secondary">
              <EditIcon /> Edit
            </Link>
            <button className="btn-success" onClick={() => setRestockOpen(true)}>
              <PlusIcon /> Reload Stock
            </button>
            <button className="btn-danger" onClick={() => setDeleteOpen(true)}>
              <TrashIcon /> Delete
            </button>
          </div>
        }
      />

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="Stock Overview" subtitle="Live stock position against configured limits" />
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-medical-600 to-tealish-500 text-2xl">
                    💊
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-slate-800">{m.current_stock}</p>
                    <p className="text-xs text-slate-400">{m.unit} available</p>
                  </div>
                </div>
                <StatusBadge status={m.stock_status} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500">
                  <span>Current stock ({stockPct.toFixed(0)}% of max)</span>
                  <span className="text-rose-500">Min: {m.minimum_stock}</span>
                </div>
                <div className="relative">
                  <ProgressBar value={m.current_stock} max={m.maximum_stock} tone={m.stock_status === "healthy" ? "emerald" : m.stock_status === "low" ? "amber" : m.stock_status === "critical" ? "orange" : "rose"} />
                  <div
                    className="absolute bottom-[-4px] top-[-4px] w-0.5 rounded bg-rose-400"
                    style={{ left: `${Math.min(100, minPct)}%` }}
                    title={`Minimum level: ${m.minimum_stock}`}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Red line = minimum stock level ({m.minimum_stock}). Shortage alerts trigger at or below this level.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Batches (FEFO)"
              subtitle="First Expiry, First Out — use the earliest expiry batch first"
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="border-b border-slate-100 bg-slate-50/60">
                  <tr>
                    <th className="th">Batch</th>
                    <th className="th">Quantity</th>
                    <th className="th">Mfg Date</th>
                    <th className="th">Expiry Date</th>
                    <th className="th">Days Left</th>
                    <th className="th">Use Order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {usableBatches.length === 0 && (
                    <tr><td colSpan="6" className="td py-8 text-center text-slate-400">No usable batches with stock.</td></tr>
                  )}
                  {usableBatches
                    .sort((a, b) => (a.expiry_date || "9999-12-31").localeCompare(b.expiry_date || "9999-12-31"))
                    .map((b, idx) => {
                      const days = b.expiry_date ? Math.floor((new Date(b.expiry_date) - new Date()) / 86400000) : null;
                      const isExpired = days !== null && days < 0;
                      return (
                        <tr key={b.id} className="transition hover:bg-slate-50/50">
                          <td className="td font-bold text-slate-800">{b.batch_number}</td>
                          <td className="td">{b.quantity}</td>
                          <td className="td">{b.manufacturing_date || "—"}</td>
                          <td className="td">{b.expiry_date || "—"}</td>
                          <td className="td">
                            {isExpired ? (
                              <span className="text-xs font-bold text-rose-600">Expired</span>
                            ) : days !== null && days <= 30 ? (
                              <span className="text-xs font-bold text-amber-600">{days} days</span>
                            ) : (
                              <span className="text-xs font-semibold text-emerald-600">{days} days</span>
                            )}
                          </td>
                          <td className="td">
                            {idx === 0 ? (
                              <span className="badge bg-medical-50 text-medical-700">Use first ⬆</span>
                            ) : (
                              <span className="badge bg-slate-50 text-slate-500">Later</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="Transaction History" subtitle="Every stock change is recorded and audited" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead className="border-b border-slate-100 bg-slate-50/60">
                  <tr>
                    <th className="th">Date</th>
                    <th className="th">Type</th>
                    <th className="th">Batch</th>
                    <th className="th">Qty</th>
                    <th className="th">New Stock</th>
                    <th className="th">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {history.length === 0 && (
                    <tr><td colSpan="6" className="td py-8 text-center text-slate-400">No transactions yet.</td></tr>
                  )}
                  {history.slice(0, 8).map((t) => (
                    <tr key={t.id}>
                      <td className="td text-xs">{new Date(t.transaction_date).toLocaleDateString()}</td>
                      <td className="td">
                        <StatusBadge status={t.transaction_type === "in" ? "in" : t.transaction_type === "out" ? "out_txn" : "adjustment"} />
                      </td>
                      <td className="td text-xs">{t.batch_number || "—"}</td>
                      <td className="td font-bold">{t.quantity}</td>
                      <td className="td">{t.new_stock}</td>
                      <td className="td text-xs text-slate-400">{t.reference_number || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Side info */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="Details" />
            <dl className="divide-y divide-slate-50 p-4 text-sm">
              {[
                ["Generic Name", m.generic_name || "—"],
                ["Brand Name", m.brand_name || "—"],
                ["Category", m.category],
                ["Dosage Form", m.dosage_form || "—"],
                ["Strength", m.strength || "—"],
                ["Storage Location", m.storage_location || "—"],
                ["Selling Price", m.selling_price != null ? `$${m.selling_price}` : "—"],
                ["Supplier", m.supplier?.name || "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-semibold text-slate-800">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Quick Actions" />
            <div className="space-y-2 p-4">
              <Link to={`/issue?medicine=${m.id}`} className="btn-secondary w-full">
                Issue / Stock Out
              </Link>
              <Link to={`/prediction?medicine=${m.id}`} className="btn-ghost w-full">
                Demand Prediction
              </Link>
              <Link to={`/expiry?medicine=${m.id}`} className="btn-ghost w-full">
                Expiry Status
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* Restock modal */}
      <Modal open={restockOpen} onClose={() => setRestockOpen(false)} title={`Reload Stock — ${m.name}`}>
        <div className="mb-4 grid grid-cols-3 gap-3 rounded-xl bg-medical-50/60 p-3 text-center">
          <div>
            <p className="text-[11px] font-semibold uppercase text-slate-400">Current</p>
            <p className="text-xl font-extrabold text-slate-800">{m.current_stock}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase text-medical-500">Added</p>
            <p className="text-xl font-extrabold text-medical-600">+{restockForm.quantity || 0}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase text-slate-400">New Stock</p>
            <p className="text-xl font-extrabold text-tealish-600">{m.current_stock + (Number(restockForm.quantity) || 0)}</p>
          </div>
        </div>
        <form onSubmit={onRestock} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Quantity to add *</label>
              <input type="number" min="1" required className="input" value={restockForm.quantity} onChange={(e) => setRestockForm({ ...restockForm, quantity: e.target.value })} />
            </div>
            <div>
              <label className="label">Batch number *</label>
              <input required className="input" value={restockForm.batch_number} onChange={(e) => setRestockForm({ ...restockForm, batch_number: e.target.value })} placeholder="e.g. PARA-B119" />
            </div>
            <div>
              <label className="label">Manufacturing date</label>
              <input type="date" className="input" value={restockForm.manufacturing_date} onChange={(e) => setRestockForm({ ...restockForm, manufacturing_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Expiry date</label>
              <input type="date" className="input" value={restockForm.expiry_date} onChange={(e) => setRestockForm({ ...restockForm, expiry_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Supplier</label>
              <select className="input" value={restockForm.supplier_id} onChange={(e) => setRestockForm({ ...restockForm, supplier_id: e.target.value })}>
                <option value="">—</option>
                {suppliers.filter((s) => s.status === "active").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Purchase price</label>
              <input type="number" min="0" step="0.01" className="input" value={restockForm.purchase_price} onChange={(e) => setRestockForm({ ...restockForm, purchase_price: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={restockForm.notes} onChange={(e) => setRestockForm({ ...restockForm, notes: e.target.value })} />
          </div>
          <p className="text-xs text-slate-400">
            A stock-in transaction will be recorded automatically: previous {m.current_stock} → new {m.current_stock + (Number(restockForm.quantity) || 0)}.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={() => setRestockOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={restocking}>
              {restocking ? <Spinner size={16} className="text-white" /> : "Confirm Restock"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={onDelete}
        title="Delete Medicine"
        message={`Are you sure you want to delete "${m.name}"? If it has transaction history it will be deactivated to preserve audit records.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}

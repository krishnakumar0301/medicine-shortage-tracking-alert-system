import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SupplierAPI, errorMessage } from "../services/api";
import {
  Card,
  ConfirmDialog,
  EmptyState,
  Modal,
  PageLoader,
  PageTitle,
  SearchInput,
  Spinner,
  StatusBadge,
  toast,
} from "../components/ui";

const EMPTY = { name: "", contact_person: "", phone: "", email: "", address: "" };

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null); // {mode: 'add'|'edit', data}
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [details, setDetails] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    SupplierAPI.list(q || undefined)
      .then((res) => setSuppliers(res.data))
      .catch(() => toast("Failed to load suppliers", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const openAdd = () => {
    setModal("add");
    setForm(EMPTY);
  };

  const openEdit = (s) => {
    setModal("edit");
    setForm({ name: s.name, contact_person: s.contact_person || "", phone: s.phone || "", email: s.email || "", address: s.address || "" });
    setDeleteTarget(null);
    window.__editingId = s.id;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast("Supplier name is required", "error");
      return;
    }
    setSubmitting(true);
    try {
      if (modal === "add") {
        await SupplierAPI.create(form);
        toast("Supplier added successfully.");
      } else {
        await SupplierAPI.update(window.__editingId, form);
        toast("Supplier updated successfully.");
      }
      setModal(null);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const res = await SupplierAPI.remove(deleteTarget.id);
      toast(res.data.message);
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setDeleting(false);
    }
  };

  const viewDetails = async (s) => {
    try {
      const res = await SupplierAPI.details(s.id);
      setDetails(res.data);
    } catch {
      toast("Failed to load supplier details", "error");
    }
  };

  return (
    <div>
      <PageTitle
        title="Suppliers"
        subtitle="Manage the distributors and wholesalers supplying your pharmacy"
        action={<button className="btn-primary" onClick={openAdd}><span>＋</span> Add Supplier</button>}
      />

      {loading ? (
        <PageLoader label="Loading suppliers..." />
      ) : (
        <Card className="mb-5 overflow-x-auto">
          <div className="border-b border-slate-100 p-4">
            <SearchInput value={q} onChange={setQ} placeholder="Search suppliers..." className="max-w-sm" />
          </div>
          {suppliers.length === 0 ? (
            <EmptyState icon="🏭" title="No suppliers yet" message="Add your first supplier to start tracking orders." action={<button className="btn-primary" onClick={openAdd}>Add Supplier</button>} />
          ) : (
            <table className="w-full min-w-[820px]">
              <thead className="border-b border-slate-100 bg-slate-50/60">
                <tr>
                  <th className="th">Supplier</th>
                  <th className="th">Contact</th>
                  <th className="th">Phone</th>
                  <th className="th">Email</th>
                  <th className="th">Status</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {suppliers.map((s) => (
                  <tr key={s.id} className="transition hover:bg-slate-50/50">
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-medical-50 font-bold text-medical-700">
                          {s.name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{s.name}</p>
                          <p className="text-xs text-slate-400">{s.address || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td">{s.contact_person || "—"}</td>
                    <td className="td text-sm">{s.phone || "—"}</td>
                    <td className="td text-sm">{s.email || "—"}</td>
                    <td className="td"><StatusBadge status={s.status} /></td>
                    <td className="td">
                      <div className="flex gap-1.5">
                        <button className="btn-secondary !px-2.5 !py-1 text-xs" onClick={() => viewDetails(s)}>Details</button>
                        <button className="btn-secondary !px-2.5 !py-1 text-xs" onClick={() => openEdit(s)}>Edit</button>
                        <button className="btn-danger !px-2.5 !py-1 text-xs" onClick={() => setDeleteTarget(s)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "add" ? "Add Supplier" : "Edit Supplier"}>
        <form onSubmit={submit} className="space-y-3">
          <div><label className="label">Supplier name *</label><input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Contact person</label><input className="input" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div><label className="label">Address</label><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? <Spinner size={16} className="text-white" /> : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!details} onClose={() => setDetails(null)} title={details?.supplier?.name} wide>
        {details && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-400">Contact</p><p className="font-semibold text-slate-800">{details.supplier.contact_person || "—"}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-400">Phone</p><p className="font-semibold text-slate-800">{details.supplier.phone || "—"}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-400">Email</p><p className="truncate font-semibold text-slate-800">{details.supplier.email || "—"}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-400">Medicines</p><p className="font-semibold text-slate-800">{details.medicine_count}</p></div>
            </div>

            <div>
              <p className="label">Medicines supplied</p>
              <div className="flex flex-wrap gap-2">
                {details.medicines.length === 0 && <p className="text-sm text-slate-400">None yet.</p>}
                {details.medicines.map((m) => (
                  <Link key={m.id} to={`/medicines/${m.id}`} className="badge bg-medical-50 text-medical-700 hover:bg-medical-100">
                    {m.name} <span className="text-medical-400">({m.current_stock})</span>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <p className="label">Recent order history</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px]">
                  <thead className="border-b border-slate-100 bg-slate-50/60">
                    <tr><th className="th">Date</th><th className="th">Medicine</th><th className="th">Batch</th><th className="th">Qty</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {details.orders.length === 0 && <tr><td colSpan="4" className="td text-center text-slate-400">No orders recorded.</td></tr>}
                    {details.orders.map((o) => (
                      <tr key={o.id}><td className="td text-xs">{new Date(o.transaction_date).toLocaleDateString()}</td><td className="td">{o.medicine_name}</td><td className="td text-xs">{o.batch_number}</td><td className="td font-bold">{o.quantity}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Supplier"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? Suppliers linked to medicines are marked inactive instead.`}
        loading={deleting}
      />
    </div>
  );
}

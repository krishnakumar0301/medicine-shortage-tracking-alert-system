import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MedicineAPI, SettingsAPI, errorMessage } from "../services/api";
import { Card, PageLoader, PageTitle, Spinner, toast } from "../components/ui";

export default function MedicineEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meta, setMeta] = useState({ categories: [], suppliers: [], dosage_forms: [], units: [] });
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    SettingsAPI.meta().then((res) => setMeta(res.data)).catch(() => {});
    MedicineAPI.get(id)
      .then((res) => {
        const m = res.data;
        setForm({
          name: m.name,
          generic_name: m.generic_name || "",
          brand_name: m.brand_name || "",
          category: m.category || "General",
          dosage_form: m.dosage_form || "Tablets",
          strength: m.strength || "",
          unit: m.unit || "tablets",
          minimum_stock: m.minimum_stock,
          maximum_stock: m.maximum_stock,
          storage_location: m.storage_location || "",
          selling_price: m.selling_price ?? "",
          description: m.description || "",
          supplier_id: m.supplier_id ?? "",
        });
      })
      .catch(() => {
        toast("Failed to load medicine", "error");
        navigate("/medicines");
      });
  }, [id, navigate]);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Medicine name is required.";
    if (form.minimum_stock === "" || Number(form.minimum_stock) < 0) e.minimum_stock = "Minimum stock cannot be negative.";
    if (form.maximum_stock === "" || Number(form.maximum_stock) <= 0) e.maximum_stock = "Maximum stock must be greater than zero.";
    if (Number(form.minimum_stock) > Number(form.maximum_stock)) e.maximum_stock = "Maximum stock must be >= minimum.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await MedicineAPI.update(id, {
        name: form.name,
        generic_name: form.generic_name || null,
        brand_name: form.brand_name || null,
        category: form.category,
        dosage_form: form.dosage_form || null,
        strength: form.strength || null,
        unit: form.unit,
        minimum_stock: Number(form.minimum_stock),
        maximum_stock: Number(form.maximum_stock),
        storage_location: form.storage_location || null,
        selling_price: form.selling_price === "" ? null : Number(form.selling_price),
        description: form.description || null,
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
      });
      toast("Medicine updated successfully.");
      navigate(`/medicines/${id}`);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!form) return <PageLoader label="Loading medicine..." />;
  const inputCls = (field) => (errors[field] ? "input !border-rose-400" : "input");
  const fieldErr = (field) => errors[field] && <p className="mt-1 text-xs font-medium text-rose-600">{errors[field]}</p>;

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle title="Edit Medicine" subtitle={form.name} action={<button className="btn-secondary" onClick={() => navigate(`/medicines/${id}`)}>Cancel</button>} />
      <form onSubmit={onSubmit}>
        <Card className="mb-5">
          <h3 className="border-b border-slate-100 px-5 py-4 text-sm font-bold text-slate-800">Medicine Information</h3>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Medicine Name *</label>
              <input className={inputCls("name")} value={form.name} onChange={(e) => set("name", e.target.value)} />
              {fieldErr("name")}
            </div>
            <div><label className="label">Generic Name</label><input className={inputCls("generic_name")} value={form.generic_name} onChange={(e) => set("generic_name", e.target.value)} /></div>
            <div><label className="label">Brand Name</label><input className={inputCls("brand_name")} value={form.brand_name} onChange={(e) => set("brand_name", e.target.value)} /></div>
            <div>
              <label className="label">Category *</label>
              <input className={inputCls("category")} list="categories" value={form.category} onChange={(e) => set("category", e.target.value)} />
              <datalist id="categories">{meta.categories.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <label className="label">Dosage Form</label>
              <select className="input" value={form.dosage_form} onChange={(e) => set("dosage_form", e.target.value)}>
                {meta.dosage_forms.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div><label className="label">Strength</label><input className={inputCls("strength")} value={form.strength} onChange={(e) => set("strength", e.target.value)} /></div>
            <div>
              <label className="label">Unit</label>
              <select className="input" value={form.unit} onChange={(e) => set("unit", e.target.value)}>
                {meta.units.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div><label className="label">Minimum Stock *</label><input type="number" min="0" className={inputCls("minimum_stock")} value={form.minimum_stock} onChange={(e) => set("minimum_stock", e.target.value)} />{fieldErr("minimum_stock")}</div>
            <div><label className="label">Maximum Stock *</label><input type="number" min="0" className={inputCls("maximum_stock")} value={form.maximum_stock} onChange={(e) => set("maximum_stock", e.target.value)} />{fieldErr("maximum_stock")}</div>
            <div><label className="label">Selling Price</label><input type="number" min="0" step="0.01" className={inputCls("selling_price")} value={form.selling_price} onChange={(e) => set("selling_price", e.target.value)} /></div>
            <div><label className="label">Storage Location</label><input className={inputCls("storage_location")} value={form.storage_location} onChange={(e) => set("storage_location", e.target.value)} /></div>
            <div className="sm:col-span-2">
              <label className="label">Supplier</label>
              <select className="input" value={form.supplier_id} onChange={(e) => set("supplier_id", e.target.value)}>
                <option value="">No supplier</option>
                {meta.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea className={inputCls("description")} rows="2" value={form.description} onChange={(e) => set("description", e.target.value)} />
            </div>
          </div>
        </Card>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => navigate(`/medicines/${id}`)}>Cancel</button>
          <button type="submit" className="btn-primary !px-6" disabled={submitting}>
            {submitting ? <Spinner size={16} className="text-white" /> : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MedicineAPI, SettingsAPI, errorMessage } from "../services/api";
import { Card, PageTitle, Spinner, toast } from "../components/ui";

const EMPTY = {
  name: "",
  generic_name: "",
  brand_name: "",
  category: "General",
  dosage_form: "Tablets",
  strength: "",
  unit: "tablets",
  minimum_stock: "",
  maximum_stock: "",
  storage_location: "",
  selling_price: "",
  description: "",
  supplier_id: "",
  batch_number: "",
  quantity: "",
  manufacturing_date: "",
  expiry_date: "",
  purchase_price: "",
};

export default function MedicineAdd() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [meta, setMeta] = useState({ categories: [], suppliers: [], dosage_forms: [], units: [] });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    SettingsAPI.meta().then((res) => setMeta(res.data)).catch(() => {});
  }, []);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Medicine name is required.";
    if (!form.category) e.category = "Category is required.";
    if (form.minimum_stock === "" || Number(form.minimum_stock) < 0) e.minimum_stock = "Minimum stock is required and cannot be negative.";
    if (form.maximum_stock === "" || Number(form.maximum_stock) <= 0) e.maximum_stock = "Maximum stock must be greater than zero.";
    if (Number(form.minimum_stock) > Number(form.maximum_stock)) e.maximum_stock = "Maximum stock must be greater than or equal to minimum.";
    if (form.quantity && Number(form.quantity) <= 0) e.quantity = "Quantity must be greater than zero.";
    if (!form.batch_number && form.quantity) e.batch_number = "Batch number is required when adding initial stock.";
    if (form.expiry_date && form.manufacturing_date && form.expiry_date < form.manufacturing_date) {
      e.expiry_date = "Expiry date must not be earlier than manufacturing date.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) {
      toast("Please fix the highlighted fields", "error");
      return;
    }
    setSubmitting(true);
    const payload = {
      name: form.name,
      generic_name: form.generic_name || null,
      brand_name: form.brand_name || null,
      category: form.category,
      dosage_form: form.dosage_form || null,
      strength: form.strength || null,
      unit: form.unit || "tablets",
      minimum_stock: Number(form.minimum_stock),
      maximum_stock: Number(form.maximum_stock),
      storage_location: form.storage_location || null,
      selling_price: form.selling_price === "" ? null : Number(form.selling_price),
      description: form.description || null,
      supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
      batch:
        form.quantity && form.batch_number
          ? {
              batch_number: form.batch_number,
              quantity: Number(form.quantity),
              manufacturing_date: form.manufacturing_date || null,
              expiry_date: form.expiry_date || null,
              purchase_price: form.purchase_price === "" ? null : Number(form.purchase_price),
              supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
            }
          : null,
    };
    try {
      await MedicineAPI.create(payload);
      toast("Medicine added successfully.");
      navigate("/medicines");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = (field) => (errors[field] ? "input !border-rose-400" : "input");
  const fieldErr = (field) => errors[field] && <p className="mt-1 text-xs font-medium text-rose-600">{errors[field]}</p>;

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle
        title="Add New Medicine"
        subtitle="Register a medicine and optionally its initial batch stock"
        action={
          <button className="btn-secondary" onClick={() => navigate("/medicines")}>
            Cancel
          </button>
        }
      />

      <form onSubmit={onSubmit}>
        <Card className="mb-5">
          <h3 className="border-b border-slate-100 px-5 py-4 text-sm font-bold text-slate-800">Medicine Information</h3>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Medicine Name *</label>
              <input className={inputCls("name")} placeholder="e.g. Paracetamol" value={form.name} onChange={(e) => set("name", e.target.value)} />
              {fieldErr("name")}
            </div>
            <div>
              <label className="label">Generic Name</label>
              <input className={inputCls("generic_name")} placeholder="e.g. Paracetamol" value={form.generic_name} onChange={(e) => set("generic_name", e.target.value)} />
            </div>
            <div>
              <label className="label">Brand Name</label>
              <input className={inputCls("brand_name")} placeholder="e.g. Tylenol" value={form.brand_name} onChange={(e) => set("brand_name", e.target.value)} />
            </div>
            <div>
              <label className="label">Category *</label>
              <input className={inputCls("category")} list="categories" value={form.category} onChange={(e) => set("category", e.target.value)} />
              <datalist id="categories">
                {meta.categories.map((c) => <option key={c} value={c} />)}
              </datalist>
              {fieldErr("category")}
            </div>
            <div>
              <label className="label">Dosage Form</label>
              <select className="input" value={form.dosage_form} onChange={(e) => set("dosage_form", e.target.value)}>
                {meta.dosage_forms.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Strength</label>
              <input className={inputCls("strength")} placeholder="e.g. 500mg" value={form.strength} onChange={(e) => set("strength", e.target.value)} />
            </div>
            <div>
              <label className="label">Unit</label>
              <select className="input" value={form.unit} onChange={(e) => set("unit", e.target.value)}>
                {meta.units.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Minimum Stock Level *</label>
              <input type="number" min="0" className={inputCls("minimum_stock")} value={form.minimum_stock} onChange={(e) => set("minimum_stock", e.target.value)} />
              {fieldErr("minimum_stock")}
            </div>
            <div>
              <label className="label">Maximum Stock Level *</label>
              <input type="number" min="0" className={inputCls("maximum_stock")} value={form.maximum_stock} onChange={(e) => set("maximum_stock", e.target.value)} />
              {fieldErr("maximum_stock")}
            </div>
            <div>
              <label className="label">Selling Price</label>
              <input type="number" min="0" step="0.01" className={inputCls("selling_price")} value={form.selling_price} onChange={(e) => set("selling_price", e.target.value)} />
            </div>
            <div>
              <label className="label">Storage Location</label>
              <input className={inputCls("storage_location")} placeholder="e.g. Shelf A-01" value={form.storage_location} onChange={(e) => set("storage_location", e.target.value)} />
            </div>
            <div>
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

        <Card className="mb-5">
          <h3 className="border-b border-slate-100 px-5 py-4 text-sm font-bold text-slate-800">Initial Batch Stock (optional)</h3>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <label className="label">Batch Number</label>
              <input className={inputCls("batch_number")} placeholder="e.g. PARA-B101" value={form.batch_number} onChange={(e) => set("batch_number", e.target.value)} />
              {fieldErr("batch_number")}
            </div>
            <div>
              <label className="label">Initial Quantity</label>
              <input type="number" min="1" className={inputCls("quantity")} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
              {fieldErr("quantity")}
            </div>
            <div>
              <label className="label">Manufacturing Date</label>
              <input type="date" className={inputCls("manufacturing_date")} value={form.manufacturing_date} onChange={(e) => set("manufacturing_date", e.target.value)} />
            </div>
            <div>
              <label className="label">Expiry Date</label>
              <input type="date" className={inputCls("expiry_date")} value={form.expiry_date} onChange={(e) => set("expiry_date", e.target.value)} />
              {fieldErr("expiry_date")}
            </div>
            <div>
              <label className="label">Purchase Price</label>
              <input type="number" min="0" step="0.01" className={inputCls("purchase_price")} value={form.purchase_price} onChange={(e) => set("purchase_price", e.target.value)} />
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => navigate("/medicines")}>
            Cancel
          </button>
          <button type="submit" className="btn-primary !px-6" disabled={submitting}>
            {submitting ? <Spinner size={16} className="text-white" /> : "Save Medicine"}
          </button>
        </div>
      </form>
    </div>
  );
}

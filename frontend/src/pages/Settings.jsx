import { useEffect, useState } from "react";
import { SettingsAPI, errorMessage } from "../services/api";
import { Card, PageTitle, Spinner, toast } from "../components/ui";

export default function Settings() {
  const [warningDays, setWarningDays] = useState(30);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([SettingsAPI.get(), SettingsAPI.meta()])
      .then(([s, m]) => {
        setWarningDays(s.data.expiry_warning_days);
        setMeta(m.data);
      })
      .catch(() => toast("Failed to load settings", "error"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (warningDays < 1) {
      toast("Warning days must be at least 1", "error");
      return;
    }
    setSaving(true);
    try {
      await SettingsAPI.update({ expiry_warning_days: Number(warningDays) });
      toast("Settings saved successfully.");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Settings" subtitle="Configure expiry thresholds and system preferences" />

      <Card className="mb-5">
        <h3 className="border-b border-slate-100 px-5 py-4 text-sm font-bold text-slate-800">Expiry Warning Window</h3>
        <div className="space-y-4 p-5">
          <div>
            <label className="label">Days before expiry to flag “Expiring Soon”</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="365"
                className="input !w-40"
                value={warningDays}
                onChange={(e) => setWarningDays(e.target.value)}
              />
              <span className="text-sm text-slate-500">days</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Medicines expiring within this window generate automatic “Expiring Soon” alerts and appear in the
              Expiry Monitor. The default is 30 days.
            </p>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? <Spinner size={16} className="text-white" /> : "Save Settings"}
            </button>
          </div>
        </div>
      </Card>

      <Card className="mb-5">
        <h3 className="border-b border-slate-100 px-5 py-4 text-sm font-bold text-slate-800">System Information</h3>
        <dl className="divide-y divide-slate-50 p-4 text-sm">
          {[
            ["Application", "Medicine Shortage Tracking and Alert System"],
            ["Version", "1.0.0"],
            ["Categories in use", loading ? "…" : (meta?.categories?.length || 0)],
            ["Registered suppliers", loading ? "…" : (meta?.suppliers?.length || 0)],
            ["Supported dosage forms", loading ? "…" : (meta?.dosage_forms?.join(", ") || "")],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-2.5">
              <dt className="text-slate-500">{k}</dt>
              <dd className="font-semibold text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <h3 className="border-b border-slate-100 px-5 py-4 text-sm font-bold text-slate-800">Business Rules</h3>
        <ul className="list-inside list-disc space-y-1.5 p-5 text-sm text-slate-600">
          <li>Expired medicines are never issued automatically (FEFO skips expired batches).</li>
          <li>Stock can never go negative — issuing more than available is rejected.</li>
          <li>Every stock-in and stock-out automatically creates an auditable transaction.</li>
          <li>Restocks always record batch number, quantity and expiry date.</li>
          <li>Low-stock and expiry alerts are generated automatically.</li>
          <li>First Expiry, First Out (FEFO) prioritizes the earliest-expiring batch.</li>
          <li>Demand predictions are estimates for planning only, not medical advice.</li>
        </ul>
      </Card>
    </div>
  );
}

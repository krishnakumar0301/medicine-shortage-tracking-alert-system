import { useState } from "react";
import { ReportAPI } from "../services/api";
import { Card, PageTitle, Spinner, toast } from "../components/ui";

function downloadBlob(res, fallbackName) {
  const disposition = res.headers["content-disposition"] || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : fallbackName;
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const REPORTS = [
  {
    key: "inventory",
    name: "Medicine Inventory Report",
    desc: "Complete stock position for every medicine including expiry status.",
    icon: "💊",
    needsFilter: true,
    tone: "medical",
    run: async (filters) => {
      const res = await ReportAPI.inventory({ category: filters.category || undefined });
      return { res, filename: "inventory_report.csv", isJson: true };
    },
  },
  {
    key: "shortage",
    name: "Shortage Report",
    desc: "All medicines below minimum stock or out of stock.",
    icon: "🚨",
    tone: "rose",
    run: async () => ({ res: await ReportAPI.shortage(), filename: "shortage_report.csv" }),
  },
  {
    key: "expiry",
    name: "Expiry Report",
    desc: "Every batch with its expiry date and remaining shelf life.",
    icon: "⏳",
    tone: "amber",
    run: async () => ({ res: await ReportAPI.expiry(), filename: "expiry_report.csv" }),
  },
  {
    key: "stock_in",
    name: "Stock-In Report",
    desc: "All stock received with batch and price information.",
    icon: "📥",
    tone: "teal",
    needsDate: true,
    run: async (f) => ({ res: await ReportAPI.stockIn({ start: f.start || undefined, end: f.end || undefined }), filename: "stock_in_report.csv" }),
  },
  {
    key: "stock_out",
    name: "Stock-Out Report",
    desc: "All issued stock with recipient and reference details.",
    icon: "📤",
    tone: "orange",
    needsDate: true,
    run: async (f) => ({ res: await ReportAPI.stockOut({ start: f.start || undefined, end: f.end || undefined }), filename: "stock_out_report.csv" }),
  },
  {
    key: "demand",
    name: "Demand Report",
    desc: "Predicted demand, safety stock and reorder recommendations.",
    icon: "📈",
    tone: "medical",
    run: async () => ({ res: await ReportAPI.demand(), filename: "demand_report.csv" }),
  },
  {
    key: "suppliers",
    name: "Supplier Report",
    desc: "All suppliers and the medicines they provide.",
    icon: "🏭",
    tone: "slate",
    run: async () => ({ res: await ReportAPI.suppliers(), filename: "supplier_report.csv" }),
  },
  {
    key: "restock",
    name: "Restock Report",
    desc: "Medicines flagged for restocking with recommended quantities.",
    icon: "📦",
    tone: "teal",
    run: async () => ({ res: await ReportAPI.restock(), filename: "restock_report.csv" }),
  },
];

const TONES = {
  medical: "from-medical-700 to-medical-500",
  teal: "from-tealish-600 to-tealish-400",
  amber: "from-amber-500 to-amber-400",
  rose: "from-rose-600 to-rose-400",
  orange: "from-orange-600 to-orange-400",
  slate: "from-slate-600 to-slate-400",
};

export default function Reports() {
  const [running, setRunning] = useState(null);
  const [filters, setFilters] = useState({ category: "", start: "", end: "" });
  const [inventoryData, setInventoryData] = useState(null);

  const run = async (report) => {
    setRunning(report.key);
    try {
      const { res, filename, isJson } = await report.run(filters);
      if (isJson) {
        setInventoryData(res.data);
        toast(`${report.name} loaded (${res.data.total} rows)`);
      } else {
        downloadBlob(res, filename);
        toast(`${report.name} exported to CSV.`);
      }
    } catch (err) {
      toast(`Failed to generate ${report.name}`, "error");
    } finally {
      setRunning(null);
    }
  };

  const viewInventory = (row) => {
    // no-op: the table below already shows it
  };

  return (
    <div>
      <PageTitle
        title="Reports"
        subtitle="Generate and export inventory, shortage, expiry and demand reports"
        action={
          <button className="btn-secondary" onClick={() => setFilters({ category: "", start: "", end: "" })}>
            Reset filters
          </button>
        }
      />

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="label">Category filter (inventory)</label>
            <input className="input" placeholder="e.g. Antibiotic" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} />
          </div>
          <div>
            <label className="label">From date (stock reports)</label>
            <input type="date" className="input" value={filters.start} onChange={(e) => setFilters({ ...filters, start: e.target.value })} />
          </div>
          <div>
            <label className="label">To date (stock reports)</label>
            <input type="date" className="input" value={filters.end} onChange={(e) => setFilters({ ...filters, end: e.target.value })} />
          </div>
          <p className="text-xs text-slate-400 pb-1">CSV reports export with ⬇ Download</p>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            className="card group relative overflow-hidden p-5 text-left transition hover:-translate-y-0.5 hover:shadow-soft"
            onClick={() => run(r)}
            disabled={running === r.key}
          >
            <div className={`absolute -right-3 -top-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${TONES[r.tone]} text-white opacity-15`}>
              <span className="text-xl">{r.icon}</span>
            </div>
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="text-2xl">{r.icon}</span>
                {running === r.key && <Spinner size={18} />}
              </div>
              <p className="mt-3 text-sm font-bold text-slate-800">{r.name}</p>
              <p className="mt-1 text-xs text-slate-500">{r.desc}</p>
              <p className="mt-3 text-xs font-bold text-medical-600 group-hover:underline">⬇ Download CSV</p>
            </div>
          </button>
        ))}
      </div>

      {inventoryData && (
        <Card className="mt-5">
          <h3 className="border-b border-slate-100 px-5 py-4 text-sm font-bold text-slate-800">
            Medicine Inventory Report Preview ({inventoryData.total} rows)
          </h3>
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full min-w-[900px]">
              <thead className="sticky top-0 border-b border-slate-100 bg-slate-50">
                <tr>
                  {["Code", "Name", "Category", "Stock", "Min", "Max", "Status", "Expiry", "Location"].map((h) => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {inventoryData.rows.slice(0, 200).map((r, i) => (
                  <tr key={i} className="text-sm">
                    <td className="td">{r.code}</td>
                    <td className="td font-semibold">{r.name}</td>
                    <td className="td">{r.category}</td>
                    <td className="td font-bold">{r.current_stock}</td>
                    <td className="td">{r.minimum}</td>
                    <td className="td">{r.maximum}</td>
                    <td className="td">{r.status}</td>
                    <td className="td text-xs">{r.expiry_status} {r.days_to_expiry !== "" && `(${r.days_to_expiry}d)`}</td>
                    <td className="td text-xs">{r.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

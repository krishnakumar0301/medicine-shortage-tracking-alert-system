import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SearchAPI } from "../services/api";
import { Card, EmptyState, PageLoader, PageTitle, StatusBadge, toast } from "../components/ui";

export default function Search() {
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback(async (term) => {
    if (!term.trim()) {
      setResult(null);
      return;
    }
    setLoading(true);
    try {
      const res = await SearchAPI.search(term);
      setResult(res.data);
    } catch {
      toast("Search failed", "error");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (q.trim()) doSearch(q);
  }, [q, doSearch]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle title="Global Search" subtitle="Find medicines, batches, suppliers and transactions instantly" />

      <Card className="mb-5">
        <div className="p-4">
          <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              autoFocus
              className="input !pl-10 !py-3 text-base"
              placeholder="Search by medicine name, generic name, code, batch number or supplier..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {result && (
            <p className="mt-2 text-xs text-slate-400">
              {result.total} result{result.total === 1 ? "" : "s"} for “{q}”
            </p>
          )}
        </div>
      </Card>

      {loading ? (
        <PageLoader label="Searching..." />
      ) : result === null ? (
        !q && (
          <Card>
            <EmptyState icon="🔍" title="Type to search" message="Search across medicines, batches, suppliers and stock references." />
          </Card>
        )
      ) : result.total === 0 ? (
        <Card>
          <EmptyState icon="🔍" title="No results" message={`Nothing found for “${q}”. Try a different term.`} />
        </Card>
      ) : (
        <div className="space-y-5">
          {result.medicines.length > 0 && (
            <Card>
              <h3 className="border-b border-slate-100 px-5 py-3 text-sm font-bold text-slate-800">Medicines ({result.medicines.length})</h3>
              <div className="divide-y divide-slate-50">
                {result.medicines.map((m) => (
                  <Link key={m.id} to={`/medicines/${m.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-medical-50/40">
                    <span className="text-xl">💊</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-800">{m.name}</p>
                      <p className="text-xs text-slate-400">{m.code} · {m.generic_name || "—"} · {m.category}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-600">{m.current_stock} units</span>
                      <span className="text-medical-600">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {result.suppliers.length > 0 && (
            <Card>
              <h3 className="border-b border-slate-100 px-5 py-3 text-sm font-bold text-slate-800">Suppliers ({result.suppliers.length})</h3>
              <div className="divide-y divide-slate-50">
                {result.suppliers.map((s) => (
                  <Link key={s.id} to="/suppliers" className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50">
                    <span className="text-xl">🏭</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-800">{s.name}</p>
                      <p className="text-xs text-slate-400">{s.contact_person || "—"} · {s.email || "—"}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {result.batches.length > 0 && (
            <Card>
              <h3 className="border-b border-slate-100 px-5 py-3 text-sm font-bold text-slate-800">Batches ({result.batches.length})</h3>
              <div className="divide-y divide-slate-50">
                {result.batches.map((b) => (
                  <Link key={b.id} to={`/medicines/${b.medicine_id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50">
                    <span className="text-xl">🏷️</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-800">{b.batch_number}</p>
                      <p className="text-xs text-slate-400">{b.medicine_name} · {b.quantity} units · expires {b.expiry_date || "unknown"}</p>
                    </div>
                    <StatusBadge status={b.expiry_status || "unknown"} />
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {result.transactions.length > 0 && (
            <Card>
              <h3 className="border-b border-slate-100 px-5 py-3 text-sm font-bold text-slate-800">Transactions ({result.transactions.length})</h3>
              <div className="divide-y divide-slate-50">
                {result.transactions.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="text-xl">🧾</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-800">{t.reference || "—"}</p>
                      <p className="text-xs text-slate-400">{t.medicine_name} · {t.quantity} units · {t.recipient || "no recipient"}</p>
                    </div>
                    <span className="badge bg-slate-50 text-slate-600">{t.type}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

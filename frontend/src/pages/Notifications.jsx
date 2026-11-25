import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NotificationAPI } from "../services/api";
import { Card, EmptyState, PageLoader, PageTitle, toast } from "../components/ui";

const TYPE_ICON = {
  low_stock: "🔴",
  out_of_stock: "⛔",
  expiring_soon: "🟡",
  expired: "⚠️",
  restock: "🟠",
  healthy: "🟢",
};

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    NotificationAPI.list()
      .then((res) => setItems(res.data))
      .catch(() => toast("Failed to load notifications", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id) => {
    await NotificationAPI.markRead(id);
    load();
  };

  const markAll = async () => {
    await NotificationAPI.markAllRead();
    toast("All notifications marked as read");
    load();
  };

  const regenerate = async () => {
    const res = await NotificationAPI.refresh();
    toast(`${res.data.generated} notifications regenerated from current stock state`);
    load();
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle
        title="Notification Center"
        subtitle="Stock, expiry and restock alerts"
        action={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={markAll}>Mark all read</button>
            <button className="btn-ghost" onClick={regenerate}>Regenerate</button>
          </div>
        }
      />

      <Card>
        {loading ? (
          <PageLoader label="Loading notifications..." />
        ) : items.length === 0 ? (
          <EmptyState icon="🔔" title="No notifications" message="You're all caught up." />
        ) : (
          <div className="divide-y divide-slate-50">
            {items.map((n) => (
              <div
                key={n.id}
                className={`flex cursor-pointer items-start gap-3 p-4 transition hover:bg-slate-50/60 ${n.is_read ? "opacity-60" : ""}`}
                onClick={() => n.medicine_id && markRead(n.id)}
              >
                <span className="mt-0.5 text-lg">{TYPE_ICON[n.notification_type] || "🔔"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-800">{n.title}</p>
                    {!n.is_read && <span className="h-2 w-2 rounded-full bg-medical-500" />}
                  </div>
                  <p className="text-sm text-slate-500">{n.message}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {new Date(n.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                {n.medicine_id && (
                  <Link to={`/medicines/${n.medicine_id}`} className="btn-ghost !px-3 !py-1 text-xs" onClick={(e) => e.stopPropagation()}>
                    View →
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

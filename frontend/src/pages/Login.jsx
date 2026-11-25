import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../services/api";
import { Spinner, toast } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      toast("Welcome to MedTrack", "success");
      navigate("/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-medical-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-tealish-400/20 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 top-10 h-40 w-40 rounded-full bg-emerald-200/20 blur-2xl" />

      {/* Left brand panel */}
      <div className="relative hidden flex-1 flex-col justify-between bg-gradient-to-br from-medical-900 via-medical-950 to-medical-900 p-12 lg:flex">
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]">
          <div className="grid h-full w-full grid-cols-4 gap-4 p-8">
            {Array.from({ length: 16 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-center rounded-2xl border border-white text-2xl"
              >
                💊
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-medical-400 to-tealish-500 shadow-soft">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
              <rect x="8" y="2" width="8" height="20" rx="3" />
              <path d="M11 8h2M11 12h2M11 16h2" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="text-xl font-extrabold tracking-wide text-white">MedTrack</p>
            <p className="text-xs font-medium text-medical-100/60">Medicine Shortage Tracker</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-extrabold leading-tight text-white">
            Smarter medicine inventory. <span className="text-tealish-400">Safer healthcare.</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-medical-100/70">
            Detect shortages before they happen. Track expiry dates, predict demand, and keep every
            ward fully stocked — all from one professional dashboard.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              { icon: "🚨", label: "Automatic shortage alerts" },
              { icon: "⏳", label: "Expiry monitoring" },
              { icon: "📈", label: "Demand prediction" },
            ].map((f) => (
              <div key={f.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <span className="text-2xl">{f.icon}</span>
                <p className="mt-2 text-xs font-semibold leading-snug text-medical-50/90">{f.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-medical-100/40">
          © {new Date().getFullYear()} MedTrack · Hospital Pharmacy Operations
        </p>
      </div>

      {/* Right login form */}
      <div className="relative flex w-full flex-col items-center justify-center px-6 py-12 lg:w-[560px] lg:shrink-0">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-medical-600 to-tealish-500">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
                <rect x="8" y="2" width="8" height="20" rx="3" />
                <path d="M11 8h2M11 12h2M11 16h2" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-extrabold text-slate-800">MedTrack</p>
              <p className="text-xs text-slate-400">Medicine Shortage Tracker</p>
            </div>
          </div>

          <h2 className="text-2xl font-extrabold text-slate-800">Sign in to your dashboard</h2>
          <p className="mt-1 text-sm text-slate-500">
            Access inventory, alerts and demand insights.
          </p>

          <div className="mt-6 rounded-2xl border border-tealish-400/30 bg-tealish-400/10 p-3 text-xs text-tealish-600">
            <strong>Demo credentials:</strong> admin / admin123 &nbsp;·&nbsp; pharmacist / pharma123
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label">Username or Email</label>
              <div className="relative">
                <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  className="input !pl-10 !py-2.5"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  className="input !pl-10 !pr-11 !py-2.5"
                  type={show ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Toggle password visibility"
                >
                  {show ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <path d="M1 1l22 22" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-medical-600 focus:ring-medical-300"
                />
                Remember me
              </label>
              <button type="button" className="text-sm font-semibold text-medical-600 hover:text-medical-700">
                Forgot password?
              </button>
            </div>

            <button type="submit" className="btn-primary w-full !py-3 text-base" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <Spinner size={18} className="text-white" /> Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Protected by secure authentication · All inventory changes are audited
          </p>
        </div>
      </div>
    </div>
  );
}

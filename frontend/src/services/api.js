import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("mt_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      localStorage.removeItem("mt_token");
      localStorage.removeItem("mt_user");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export function errorMessage(err) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg || "Invalid value").join("; ");
  }
  return err?.message || "Something went wrong";
}

export const AuthAPI = {
  login: (username, password) => api.post("/auth/login", { username, password }),
  me: () => api.get("/auth/me"),
};

export const DashboardAPI = {
  get: () => api.get("/dashboard"),
};

export const MedicineAPI = {
  list: (params) => api.get("/medicines", { params }),
  get: (id) => api.get(`/medicines/${id}`),
  create: (data) => api.post("/medicines", data),
  update: (id, data) => api.put(`/medicines/${id}`, data),
  remove: (id) => api.delete(`/medicines/${id}`),
  options: () => api.get("/medicines/options"),
  history: (id) => api.get(`/medicines/${id}/history`),
};

export const StockAPI = {
  in: (medicineId, data) => api.post(`/stock/in?medicine_id=${medicineId}`, data),
  out: (medicineId, data) => api.post(`/stock/out?medicine_id=${medicineId}`, data),
  adjust: (medicineId, data) => api.post(`/stock/adjust?medicine_id=${medicineId}`, data),
  history: (params) => api.get("/stock/history", { params }),
  fefo: (id) => api.get(`/stock/fefo/${id}`),
  overview: (id) => api.get(`/stock/overview/${id}`),
  outBatches: () => api.get("/stock/batches/out"),
};

export const AlertAPI = {
  list: (status = "active") => api.get("/alerts", { params: { status } }),
  summary: () => api.get("/alerts/summary"),
  resolve: (id) => api.post(`/alerts/${id}/resolve`),
  resolveAll: () => api.post("/alerts/resolve-all"),
};

export const ExpiryAPI = {
  monitor: (params) => api.get("/expiry", { params }),
  fefo: (id) => api.get(`/expiry/fefo/${id}`),
  outBatches: () => api.get("/expiry/batches/out"),
  settings: () => api.get("/expiry/settings"),
  updateSettings: (data) => api.put("/expiry/settings", data),
};

export const PredictionAPI = {
  all: () => api.get("/predictions"),
  forMedicine: (id) => api.get(`/predictions/${id}`),
};

export const SupplierAPI = {
  list: (search) => api.get("/suppliers", { params: { search } }),
  get: (id) => api.get(`/suppliers/${id}`),
  details: (id) => api.get(`/suppliers/${id}/details`),
  create: (data) => api.post("/suppliers", data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  remove: (id) => api.delete(`/suppliers/${id}`),
};

export const ReportAPI = {
  inventory: (params) => api.get("/reports/inventory", { params }),
  shortage: () => api.get("/reports/shortage", { responseType: "blob" }),
  expiry: (status) => api.get("/reports/expiry", { params: { status }, responseType: "blob" }),
  stockIn: (params) => api.get("/reports/stock-in", { params, responseType: "blob" }),
  stockOut: (params) => api.get("/reports/stock-out", { params, responseType: "blob" }),
  demand: () => api.get("/reports/demand", { responseType: "blob" }),
  suppliers: () => api.get("/reports/suppliers", { responseType: "blob" }),
  restock: () => api.get("/reports/restock", { responseType: "blob" }),
};

export const NotificationAPI = {
  list: () => api.get("/notifications"),
  unreadCount: () => api.get("/notifications/unread-count"),
  markRead: (id) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post("/notifications/read-all"),
  refresh: () => api.post("/notifications/refresh"),
};

export const SearchAPI = {
  search: (q) => api.get("/search", { params: { q } }),
};

export const RestockAPI = {
  list: () => api.get("/restock"),
  create: (data) => api.post("/restock", data),
  update: (id, data) => api.put(`/restock/${id}`, data),
  remove: (id) => api.delete(`/restock/${id}`),
};

export const SettingsAPI = {
  get: () => api.get("/settings"),
  update: (data) => api.put("/settings", data),
  meta: () => api.get("/settings/meta"),
};

export default api;

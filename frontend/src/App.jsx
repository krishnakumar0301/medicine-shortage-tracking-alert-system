import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { ToastHost } from "./components/ui";
import Layout from "./layouts/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Medicines from "./pages/Medicines";
import MedicineAdd from "./pages/MedicineAdd";
import MedicineEdit from "./pages/MedicineEdit";
import MedicineDetail from "./pages/MedicineDetail";
import Stock from "./pages/Stock";
import StockHistory from "./pages/StockHistory";
import Issue from "./pages/Issue";
import Alerts from "./pages/Alerts";
import Expiry from "./pages/Expiry";
import Prediction from "./pages/Prediction";
import Suppliers from "./pages/Suppliers";
import Reports from "./pages/Reports";
import Notifications from "./pages/Notifications";
import Search from "./pages/Search";
import Settings from "./pages/Settings";

function Protected({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <ToastHost />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="*"
          element={
            <Protected>
              <Layout>
                <Routes>
                  <Route index element={<Dashboard />} />
                  <Route path="medicines" element={<Medicines />} />
                  <Route path="medicines/add" element={<MedicineAdd />} />
                  <Route path="medicines/:id/edit" element={<MedicineEdit />} />
                  <Route path="medicines/:id" element={<MedicineDetail />} />
                  <Route path="stock" element={<Stock />} />
                  <Route path="stock/history" element={<StockHistory />} />
                  <Route path="issue" element={<Issue />} />
                  <Route path="alerts" element={<Alerts />} />
                  <Route path="expiry" element={<Expiry />} />
                  <Route path="prediction" element={<Prediction />} />
                  <Route path="suppliers" element={<Suppliers />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="notifications" element={<Notifications />} />
                  <Route path="search" element={<Search />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </Protected>
          }
        />
      </Routes>
    </>
  );
}

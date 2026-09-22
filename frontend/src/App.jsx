import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Web3Provider } from "./context/Web3Context";
import Navbar from "./components/common/Navbar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import RegisterLand from "./pages/RegisterLand";
import MyParcels from "./pages/MyParcels";
import Marketplace from "./pages/Marketplace";
import ParcelDetail from "./pages/ParcelDetail";
import AdminPanel from "./pages/AdminPanel";
import LoadingSpinner from "./components/common/LoadingSpinner";
import Transactions from "./pages/Transactions";

// ── Requires login ────────────────────────────────────────────────────────────
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/" replace />;
  return children;
};

// ── Requires login + specific role ───────────────────────────────────────────
const RoleRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
};

// ── All routes ────────────────────────────────────────────────────────────────
function AppRoutes() {
  const { user } = useAuth(); // ← was missing, caused the crash

  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Routes>
          {/* Public — homepage only */}
          <Route path="/" element={<Home />} />

          {/* Redirect to dashboard if already logged in */}
          <Route path="/login"    element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <Register />} />

          {/* All logged-in users */}
          <Route path="/dashboard"    element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/marketplace"  element={<ProtectedRoute><Marketplace /></ProtectedRoute>} />
          <Route path="/parcels/:id"  element={<ProtectedRoute><ParcelDetail /></ProtectedRoute>} />
          <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />

          {/* Landowner only */}
          <Route path="/register-land" element={<RoleRoute roles={["landowner"]}><RegisterLand /></RoleRoute>} />
          <Route path="/my-parcels"    element={<RoleRoute roles={["landowner"]}><MyParcels /></RoleRoute>} />

          {/* Government only */}
          <Route path="/admin" element={<RoleRoute roles={["government"]}><AdminPanel /></RoleRoute>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
          <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Web3Provider>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "#1e293b",
                color:      "#f1f5f9",
                border:     "1px solid #334155",
                fontFamily: "DM Sans",
              },
              success: { iconTheme: { primary: "#4a7c59", secondary: "#f1f5f9" } },
              error:   { iconTheme: { primary: "#ef4444", secondary: "#f1f5f9" } },
            }}
          />
        </Web3Provider>
      </AuthProvider>
    </BrowserRouter>
  );
}
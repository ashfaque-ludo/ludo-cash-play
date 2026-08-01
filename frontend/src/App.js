import React, { useState, Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import InstallPWA from "@/components/InstallPWA";
import ErrorBoundary from "@/components/ErrorBoundary";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Sidebar from "@/components/Sidebar";
import Footer from "@/components/Footer";
import "./i18n"; // init i18next

// Eagerly loaded: Login needed immediately on auth redirect
import Login from "@/pages/Login";

// Inline wrapper: stores referral code then renders Login
function LoginWithRef() {
  const { refCode } = useParams();
  useEffect(() => {
    if (refCode && /^[A-Z0-9]{4,12}$/i.test(refCode)) {
      localStorage.setItem("referral_code", refCode.toUpperCase());
    }
  }, [refCode]);
  return <Login />;
}

// Lazy-loaded routes
const Home           = lazy(() => import("@/pages/Home"));
const Register       = lazy(() => import("@/pages/Register"));
const Dashboard      = lazy(() => import("@/pages/Dashboard"));
const MatchLobby     = lazy(() => import("@/pages/MatchLobby"));
const MatchRoom      = lazy(() => import("@/pages/MatchRoom"));
const Wallet         = lazy(() => import("@/pages/Wallet"));
const Leaderboard    = lazy(() => import("@/pages/Leaderboard"));
const Referral       = lazy(() => import("@/pages/Referral"));
const Legal          = lazy(() => import("@/pages/Legal"));
const Admin          = lazy(() => import("@/pages/Admin"));
const AdminRecharges = lazy(() => import("@/pages/AdminRecharges"));
const ScreenshotUpload = lazy(() => import("@/pages/ScreenshotUpload"));
const CreateRoom     = lazy(() => import("@/pages/CreateRoom"));
const RoomGen        = lazy(() => import("@/pages/RoomGen"));
const AdminScreenshots = lazy(() => import("@/pages/AdminScreenshots"));
const Withdraw       = lazy(() => import("@/pages/Withdraw"));
const History        = lazy(() => import("@/pages/History"));
const Profile        = lazy(() => import("@/pages/Profile"));
const KYC            = lazy(() => import("@/pages/KYC"));
const OpenBattles    = lazy(() => import("@/pages/OpenBattles"));
const RunningBattles = lazy(() => import("@/pages/RunningBattles"));
const Support        = lazy(() => import("@/pages/Support"));
const Account        = lazy(() => import("@/pages/Account"));
const OwnerPanel     = lazy(() => import("@/pages/OwnerPanel"));

function OwnerRoute({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user || !user.is_master_owner) return <Navigate to="/dashboard" replace />;
  return children;
}

function PageLoader() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const STAFF_ROLES = ["support_agent", "staff_manager", "admin", "super_admin"];
const BACKEND = process.env.REACT_APP_BACKEND_URL || "";

function MaintenanceScreen({ message }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <div className="text-5xl mb-4">🛠️</div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">Site Under Maintenance</h1>
        <p className="text-gray-600">
          {message || "We're making some improvements. Please check back shortly."}
        </p>
      </div>
    </div>
  );
}

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [maintenance, setMaintenance] = useState({ enabled: false, message: "" });
  const { user, ready } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const load = () => {
      fetch(`${BACKEND}/api/public/config`)
        .then(r => r.json())
        .then(d => { if (d?.maintenance) setMaintenance(d.maintenance); })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  // Keep the Render backend warm so OTP send/verify doesn't eat a cold-start
  // delay — ping on load, then every 10 minutes.
  useEffect(() => {
    const ping = () => fetch(`${BACKEND}/api/health`).catch(() => {});
    ping();
    const iv = setInterval(ping, 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  const isStaff = !!(user && user !== false && (user.is_master_owner || STAFF_ROLES.includes(user.role)));
  // Always let /login through — an admin who's logged out (new device,
  // cleared cookies) must still be able to reach the login form to prove
  // they're staff, otherwise maintenance mode would lock admins out entirely.
  const isLoginRoute = location.pathname.startsWith("/login");

  // Only gate on maintenance mode being on — don't block normal (maintenance
  // off) traffic behind the auth-ready check, that's the overwhelmingly
  // common case and shouldn't show an extra loading flash for everyone.
  if (maintenance.enabled && !isLoginRoute) {
    if (!ready) return <PageLoader />;
    if (!isStaff) return <MaintenanceScreen message={maintenance.message} />;
  }

  return (
    <>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Header onMenuOpen={() => setSidebarOpen(true)} />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/login/:refCode" element={<LoginWithRef />} />
          <Route path="/register" element={<Register />} />
          <Route path="/signup" element={<Register />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/legal/:section" element={<Legal />} />
          <Route path="/about" element={<Legal />} />
          <Route path="/terms" element={<Legal />} />
          <Route path="/privacy" element={<Legal />} />
          <Route path="/open-battles" element={<OpenBattles />} />
          <Route path="/account" element={<Account />} />
          <Route path="/support" element={<Support />} />

          {/* Protected user routes */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/play" element={<Navigate to="/dashboard" replace />} />
          <Route path="/create-battle" element={<Navigate to="/dashboard" replace />} />
          <Route path="/running-battles" element={<ProtectedRoute><RunningBattles /></ProtectedRoute>} />
          <Route path="/match/:id" element={<ProtectedRoute><MatchRoom /></ProtectedRoute>} />
          <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
          <Route path="/add-money" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
          <Route path="/referral" element={<ProtectedRoute><Referral /></ProtectedRoute>} />
          <Route path="/upload-screenshot" element={<ProtectedRoute><ScreenshotUpload /></ProtectedRoute>} />
          <Route path="/withdraw" element={<ProtectedRoute><Withdraw /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/kyc" element={<ProtectedRoute><KYC /></ProtectedRoute>} />
          <Route path="/create-room" element={<ProtectedRoute><CreateRoom /></ProtectedRoute>} />
          <Route path="/room-gen" element={<ProtectedRoute><RoomGen /></ProtectedRoute>} />

          {/* Owner Panel - master owner only */}
          <Route path="/owner-panel" element={<OwnerRoute><OwnerPanel /></OwnerRoute>} />

          {/* Admin routes */}
          <Route path="/admin" element={<ProtectedRoute requireRole="support_agent"><Admin /></ProtectedRoute>} />
          <Route path="/super-admin" element={<ProtectedRoute requireRole="super_admin"><Admin /></ProtectedRoute>} />
          <Route path="/admin/recharges" element={<ProtectedRoute requireRole="support_agent"><AdminRecharges /></ProtectedRoute>} />
          <Route path="/admin/screenshots" element={<ProtectedRoute requireRole="support_agent"><AdminScreenshots /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <BottomNav />
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <ErrorBoundary>
            <AppLayout />
            <InstallPWA />
            <Toaster
              richColors
              position="top-right"
              toastOptions={{
                style: { fontFamily: "system-ui, sans-serif", fontSize: "14px" },
                duration: 3500,
              }}
              closeButton
            />
          </ErrorBoundary>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

import React, { useState, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Sidebar from "@/components/Sidebar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";

// Critical path: loaded eagerly
import Home from "@/pages/Home";
import Login from "@/pages/Login";

// Lazy-loaded routes
const Register = lazy(() => import("@/pages/Register"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const MatchLobby = lazy(() => import("@/pages/MatchLobby"));
const MatchRoom = lazy(() => import("@/pages/MatchRoom"));
const Wallet = lazy(() => import("@/pages/Wallet"));
const Leaderboard = lazy(() => import("@/pages/Leaderboard"));
const Referral = lazy(() => import("@/pages/Referral"));
const Legal = lazy(() => import("@/pages/Legal"));
const Admin = lazy(() => import("@/pages/Admin"));
const AdminRecharges = lazy(() => import("@/pages/AdminRecharges"));
const ScreenshotUpload = lazy(() => import("@/pages/ScreenshotUpload"));
const CreateRoom = lazy(() => import("@/pages/CreateRoom"));
const RoomGen = lazy(() => import("@/pages/RoomGen"));
const AdminScreenshots = lazy(() => import("@/pages/AdminScreenshots"));
const Withdraw = lazy(() => import("@/pages/Withdraw"));
const History = lazy(() => import("@/pages/History"));
const Profile = lazy(() => import("@/pages/Profile"));
const KYC = lazy(() => import("@/pages/KYC"));
const OpenBattles = lazy(() => import("@/pages/OpenBattles"));
const RunningBattles = lazy(() => import("@/pages/RunningBattles"));
const Support = lazy(() => import("@/pages/Support"));
const Account = lazy(() => import("@/pages/Account"));
const OwnerPanel = lazy(() => import("@/pages/OwnerPanel"));

function OwnerRoute({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user || user.role !== "super_admin" || !user.is_master_owner) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function PageLoader() {
  return (
    <div className="min-h-screen bg-[#0A0A0E] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Header onMenuOpen={() => setSidebarOpen(true)} />
      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/signup" element={<Register />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/legal" element={<Legal />} />
        <Route path="/open-battles" element={<OpenBattles />} />
        <Route path="/account" element={<Account />} />

        {/* Protected user routes */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/play" element={<ProtectedRoute><MatchLobby /></ProtectedRoute>} />
        <Route path="/create-battle" element={<ProtectedRoute><MatchLobby /></ProtectedRoute>} />
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
        <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
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
      <WhatsAppButton />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <AppLayout />
          <Toaster
            richColors
            position="top-right"
            toastOptions={{
              style: { fontFamily: "'Manrope', sans-serif", fontSize: "14px" },
              duration: 3500,
            }}
            closeButton
          />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

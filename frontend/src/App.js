import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import MatchLobby from "@/pages/MatchLobby";
import MatchRoom from "@/pages/MatchRoom";
import Wallet from "@/pages/Wallet";
import Leaderboard from "@/pages/Leaderboard";
import Referral from "@/pages/Referral";
import Legal from "@/pages/Legal";
import Admin from "@/pages/Admin";
import AdminRecharges from "@/pages/AdminRecharges";
import ScreenshotUpload from "@/pages/ScreenshotUpload";
import CreateRoom from "@/pages/CreateRoom";
import RoomGen from "@/pages/RoomGen";
import AdminScreenshots from "@/pages/AdminScreenshots";
import Withdraw from "@/pages/Withdraw";
import History from "@/pages/History";
import Profile from "@/pages/Profile";
import KYC from "@/pages/KYC";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/legal" element={<Legal />} />

          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/play" element={<ProtectedRoute><MatchLobby /></ProtectedRoute>} />
          <Route path="/match/:id" element={<ProtectedRoute><MatchRoom /></ProtectedRoute>} />
          <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
          <Route path="/referral" element={<ProtectedRoute><Referral /></ProtectedRoute>} />
          <Route path="/upload-screenshot" element={<ProtectedRoute><ScreenshotUpload /></ProtectedRoute>} />
          <Route path="/withdraw" element={<ProtectedRoute><Withdraw /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/kyc" element={<ProtectedRoute><KYC /></ProtectedRoute>} />
          <Route path="/create-room" element={<ProtectedRoute><CreateRoom /></ProtectedRoute>} />
          <Route path="/room-gen" element={<ProtectedRoute><RoomGen /></ProtectedRoute>} />

          <Route path="/admin" element={<ProtectedRoute requireRole="support_agent"><Admin /></ProtectedRoute>} />
          <Route path="/admin/recharges" element={<ProtectedRoute requireRole="support_agent"><AdminRecharges /></ProtectedRoute>} />
          <Route path="/admin/screenshots" element={<ProtectedRoute requireRole="support_agent"><AdminScreenshots /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Footer />
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
    </BrowserRouter>
  );
}

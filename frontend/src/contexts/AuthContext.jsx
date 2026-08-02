import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch (err) {
      // Only a real 401/403 means the session is genuinely invalid. Any other
      // failure (network blip, timeout, 5xx, backend cold start) used to
      // force setUser(false) too, which bounced a perfectly valid, logged-in
      // user to /login on every transient hiccup from the 10s poll — this
      // was the actual cause of "getting logged out repeatedly". Now those
      // failures just leave the previous state alone and retry next poll.
      const status = err?.response?.status;
      if (status === 401 || status === 403 || !localStorage.getItem("lcp_token")) {
        setUser(false);
      } else {
        setUser(prev => (prev === null ? null : prev));
      }
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    const INTERVAL = 10000; // 10s — was 5s; 2x fewer calls, wallet still updates promptly
    const timer = { id: null };
    const start = () => { clearInterval(timer.id); timer.id = setInterval(refresh, INTERVAL); };
    const stop  = () => clearInterval(timer.id);

    refresh();
    start();

    // Pause when tab is hidden; resume + immediately refresh when visible
    const onVisibility = () => {
      if (document.visibilityState === 'visible') { refresh(); start(); } else { stop(); }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [refresh]);

  const login = async (identifier, password, isPhone = false) => {
    try {
      const payload = isPhone ? { phone: identifier, password } : { email: identifier, password };
      const { data } = await api.post("/auth/login", payload);
      if (data.token) localStorage.setItem("lcp_token", data.token);
      setUser(data);
      return { ok: true, user: data };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail) || e.message };
    }
  };

  const sendOtp = async (phone) => {
    try {
      const { data } = await api.post("/auth/send-otp", { phone });
      return { ok: true, dev_otp: data.dev_otp };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail) || e.message };
    }
  };

  const verifyOtp = async (phone, otp, name, referral_code) => {
    try {
      const payload = { phone, otp };
      if (name) payload.name = name;
      if (referral_code) payload.referral_code = referral_code;
      const { data } = await api.post("/auth/verify-otp", payload);
      if (data.token) localStorage.setItem("lcp_token", data.token);
      setUser(data);
      return { ok: true, user: data, is_new_user: data.is_new_user, needs_name: data.needs_name };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail) || e.message };
    }
  };

  const verifyFirebaseOtp = async (idToken, phone, referral_code) => {
    try {
      const payload = { idToken };
      if (phone) payload.phone = phone;
      if (referral_code) payload.referral_code = referral_code;
      const { data } = await api.post("/auth/verify-firebase-otp", payload);
      if (data.token) localStorage.setItem("lcp_token", data.token);
      setUser(data);
      return { ok: true, user: data, is_new_user: data.is_new_user, needs_name: data.needs_name };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail) || e.message };
    }
  };

  const setName = async (name) => {
    try {
      const { data } = await api.post("/auth/set-name", { name });
      setUser(data);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail) || e.message };
    }
  };

  const register = async (payload) => {
    try {
      const { data } = await api.post("/auth/register", payload);
      if (data.token) localStorage.setItem("lcp_token", data.token);
      setUser(data);
      return { ok: true, user: data };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail) || e.message };
    }
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("lcp_token");
    setUser(false);
  };

  return (
    <AuthCtx.Provider value={{ user, ready, login, sendOtp, verifyOtp, verifyFirebaseOtp, setName, register, logout, refresh, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() { return useContext(AuthCtx); }

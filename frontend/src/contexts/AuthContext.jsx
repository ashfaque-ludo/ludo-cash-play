import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(false);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

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
    <AuthCtx.Provider value={{ user, ready, login, register, logout, refresh, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() { return useContext(AuthCtx); }

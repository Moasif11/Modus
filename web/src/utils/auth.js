import { useState, useEffect } from "react";
import { api } from "./api";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("modus_user");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function useAuth() {
  const [user, setUser] = useState(getStoredUser);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { verifySession(); }, []);

  async function verifySession() {
    if (typeof window === "undefined") { setLoading(false); return; }
    // Session lives in an httpOnly cookie (legacy localStorage tokens still work
    // via the Authorization header) — always ask the server.
    try {
      const data = await api.get("/api/auth/me");
      setUser(data.user);
      localStorage.setItem("modus_user", JSON.stringify(data.user));
    } catch (err) {
      if (err?.code === 'MUST_RESET_PASSWORD') {
        if (typeof window !== "undefined" && !window.location.pathname.startsWith('/reset-password')) {
          window.location.href = "/reset-password";
        }
      } else {
        localStorage.removeItem("modus_auth_token");
        localStorage.removeItem("modus_user");
        setUser(null);
      }
    } finally { setLoading(false); }
  }

  async function login(username, password) {
    setError(null);
    const data = await api.post("/api/auth/login", { username, password });
    // Token arrives as an httpOnly cookie — not stored in localStorage (XSS can't read it).
    localStorage.setItem("modus_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    try { await api.post("/api/auth/logout", {}); } catch {}
    localStorage.removeItem("modus_auth_token");
    localStorage.removeItem("modus_user");
    setUser(null);
  }

  async function resetPassword(currentPassword, newPassword, email) {
    await api.post("/api/auth/reset-password", { currentPassword, newPassword, email });
    const updatedUser = { ...user, must_reset_password: false };
    setUser(updatedUser);
    localStorage.setItem("modus_user", JSON.stringify(updatedUser));
  }

  return { user, loading, error, login, logout, resetPassword };
}

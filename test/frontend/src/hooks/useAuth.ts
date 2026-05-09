import { useState, useEffect, useCallback } from "react";

interface User {
  id: number;
  username: string;
}

function getToken(): string | null {
  return localStorage.getItem("token");
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const resp = await fetch("/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setUser(data);
      } else {
        localStorage.removeItem("token");
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = useCallback(async (username: string, password: string) => {
    const resp = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.detail || "Login failed");
    }
    localStorage.setItem("token", data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const resp = await fetch("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.detail || "Registration failed");
    }
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
    window.location.reload();
  }, []);

  return { user, loading, login, register, logout, token: getToken() };
}

import { createContext, useContext, useEffect, useState } from "react";
import { AuthAPI } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mt_user") || "null");
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem("mt_token"));
  const [loading, setLoading] = useState(false);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const res = await AuthAPI.login(username, password);
      localStorage.setItem("mt_token", res.data.access_token);
      localStorage.setItem("mt_user", JSON.stringify(res.data.user));
      setToken(res.data.access_token);
      setUser(res.data.user);
      return res.data.user;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("mt_token");
    localStorage.removeItem("mt_user");
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    if (token && !user) {
      AuthAPI.me()
        .then((res) => {
          setUser(res.data);
          localStorage.setItem("mt_user", JSON.stringify(res.data));
        })
        .catch(() => {});
    }
  }, [token, user]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

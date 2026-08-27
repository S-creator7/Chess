import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PublicUser } from "@chess/api-client";
import { api, tokenStore } from "../api/client";

type AuthState = {
  user: PublicUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tokenStore.getAccessToken() && !tokenStore.getRefreshToken()) {
        setReady(true);
        return;
      }
      try {
        const me = await api.me();
        if (!cancelled) setUser(me.user);
      } catch {
        tokenStore.clear();
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      login: async (email, password) => {
        const res = await api.login(email, password);
        tokenStore.setTokens(res.accessToken, res.refreshToken);
        setUser(res.user);
      },
      register: async (email, password, displayName) => {
        const res = await api.register(email, password, displayName);
        tokenStore.setTokens(res.accessToken, res.refreshToken);
        setUser(res.user);
      },
      logout: async () => {
        try {
          await api.logout();
        } finally {
          tokenStore.clear();
          setUser(null);
        }
      },
    }),
    [user, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}

import { createChessApi, type TokenStore } from "@chess/api-client";

const ACCESS_KEY = "chess.access";
const REFRESH_KEY = "chess.refresh";

export const tokenStore: TokenStore = {
  getAccessToken: () => sessionStorage.getItem(ACCESS_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_KEY),
  setTokens: (access, refresh) => {
    sessionStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    sessionStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

const baseUrl = import.meta.env.VITE_API_URL ?? "";
export const api = createChessApi(baseUrl, tokenStore);

function defaultWsUrl() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  if (typeof window === "undefined") return "ws://localhost:3001/ws";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

export const wsUrl = defaultWsUrl();

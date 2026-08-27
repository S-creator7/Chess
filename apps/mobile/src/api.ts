import { createChessApi, type TokenStore } from "@chess/api-client";
import * as SecureStore from "expo-secure-store";

declare const process: { env: Record<string, string | undefined> };

const ACCESS = "chess.access";
const REFRESH = "chess.refresh";

let accessMem: string | null = null;
let refreshMem: string | null = null;

export const tokenStore: TokenStore = {
  getAccessToken: () => accessMem,
  getRefreshToken: () => refreshMem,
  setTokens: (access, refresh) => {
    accessMem = access;
    refreshMem = refresh;
    void SecureStore.setItemAsync(ACCESS, access);
    void SecureStore.setItemAsync(REFRESH, refresh);
  },
  clear: () => {
    accessMem = null;
    refreshMem = null;
    void SecureStore.deleteItemAsync(ACCESS);
    void SecureStore.deleteItemAsync(REFRESH);
  },
};

export async function hydrateTokens() {
  accessMem = await SecureStore.getItemAsync(ACCESS);
  refreshMem = await SecureStore.getItemAsync(REFRESH);
}

export const apiBase = process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:3001";
export const wsUrl = process.env.EXPO_PUBLIC_WS_URL ?? "ws://127.0.0.1:3001/ws";
export const api = createChessApi(apiBase, tokenStore);

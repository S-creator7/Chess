export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  rating: number;
};

export type AuthResponse = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
};

export type GameDto = {
  id: string;
  whiteId: string;
  blackId: string;
  whiteName: string;
  blackName: string;
  timeControl: string;
  rated: boolean;
  status: string;
  result: string | null;
  fen: string;
  turn: "w" | "b";
  whiteClockMs: number;
  blackClockMs: number;
  ply: number;
  you: "w" | "b";
  moves: Array<{ ply: number; san: string; uci: string }>;
  drawOfferFrom?: "w" | "b" | null;
};

export type ChatMessageDto = {
  id: string;
  gameId: string;
  userId: string;
  displayName: string;
  body: string;
  createdAt: string;
};

export type ApiError = { error: { code: string; message: string } };

export type WsOutgoing =
  | { type: "auth"; accessToken: string }
  | { type: "move"; gameId: string; uci: string }
  | { type: "resign"; gameId: string }
  | { type: "draw_offer"; gameId: string }
  | { type: "draw_response"; gameId: string; accept: boolean }
  | { type: "chat"; gameId: string; body: string };

export type WsIncoming =
  | { type: "auth_ok" }
  | { type: "game_start"; gameId: string }
  | { type: "position"; gameId: string; payload: GameDto }
  | { type: "clock"; gameId: string; whiteClockMs: number; blackClockMs: number }
  | { type: "game_over"; gameId: string; result: string | null }
  | { type: "chat"; message: ChatMessageDto }
  | { type: "draw_offer"; gameId: string; from: "w" | "b" }
  | { type: "error"; code: string; message: string };

export class ChessApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ChessApiError";
  }
}

export type TokenStore = {
  getAccessToken: () => string | null;
  setTokens: (access: string, refresh: string) => void;
  clear: () => void;
  getRefreshToken: () => string | null;
};

export function createChessApi(baseUrl: string, tokens: TokenStore) {
  async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    const access = tokens.getAccessToken();
    if (access) headers.set("Authorization", `Bearer ${access}`);
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
    if (res.status === 401 && retry && path !== "/auth/refresh" && path !== "/auth/login") {
      await refresh();
      return request<T>(path, init, false);
    }
    const data = (await res.json().catch(() => ({}))) as T | ApiError;
    if (!res.ok) {
      const err = data as ApiError;
      throw new ChessApiError(err.error?.code ?? "HTTP", err.error?.message ?? res.statusText, res.status);
    }
    return data as T;
  }

  async function refresh() {
    const body = tokens.getRefreshToken() ? JSON.stringify({ refreshToken: tokens.getRefreshToken() }) : "{}";
    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body,
    });
    if (!res.ok) {
      tokens.clear();
      throw new ChessApiError("TOKEN_EXPIRED", "Session expired", 401);
    }
    const data = (await res.json()) as AuthResponse;
    tokens.setTokens(data.accessToken, data.refreshToken);
    return data;
  }

  return {
    register: (email: string, password: string, displayName: string) =>
      request<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, displayName }),
      }),
    login: (email: string, password: string) =>
      request<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    logout: () =>
      request<{ ok: boolean }>("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken: tokens.getRefreshToken() }),
      }),
    me: () => request<{ user: PublicUser }>("/me"),
    queue: (timeControl: string, rated: boolean) =>
      request<{ matched: boolean; gameId?: string }>("/matchmaking/queue", {
        method: "POST",
        body: JSON.stringify({ timeControl, rated }),
      }),
    leaveQueue: () => request<{ ok: boolean }>("/matchmaking/queue", { method: "DELETE" }),
    games: () => request<{ games: Array<Record<string, unknown>> }>("/games"),
    activeGame: () => request<{ game: GameDto | null }>("/games/active"),
    game: (id: string) => request<{ game: GameDto }>(`/games/${id}`),
    pgn: (id: string) => request<{ pgn: string }>(`/games/${id}/pgn`),
    chat: (id: string) => request<{ messages: ChatMessageDto[] }>(`/games/${id}/chat`),
    deleteAccount: (password: string) =>
      request<{ ok: boolean }>("/auth/delete-account", {
        method: "POST",
        body: JSON.stringify({ password }),
      }),
    refresh,
  };
}

export function connectGameSocket(
  wsUrl: string,
  accessToken: string,
  onMessage: (msg: WsIncoming) => void,
  onStatus?: (status: "open" | "closed") => void,
) {
  let closedByUser = false;
  let socket: WebSocket | null = null;
  let retries = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function connect() {
    socket = new WebSocket(wsUrl);
    socket.addEventListener("open", () => {
      retries = 0;
      socket?.send(JSON.stringify({ type: "auth", accessToken }));
      onStatus?.("open");
    });
    socket.addEventListener("message", (event) => {
      onMessage(JSON.parse(String(event.data)) as WsIncoming);
    });
    socket.addEventListener("close", () => {
      onStatus?.("closed");
      if (closedByUser) return;
      const delay = Math.min(8000, 400 * 2 ** retries);
      retries += 1;
      timer = setTimeout(connect, delay);
    });
    socket.addEventListener("error", () => {
      socket?.close();
    });
  }

  connect();
  return {
    send(msg: WsOutgoing) {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
    },
    close() {
      closedByUser = true;
      if (timer) clearTimeout(timer);
      socket?.close();
    },
    raw: socket,
  };
}

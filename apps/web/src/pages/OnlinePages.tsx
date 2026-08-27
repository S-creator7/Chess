import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChessApiError, connectGameSocket, type ChatMessageDto, type GameDto } from "@chess/api-client";
import { api, tokenStore, wsUrl } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { Board } from "../components/Board";
import { Clocks } from "../components/Clocks";
import { TurnBanner } from "../components/TurnBanner";
import { GameChat } from "../components/GameChat";
import { resultHeadline, winnerFromResult } from "../lib/result";

export function OnlineLobby() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rated, setRated] = useState(true);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const polling = useRef<number | null>(null);
  const sockRef = useRef<ReturnType<typeof connectGameSocket> | null>(null);

  function stopSearchTimers() {
    if (polling.current) {
      window.clearInterval(polling.current);
      polling.current = null;
    }
  }

  function startPoll() {
    stopSearchTimers();
    polling.current = window.setInterval(async () => {
      try {
        const active = await api.activeGame();
        if (active.game) {
          stopSearchTimers();
          navigate(`/play/online/${active.game.id}`);
        }
      } catch {
        /* keep polling */
      }
    }, 1000);
  }

  useEffect(() => {
    if (!user) return;
    void api.activeGame().then((res) => {
      if (res.game) navigate(`/play/online/${res.game.id}`);
    });
    const token = tokenStore.getAccessToken();
    if (!token) return;
    sockRef.current = connectGameSocket(wsUrl, token, (msg) => {
      if (msg.type === "game_start") navigate(`/play/online/${msg.gameId}`);
    });
    return () => {
      stopSearchTimers();
      sockRef.current?.close();
      void api.leaveQueue().catch(() => undefined);
    };
  }, [user, navigate]);

  if (!user) {
    return (
      <div className="card">
        <h2>Play online</h2>
        <p>Create an account to find an opponent, play live, and chat.</p>
        <Link to="/login">Log in</Link>
      </div>
    );
  }

  async function queue() {
    setError(null);
    setSearching(true);
    setStatus("Searching for an opponent… stay on this page.");
    try {
      const res = await api.queue("10+0", rated);
      if (res.matched && res.gameId) {
        navigate(`/play/online/${res.gameId}`);
        return;
      }
      startPoll();
    } catch (err) {
      if (err instanceof ChessApiError && err.code === "ALREADY_QUEUED") {
        startPoll();
        return;
      }
      setSearching(false);
      setStatus(null);
      setError(err instanceof Error ? err.message : "Queue failed");
    }
  }

  async function cancel() {
    stopSearchTimers();
    setSearching(false);
    setStatus(null);
    await api.leaveQueue().catch(() => undefined);
  }

  return (
    <div className="card">
      <h2>Online matchmaking</h2>
      <p className="muted">
        Signed in as {user.displayName} ({user.rating}). Moves and chat share one WebSocket.
      </p>
      <label>
        <input type="checkbox" checked={rated} onChange={(e) => setRated(e.target.checked)} disabled={searching} /> Rated
        10+0
      </label>
      <p>
        {searching ? (
          <button type="button" className="secondary" onClick={() => void cancel()}>
            Cancel search
          </button>
        ) : (
          <button type="button" onClick={() => void queue()}>
            Find opponent
          </button>
        )}
      </p>
      {status && <p>{status}</p>}
      {error && <p className="error">{error}</p>}
      <p className="muted">Open a second browser (incognito) with another account to match yourself.</p>
    </div>
  );
}

export function OnlineGame() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [game, setGame] = useState<GameDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pgn, setPgn] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [connected, setConnected] = useState(false);
  const [drawFrom, setDrawFrom] = useState<"w" | "b" | null>(null);
  const socketRef = useRef<ReturnType<typeof connectGameSocket> | null>(null);

  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    api
      .game(id)
      .then((res) => {
        if (!cancelled) setGame(res.game);
      })
      .catch((err: Error) => setError(err.message));
    api
      .chat(id)
      .then((res) => {
        if (!cancelled) setMessages(res.messages);
      })
      .catch(() => undefined);

    const token = tokenStore.getAccessToken();
    if (!token) return;
    const sock = connectGameSocket(
      wsUrl,
      token,
      (msg) => {
        if (msg.type === "position" && msg.gameId === id) setGame(msg.payload);
        if (msg.type === "clock" && msg.gameId === id) {
          setGame((g) => (g ? { ...g, whiteClockMs: msg.whiteClockMs, blackClockMs: msg.blackClockMs } : g));
        }
        if (msg.type === "game_over" && msg.gameId === id) {
          setDrawFrom(null);
          void api.game(id).then((res) => setGame(res.game));
        }
        if (msg.type === "draw_offer" && msg.gameId === id) setDrawFrom(msg.from);
        if (msg.type === "chat" && msg.message.gameId === id) {
          setMessages((prev) => (prev.some((m) => m.id === msg.message.id) ? prev : [...prev, msg.message]));
        }
        if (msg.type === "error") setError(msg.message);
      },
      (status) => setConnected(status === "open"),
    );
    socketRef.current = sock;
    return () => {
      cancelled = true;
      sock.close();
    };
  }, [id, user]);

  useEffect(() => {
    if (!game || game.status !== "active") return;
    const timer = window.setInterval(() => {
      setGame((g) => {
        if (!g || g.status !== "active") return g;
        const tick = 200;
        if (g.turn === "w") return { ...g, whiteClockMs: g.whiteClockMs - tick };
        return { ...g, blackClockMs: g.blackClockMs - tick };
      });
    }, 200);
    return () => window.clearInterval(timer);
  }, [game?.id, game?.status, game?.turn]);

  if (!user) return <p>Please log in.</p>;
  if (!game) return <p>{error ?? "Loading game…"}</p>;

  const over = game.status !== "active";
  const myTurn = !over && game.turn === game.you;
  const incomingDraw = Boolean(drawFrom && drawFrom !== game.you && !over);

  return (
    <div className="game-layout">
      <div className="board-column">
        <TurnBanner turn={game.turn} you={game.you} over={over} result={game.result} />
        <Board
          fen={game.fen}
          orientation={game.you === "w" ? "white" : "black"}
          interactive={myTurn}
          yourTurn={myTurn}
          winner={winnerFromResult(game.result)}
          resultLabel={over ? resultHeadline(game.result, game.you) : null}
          onUci={(uci) => {
            socketRef.current?.send({ type: "move", gameId: game.id, uci });
            return true;
          }}
        />
        <Clocks
          whiteMs={game.whiteClockMs}
          blackMs={game.blackClockMs}
          turn={game.turn}
          running={!over}
          you={game.you}
          orientation={game.you === "w" ? "white" : "black"}
          winner={winnerFromResult(game.result)}
        />
      </div>
      <div className="card">
        <h2>
          {game.whiteName} vs {game.blackName}
        </h2>
        <p className="muted">{connected ? "Connected" : "Reconnecting to live server…"}</p>
        <p className={`status ${over ? "status-result" : ""}`}>
          {over ? resultHeadline(game.result, game.you) : myTurn ? "Your turn" : "Waiting for opponent"}
        </p>
        {incomingDraw && (
          <p>
            Opponent offers a draw.{" "}
            <button
              type="button"
              onClick={() => {
                socketRef.current?.send({ type: "draw_response", gameId: game.id, accept: true });
                setDrawFrom(null);
              }}
            >
              Accept
            </button>{" "}
            <button
              type="button"
              className="secondary"
              onClick={() => {
                socketRef.current?.send({ type: "draw_response", gameId: game.id, accept: false });
                setDrawFrom(null);
              }}
            >
              Decline
            </button>
          </p>
        )}
        {error && <p className="error">{error}</p>}
        <p>
          <button
            className="danger"
            type="button"
            disabled={over}
            onClick={() => socketRef.current?.send({ type: "resign", gameId: game.id })}
          >
            Resign
          </button>{" "}
          <button
            className="secondary"
            type="button"
            disabled={over}
            onClick={() => socketRef.current?.send({ type: "draw_offer", gameId: game.id })}
          >
            Offer draw
          </button>
        </p>
        <h3>Moves</h3>
        <div className="moves">{game.moves.map((m) => m.san).join(" ") || "No moves yet."}</div>
        <p>
          <button className="secondary" type="button" onClick={() => void api.pgn(game.id).then((r) => setPgn(r.pgn))}>
            Export PGN
          </button>
        </p>
        {pgn && <pre className="moves">{pgn}</pre>}
        <GameChat
          messages={messages}
          selfId={user.id}
          opponentName={game.you === "w" ? game.blackName : game.whiteName}
          connected={connected}
          onSend={(body) => socketRef.current?.send({ type: "chat", gameId: game.id, body })}
        />
      </div>
    </div>
  );
}

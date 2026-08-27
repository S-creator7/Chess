import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { connectGameSocket, type ChatMessageDto, type GameDto } from "@chess/api-client";
import { api, tokenStore, wsUrl } from "./api";
import { useAuth } from "./Auth";
import { Board } from "./Board";
import { resultHeadline, winnerFromResult } from "./result";

export function OnlineScreen({
  onBack,
  gameId,
  onOpenGame,
}: {
  onBack: () => void;
  gameId?: string;
  onOpenGame: (id: string) => void;
}) {
  const { user, login, register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const lobbySock = useRef<ReturnType<typeof connectGameSocket> | null>(null);

  useEffect(() => {
    if (!user || gameId) return;
    const token = tokenStore.getAccessToken();
    if (token) {
      lobbySock.current = connectGameSocket(wsUrl, token, (msg) => {
        if (msg.type === "game_start") onOpenGame(msg.gameId);
      });
    }
    return () => {
      if (poll.current) clearInterval(poll.current);
      lobbySock.current?.close();
      void api.leaveQueue().catch(() => undefined);
    };
  }, [user, gameId, onOpenGame]);

  if (!user) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Pressable onPress={onBack}><Text style={styles.back}>← Home</Text></Pressable>
        <Text style={styles.h1}>{mode === "login" ? "Log in" : "Create account"}</Text>
        {mode === "register" && (
          <TextInput style={styles.input} placeholder="Display name" placeholderTextColor="#9ca3af" value={displayName} onChangeText={setDisplayName} />
        )}
        <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" placeholderTextColor="#9ca3af" value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder="Password" secureTextEntry placeholderTextColor="#9ca3af" value={password} onChangeText={setPassword} />
        {error && <Text style={styles.err}>{error}</Text>}
        <Pressable
          style={styles.btn}
          onPress={() => {
            setError(null);
            const run = mode === "login" ? login(email, password) : register(email, password, displayName);
            run.catch((e: Error) => setError(e.message));
          }}
        >
          <Text style={styles.btnText}>{mode === "login" ? "Log in" : "Register"}</Text>
        </Pressable>
        <Pressable onPress={() => setMode(mode === "login" ? "register" : "login")}>
          <Text style={styles.link}>{mode === "login" ? "Need an account?" : "Have an account?"}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (gameId) {
    return <LiveGame gameId={gameId} onBack={onBack} />;
  }

  async function queue() {
    setError(null);
    setStatus("Searching…");
    try {
      const res = await api.queue("10+0", true);
      if (res.matched && res.gameId) {
        onOpenGame(res.gameId);
        return;
      }
      poll.current = setInterval(async () => {
        const active = await api.activeGame();
        if (active.game) {
          if (poll.current) clearInterval(poll.current);
          onOpenGame(active.game.id);
        }
      }, 1000);
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : "Queue failed");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Pressable onPress={onBack}><Text style={styles.back}>← Home</Text></Pressable>
      <Text style={styles.h1}>Online 10+0</Text>
      <Text style={styles.muted}>{user.displayName} · {user.rating}</Text>
      <Pressable style={styles.btn} onPress={() => void queue()}>
        <Text style={styles.btnText}>Find game</Text>
      </Pressable>
      {status && <Text style={styles.muted}>{status}</Text>}
      {error && <Text style={styles.err}>{error}</Text>}
    </ScrollView>
  );
}

function LiveGame({ gameId, onBack }: { gameId: string; onBack: () => void }) {
  const { user } = useAuth();
  const [game, setGame] = useState<GameDto | null>(null);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [drawFrom, setDrawFrom] = useState<"w" | "b" | null>(null);
  const sockRef = useRef<ReturnType<typeof connectGameSocket> | null>(null);

  useEffect(() => {
    if (!user) return;
    api.game(gameId).then((r) => setGame(r.game)).catch((e: Error) => setError(e.message));
    api.chat(gameId).then((r) => setMessages(r.messages)).catch(() => undefined);
    const token = tokenStore.getAccessToken();
    if (!token) return;
    const sock = connectGameSocket(wsUrl, token, (msg) => {
      if (msg.type === "position" && msg.gameId === gameId) setGame(msg.payload);
      if (msg.type === "clock" && msg.gameId === gameId) {
        setGame((g) => (g ? { ...g, whiteClockMs: msg.whiteClockMs, blackClockMs: msg.blackClockMs } : g));
      }
      if (msg.type === "game_over" && msg.gameId === gameId) {
        setDrawFrom(null);
        void api.game(gameId).then((r) => setGame(r.game));
      }
      if (msg.type === "draw_offer" && msg.gameId === gameId) setDrawFrom(msg.from);
      if (msg.type === "chat" && msg.message.gameId === gameId) {
        setMessages((prev) => (prev.some((m) => m.id === msg.message.id) ? prev : [...prev, msg.message]));
      }
      if (msg.type === "error") setError(msg.message);
    });
    sockRef.current = sock;
    return () => sock.close();
  }, [gameId, user]);

  if (!user) return null;
  if (!game) return <View style={styles.page}><Text style={styles.muted}>{error ?? "Loading…"}</Text></View>;

  const over = game.status !== "active";
  const myTurn = !over && game.turn === game.you;
  const incomingDraw = Boolean(drawFrom && drawFrom !== game.you && !over);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Pressable onPress={onBack}><Text style={styles.back}>← Home</Text></Pressable>
      <Text style={styles.banner}>
        {over ? resultHeadline(game.result, game.you) : myTurn ? "Your turn" : "Opponent to move"}
      </Text>
      <Board
        fen={game.fen}
        orientation={game.you === "w" ? "white" : "black"}
        interactive={myTurn}
        yourTurn={myTurn}
        winner={winnerFromResult(game.result)}
        resultLabel={over ? resultHeadline(game.result, game.you) : null}
        onUci={(uci) => {
          sockRef.current?.send({ type: "move", gameId: game.id, uci });
          return true;
        }}
      />
      <View style={styles.row}>
        <Pressable style={styles.danger} disabled={over} onPress={() => sockRef.current?.send({ type: "resign", gameId: game.id })}>
          <Text style={styles.dangerText}>Resign</Text>
        </Pressable>
        <Pressable style={styles.btn} disabled={over} onPress={() => sockRef.current?.send({ type: "draw_offer", gameId: game.id })}>
          <Text style={styles.btnText}>Draw</Text>
        </Pressable>
      </View>
      {incomingDraw ? (
        <View style={styles.row}>
          <Text style={styles.muted}>Draw offer</Text>
          <Pressable style={styles.btn} onPress={() => { sockRef.current?.send({ type: "draw_response", gameId: game.id, accept: true }); setDrawFrom(null); }}>
            <Text style={styles.btnText}>Accept</Text>
          </Pressable>
          <Pressable onPress={() => { sockRef.current?.send({ type: "draw_response", gameId: game.id, accept: false }); setDrawFrom(null); }}>
            <Text style={styles.link}>Decline</Text>
          </Pressable>
        </View>
      ) : null}
      {error && <Text style={styles.err}>{error}</Text>}
      <Text style={styles.h2}>Chat · {game.you === "w" ? game.blackName : game.whiteName}</Text>
      <View style={styles.chat}>
        {messages.map((m) => (
          <Text key={m.id} style={m.userId === user.id ? styles.mine : styles.theirs}>
            {m.userId === user.id ? "You" : m.displayName}: {m.body}
          </Text>
        ))}
      </View>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Message"
          placeholderTextColor="#9ca3af"
          value={draft}
          onChangeText={setDraft}
        />
        <Pressable
          style={styles.btn}
          onPress={() => {
            const body = draft.trim();
            if (!body) return;
            sockRef.current?.send({ type: "chat", gameId: game.id, body });
            setDraft("");
          }}
        >
          <Text style={styles.btnText}>Send</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 12, paddingBottom: 48, backgroundColor: "#101114", minHeight: "100%" },
  back: { color: "#d4a017", marginBottom: 10, fontWeight: "700" },
  h1: { color: "#fff", fontSize: 24, fontWeight: "800", marginBottom: 12 },
  h2: { color: "#fff", fontWeight: "700", marginTop: 16, marginBottom: 8 },
  muted: { color: "#9ca3af", marginVertical: 8 },
  err: { color: "#fca5a5", marginVertical: 8 },
  input: {
    backgroundColor: "#111",
    borderColor: "#2a2d36",
    borderWidth: 1,
    color: "#fff",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  btn: { backgroundColor: "#d4a017", padding: 12, borderRadius: 8, alignItems: "center", marginVertical: 8 },
  btnText: { fontWeight: "800", color: "#111" },
  link: { color: "#d4a017", marginTop: 8 },
  banner: {
    backgroundColor: "#d4a017",
    color: "#111",
    fontWeight: "800",
    textAlign: "center",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  row: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 10 },
  danger: { backgroundColor: "#ef4444", padding: 12, borderRadius: 8 },
  dangerText: { color: "#fff", fontWeight: "700" },
  chat: {
    minHeight: 120,
    maxHeight: 180,
    backgroundColor: "#111318",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#2a2d36",
  },
  mine: { color: "#fde68a", marginBottom: 4 },
  theirs: { color: "#e5e7eb", marginBottom: 4 },
});

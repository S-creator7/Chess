import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "./Auth";
import { LocalScreen } from "./LocalScreen";
import { OnlineScreen } from "./OnlineScreen";

type Screen = "home" | "local" | "ai" | "online";

function Shell() {
  const { user, ready, logout } = useAuth();
  const [screen, setScreen] = useState<Screen>("home");
  const [gameId, setGameId] = useState<string | undefined>();

  if (!ready) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  if (screen === "local") return <LocalScreen mode="pvp" onBack={() => setScreen("home")} />;
  if (screen === "ai") return <LocalScreen mode="ai" onBack={() => setScreen("home")} />;
  if (screen === "online") {
    return (
      <OnlineScreen
        gameId={gameId}
        onBack={() => {
          setGameId(undefined);
          setScreen("home");
        }}
        onOpenGame={(id) => setGameId(id)}
      />
    );
  }

  return (
    <View style={styles.home}>
      <StatusBar style="light" />
      <Text style={styles.brand}>CHESS</Text>
      <Text style={styles.muted}>Local play works offline. Online uses the same server as the web app.</Text>
      {user ? <Text style={styles.user}>{user.displayName} · {user.rating}</Text> : null}
      <Pressable style={styles.card} onPress={() => setScreen("local")}>
        <Text style={styles.cardTitle}>Pass and play</Text>
        <Text style={styles.muted}>Two players, one device</Text>
      </Pressable>
      <Pressable style={styles.card} onPress={() => setScreen("ai")}>
        <Text style={styles.cardTitle}>Vs computer</Text>
        <Text style={styles.muted}>Offline engine</Text>
      </Pressable>
      <Pressable style={styles.card} onPress={() => setScreen("online")}>
        <Text style={styles.cardTitle}>Online + chat</Text>
        <Text style={styles.muted}>{user ? "Find a rated 10+0 game" : "Log in to play online"}</Text>
      </Pressable>
      {user ? (
        <Pressable onPress={() => void logout()}>
          <Text style={styles.link}>Log out</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: "#101114", alignItems: "center", justifyContent: "center" },
  home: { flex: 1, backgroundColor: "#101114", padding: 20, paddingTop: 64 },
  brand: { color: "#d4a017", fontSize: 28, fontWeight: "800", letterSpacing: 2, marginBottom: 8 },
  muted: { color: "#9ca3af", marginBottom: 16 },
  user: { color: "#e5e7eb", marginBottom: 16 },
  card: {
    backgroundColor: "#1a1c22",
    borderColor: "#2a2d36",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 4 },
  link: { color: "#d4a017", marginTop: 8, fontWeight: "700" },
});

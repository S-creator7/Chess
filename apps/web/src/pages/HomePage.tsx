import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export function HomePage() {
  const { user } = useAuth();
  return (
    <>
      <h1>Play chess</h1>
      <p className="muted">Local games work offline. Online play is live: matchmaking, clocks, and chat on one WebSocket. The server decides legal moves.</p>
      <div className="grid">
        <div className="card">
          <h2>Pass and play</h2>
          <p>Two players, one device. No account.</p>
          <Link to="/play/local"><button type="button">Start</button></Link>
        </div>
        <div className="card">
          <h2>Vs computer</h2>
          <p>Offline engine on this device.</p>
          <Link to="/play/ai"><button type="button">Start</button></Link>
        </div>
        <div className="card">
          <h2>Online 10+0</h2>
          <p>{user ? `Live rated games + chat as ${user.displayName}` : "Account required for live games and chat."}</p>
          <Link to="/play/online"><button type="button">Play online</button></Link>
        </div>
      </div>
    </>
  );
}

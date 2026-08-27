import { Link, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { HistoryPage } from "./pages/HistoryPage";
import { HomePage } from "./pages/HomePage";
import { LocalGame } from "./pages/LocalGame";
import { LoginPage } from "./pages/LoginPage";
import { OnlineGame, OnlineLobby } from "./pages/OnlinePages";

export function App() {
  const { user, ready, logout } = useAuth();
  if (!ready) return <div className="layout">Loading…</div>;

  return (
    <div className="layout">
      <nav className="nav">
        <Link to="/"><strong>CHESS</strong></Link>
        <div className="nav-links">
          <Link to="/play/local">Local</Link>
          <Link to="/play/ai">Computer</Link>
          <Link to="/play/online">Online</Link>
          {user ? <Link to="/history">History</Link> : null}
          {user ? (
            <>
              <span className="muted">{user.displayName} · {user.rating}</span>
              <button className="secondary" type="button" onClick={() => void logout()}>Log out</button>
            </>
          ) : (
            <Link to="/login">Log in</Link>
          )}
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
        <Route path="/play/local" element={<LocalGame mode="pvp" />} />
        <Route path="/play/ai" element={<LocalGame mode="ai" />} />
        <Route path="/play/online" element={<OnlineLobby />} />
        <Route path="/play/online/:id" element={<OnlineGame />} />
        <Route path="/history" element={<HistoryPage />} />
      </Routes>
    </div>
  );
}

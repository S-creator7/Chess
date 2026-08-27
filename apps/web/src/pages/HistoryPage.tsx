import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthProvider";

type Row = {
  id: string;
  timeControl: string;
  status: string;
  result: string | null;
  createdAt: string;
  white: { displayName: string; rating: number };
  black: { displayName: string; rating: number };
};

export function HistoryPage() {
  const { user } = useAuth();
  const [games, setGames] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .games()
      .then((res) => setGames(res.games as unknown as Row[]))
      .catch((err: Error) => setError(err.message));
  }, [user]);

  if (!user) return <p>Log in to see history.</p>;

  return (
    <div className="card">
      <h2>Game history</h2>
      {error && <p className="error">{error}</p>}
      {games.length === 0 && <p className="muted">No games yet.</p>}
      <ul>
        {games.map((g) => (
          <li key={g.id}>
            <Link to={`/play/online/${g.id}`}>
              {g.white.displayName} vs {g.black.displayName} · {g.timeControl} · {g.result ?? g.status}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

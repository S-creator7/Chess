import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { api, tokenStore } from "../api/client";

export function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <div className="card">
        <h2>Account</h2>
        <p>Log in to manage your account.</p>
        <Link to="/login">Log in</Link>
      </div>
    );
  }

  async function remove() {
    if (!window.confirm("This permanently disables your account. Continue?")) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount(password);
      tokenStore.clear();
      await logout().catch(() => undefined);
      navigate("/");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Account</h2>
      <p>
        {user.displayName} · {user.email} · rating {user.rating}
      </p>
      <button type="button" className="secondary" onClick={() => void logout()}>
        Log out
      </button>
      <h3>Delete account</h3>
      <p className="muted">Required for Google Play. Your login is disabled. Past games keep a “Deleted player” name for opponents.</p>
      <div className="form">
        <input type="password" placeholder="Confirm with password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="error">{error}</p>}
        <button type="button" className="danger" disabled={busy || password.length < 8} onClick={() => void remove()}>
          Delete my account
        </button>
      </div>
    </div>
  );
}

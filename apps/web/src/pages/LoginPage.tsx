import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, displayName);
      navigate("/play/online");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="card">
      <h2>{mode === "login" ? "Log in" : "Create account"}</h2>
      <form className="form" onSubmit={onSubmit}>
        {mode === "register" && (
          <input placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required minLength={2} />
        )}
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password (8+)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        {error && <p className="error">{error}</p>}
        <button type="submit">{mode === "login" ? "Log in" : "Register"}</button>
        <button
          type="button"
          className="secondary"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Need an account?" : "Have an account?"}
        </button>
        <Link to="/">Back</Link>
      </form>
    </div>
  );
}

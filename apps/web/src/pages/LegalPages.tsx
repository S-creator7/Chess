import { Link } from "react-router-dom";

export function PrivacyPage() {
  return (
    <div className="card legal">
      <h1>Privacy policy</h1>
      <p className="muted">Last updated: 28 August 2026</p>
      <p>
        Chess Live (“the app”, web and Android) is operated for online and offline chess. This policy explains what we
        collect and why.
      </p>
      <h2>Data we collect</h2>
      <ul>
        <li>Account: email, display name, password hash (we never store the raw password).</li>
        <li>Play: game moves, clocks, ratings, and in-game chat for games you join.</li>
        <li>Device: tokens used to keep you signed in.</li>
      </ul>
      <h2>How we use it</h2>
      <p>To run matchmaking, live games, chat, ratings, and to keep your session secure. We do not sell your data.</p>
      <h2>Sharing</h2>
      <p>Opponents see your display name, rating, moves, and chat in a shared game. We do not show your email to them.</p>
      <h2>Retention and deletion</h2>
      <p>
        You can delete your account in the app or on the <Link to="/account">Account</Link> page. We disable login and
        replace your public name with “Deleted player”.
      </p>
      <h2>Contact</h2>
      <p>Use the GitHub repository for this project to request support: github.com/S-creator7/Chess</p>
    </div>
  );
}

export function TermsPage() {
  return (
    <div className="card legal">
      <h1>Terms of use</h1>
      <p className="muted">Last updated: 28 August 2026</p>
      <p>By using Chess Live on web or Android you agree to play fairly, not abuse chat, and not automate play to distort ratings.</p>
      <p>The service is provided as-is. Online play needs a network connection. Local play works offline without an account.</p>
      <p>
        See the <Link to="/privacy">privacy policy</Link> for how account data is handled.
      </p>
    </div>
  );
}

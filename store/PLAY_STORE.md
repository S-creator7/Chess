# Google Play + web portal

Package name: `com.screator7.chess`  
App name: Chess Live  
Version: 1.0.0 (versionCode 1)

## Store listing

Use `store/feature-graphic.png` (1024×500) in Play Console → Store listing → Feature graphic.  
Use `apps/mobile/assets/icon.png` for the high-res icon (512×512).

**Short description (80 chars max)**  
Play chess locally or online with clocks, ratings, and live chat.

**Full description**  
Chess Live is a chess app for Android and the web.

- Pass and play on one device, no account  
- Play the computer offline  
- Rated online games with live clocks  
- In-game chat on the same live connection as moves  

Create an account only if you want online play. You can delete your account from the home screen (Android) or the Account page on the web portal.

Privacy: /privacy.html on your deployed web portal  
Account deletion: in-app (password required)

## Web portal

1. Copy `.env.example` and set long JWT secrets. Set `WEB_ORIGIN` to your public site origin (comma-separated if you have more than one).
2. Deploy:

```bash
export JWT_ACCESS_SECRET=...   # ≥ 32 chars
export JWT_REFRESH_SECRET=...
docker compose -f docker-compose.prod.yml up -d --build
```

The site is served on port 80. API routes (`/auth`, `/games`, `/ws`, …) are proxied to the API. Point a domain at this host and put the same origin in `WEB_ORIGIN`.

3. After it is live, put that HTTPS URL in Play Console as the privacy policy, and in `apps/mobile/eas.json` (`EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_WS_URL`). Also update `PRIVACY_URL` in `apps/mobile/src/App.tsx` if you are not using GitHub Pages.

## Android AAB (Play Store)

1. Install EAS: `npm i -g eas-cli` then `eas login`
2. From `apps/mobile`: `eas init` (creates an Expo project id)
3. Replace `REPLACE_WITH_YOUR_WEB_PORTAL` in `eas.json` with `https://your-domain` and `wss://your-domain/ws`
4. `pnpm --filter @chess/mobile build:android`
5. Download the `.aab` from Expo and upload it in Play Console (internal testing first)
6. Fill Data safety: email, name, gameplay, chat; account deletion available in app

You need a Google Play Developer account ($25 one-time).

# Chess

Local and online chess on **web** and **Android (Expo)**. Shared rules (`chess-core`) and API client.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Expo Go on a phone (optional) or Android emulator
- Docker (only for the production web portal)

Local development uses **SQLite**.

## Setup

```bash
cp .env.example apps/api/.env
pnpm install
pnpm db:generate
pnpm db:push
pnpm test
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:3001
- Mobile: `pnpm dev:mobile` then scan the QR code in Expo Go

For a physical phone, set `apps/mobile/.env` to your computer’s LAN IP:

```
EXPO_PUBLIC_API_URL=http://192.168.x.x:3001
EXPO_PUBLIC_WS_URL=ws://192.168.x.x:3001/ws
```

Local play does not require an account. Online play and live chat require register/login.

## Google Play and web portal

See [store/PLAY_STORE.md](store/PLAY_STORE.md) for listing copy, privacy/account-deletion, Docker deploy, and the Android AAB (`com.screator7.chess`).

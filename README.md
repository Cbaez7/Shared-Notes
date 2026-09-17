# SharedNotes

A private, cross-platform note app built for iPhone Safari and desktop browsers. Notes are saved locally first, then synced to a server whenever a connection is available.

## What it includes

- Email/password accounts with bcrypt password hashing and a JWT stored in an httpOnly cookie.
- SQLite-backed REST API with parameterized queries, rate-limited authentication, zod validation, and soft-deleted notes.
- Offline-ready React PWA: IndexedDB cache, instant local writes, background sync every 30 seconds, and sync on focus or reconnection.
- Desktop split view and a mobile list-to-editor experience.
- Server-authoritative timestamps and last-write-wins conflict handling. Older edits are rejected so a client can pull the server copy.

## Run locally

Requires Node.js 20 or newer and a compiler toolchain appropriate for `better-sqlite3` if a prebuilt binary is not available.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The API runs on `http://localhost:3001`; Vite proxies `/api` so cookies work in development.

To run the integration smoke test:

```bash
npm run test:smoke
```

It verifies registration, login, creating a note, and pulling that note as a second device.

## Production deployment

1. Copy `.env.example` to `.env`, set a long random `JWT_SECRET`, a persistent `DATABASE_PATH`, and `CLIENT_ORIGIN` to the HTTPS client origin.
2. Run `npm run build`.
3. Serve `client/dist` from any HTTPS static host and run `node server/dist/index.js` behind a TLS-enabled reverse proxy. Route `/api/*` to the server, or adjust the client's API base URL to point to it.
4. Back up the SQLite database file (including WAL files while the service is active). The schema uses portable text UUID/timestamp columns and straightforward relational tables, so moving to Postgres is a direct table/query migration.

HTTPS is required for service workers and for iPhone's **Add to Home Screen** installation flow. In production, the session cookie is automatically marked `Secure`.

## API

The server exposes both the documented routes and an `/api`-prefixed version for the Vite proxy:

- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- `GET /notes?since=<ISO timestamp>` for changed records, including soft deletes
- `PUT /notes/:id` for UUID-based upsert
- `DELETE /notes/:id` for soft deletion

All note writes return an authoritative `updated_at`. A stale write returns `409` with the server note; unauthenticated API calls return `401` so the client can return to sign-in.

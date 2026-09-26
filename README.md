# GuestMoments

Phase 1 foundation: Next.js, Greek and English, and a Postgres connection check. No accounts or events yet.

## Run

1. Copy `.env.example` to `.env`.
2. Start Postgres: `docker compose up -d`
3. Install and generate the client: `npm install` then `npm run db:generate`
4. Check the database: `npm run db:check`
5. Start the app: `npm run dev`

Greek is the default at `/`. English is at `/en`. Guest links stay at `/e/{code}` with no language prefix.

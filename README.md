# GuestMoments

Phase 2 identity: accounts, sessions, and password reset. Greek is the default language. English is at `/en`.

## Run

1. Copy `.env.example` to `.env` and set `BETTER_AUTH_SECRET`, `OWNER_EMAIL`, and `OWNER_PASSWORD`.
2. Start Postgres: `docker compose up -d`
3. Install dependencies: `npm install`
4. Create the identity tables: `npx prisma migrate dev`
5. Check the database: `npm run db:check`
6. Create the owner account: `npm run db:seed`
7. Start the app: `npm run dev`

Registration, login, password reset, and account details are at `/register`, `/login`, `/forgot-password`, `/reset-password`, and `/account`. English uses the same paths under `/en`. Guest links stay at `/e/{code}` with no language prefix.

Without `RESEND_API_KEY`, password reset links are printed in the server log. The reset email follows the account's saved language.

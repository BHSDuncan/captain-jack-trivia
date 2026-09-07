# Captain Jack Trivia

A mobile-first monthly trivia competition for Captain Jack, built with SvelteKit, TypeScript, Vercel Node functions and MongoDB Atlas. The player interface uses charcoal, aged brass, maritime linework and locally hosted typography. No payments, email, SMS, or prize redemption ledger are included.

## Run locally

Use Node 24 and a MongoDB replica set (Atlas works; standalone MongoDB cannot execute the transactions this app requires).

1. Run `npm ci`.
2. Create `.env` using `.env.example` and fill the development Atlas URI, database name and authentication secret. The Vite configuration loads it for local development.
3. Run `npm run db:indexes` before accepting any players.
4. Set `ADMIN_EMAIL`, `ADMIN_NAME` and `ADMIN_PASSWORD` in your shell or local `.env`, then run `npm run admin:create`. Repeat for the second administrator. Use a password of at least 12 characters. Remove these bootstrap variables after use; never commit credentials.
5. Run `npm run dev` and visit `http://127.0.0.1:5173`. Administration is at `/admin`.

Without a database configured, the home page shows a branded preparation screen. To run a disposable, fully seeded demonstration on port 5173, use `node --import tsx scripts/test-server.ts`. It starts a temporary MongoDB replica set, seeds demo questions, and creates `owner@example.org` with the **local demo only** password `Captain-test-password-123!`. All demo data disappears when stopped. Never deploy this script or its fixture credentials.

`npm run admin:reset` uses the same email/password environment inputs to change an administrator password and revoke their sessions. There is no public administrator signup or password-reset endpoint.

## Verification

```sh
npm run check
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Unit and integration tests start their own temporary MongoDB replica set; the first run may download MongoDB. Browser tests start two isolated local environments on ports 5173 and 5174 and require those ports to be free. They emulate desktop and mobile Chromium, including the production network gate. Neither test suite uses your configured Atlas data. Browser traces and screenshots are saved under ignored `test-results/`.

Production setup, operating rules and remaining on-site validation are in [docs/operations.md](docs/operations.md). Internal boundaries and collection invariants are in [docs/architecture.md](docs/architecture.md).

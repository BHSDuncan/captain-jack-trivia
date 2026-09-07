# Operating Captain Jack Trivia

## Configuration and deployment

Deploy the repository as a SvelteKit project on Vercel using Node 24. The adapter builds the app's server functions for that runtime.

### Where configuration goes

Environment variables are settings read by the server, not fields entered by players or admins in the app. For ordinary local development, create a `.env` file using `.env.example` as a starting point and replace its placeholders. For a deployment, configure the variables in the Vercel project's environment settings, with separate values for Preview and Production. Do not commit `.env` or expose these settings through browser code.

`npm run demo` is different: `scripts/test-server.ts` supplies its own local settings and starts a disposable MongoDB database. It does not use your Atlas configuration. Restarting the demo creates fresh sample data; it is not a durable deployment.

### Database settings

- `MONGODB_URI` — **Where and how to connect to MongoDB.** Obtain the connection string from Atlas for the cluster and database user you intend to use. It includes the server address and usually a database username/password, so treat the whole value as a secret. The example in `.env.example` points to a local MongoDB replica set; it does not create one. Both local and Atlas databases must support transactions (a standalone local MongoDB server is insufficient).
- `MONGODB_DB` — **Which database inside that MongoDB server stores this app's records.** Choose a name such as `captain_jack_dev` for development/previews and `captain_jack_prod` for production. The app uses this setting to select the database, even if the connection string contains a database name. Allowed characters are letters, digits, underscores and hyphens. Collection names stay the same in each database.
- `PRODUCTION_DB` — **A safety check identifying the production database name, not a second connection or a switch.** It defaults to `captain_jack_prod` if omitted. Keep it set to the same production name in every environment. When running in production, `MONGODB_DB` must equal this name; everywhere else, it must differ. A mismatch stops database access. If you choose a different production name, update this setting in development and previews too.
- `VERCEL_ENV` — **Which deployment environment the server is running in.** Vercel supplies this value; do not manually override it on Vercel. The app treats exactly `production` as production. Local development normally leaves it unset, and previews use `preview`. This setting controls both the database-name safety check and the bar Wi-Fi restriction. For a local operator command intentionally targeting production, explicitly set it to `production` as described below.

For example, with the default production database name:

| Setting         | Local development / preview                           | Production                                      |
| --------------- | ----------------------------------------------------- | ----------------------------------------------- |
| `MONGODB_URI`   | Connection with development-only database permissions | Connection with production database permissions |
| `MONGODB_DB`    | `captain_jack_dev`                                    | `captain_jack_prod`                             |
| `PRODUCTION_DB` | `captain_jack_prod`                                   | `captain_jack_prod`                             |
| `VERCEL_ENV`    | Unset locally; `preview` on Vercel previews           | `production`                                    |

Use separately permissioned database credentials for development and production; the name check alone cannot enforce database permissions. Configure Atlas network access to allow the app server to connect, and choose an application region near the database and bar.

### Administrator authentication settings

- `BETTER_AUTH_SECRET` — **A private cryptographic key used by administrator authentication.** Generate a random value of at least 32 characters; it is not an administrator's login password. Use different secrets for development and production, and keep each stable across restarts/deployments. Changing it can invalidate existing admin sessions. The app rejects a missing or shorter value when initializing admin authentication.
- `BETTER_AUTH_URL` — **The base address at which the app is accessed.** Include the scheme and, locally, the port: `http://127.0.0.1:5173`. For production, use the actual HTTPS app address, such as `https://trivia.example.org`. Do not append `/admin` or `/api/auth`. Previews need their own actual app address, not the production address. Keep the configured hostname consistent with the address you use in the browser; `localhost` and `127.0.0.1` are different origins.

### Bar Wi-Fi and scheduled-check settings

- `BAR_DDNS_HOSTNAME` — **The dynamic-DNS name that points to the bar's public internet address.** Obtain this from whoever configures the bar's router or dynamic-DNS service. Enter only a hostname, such as `captain-jack.example.org`, without `https://`, a port or a path. This is not the Wi-Fi network name or the trivia website address. In production, the app resolves this hostname and compares its addresses with the player's public IP. If it is missing, cannot resolve, or does not match, registration/sign-in and gameplay are denied. Local development and previews skip this check; authenticated administration is not restricted by it. Verify the actual bar connection before launch.
- `CRON_SECRET` — **A private password for the scheduled contest-finalization endpoint.** Generate another random value, separate from `BETTER_AUTH_SECRET`, and configure it for the production deployment. `/api/cron` requires the request header `Authorization: Bearer <CRON_SECRET>`; a missing or incorrect value returns `401 Unauthorized`. This protects the endpoint from unauthenticated callers. It is not an admin password, and players never need it. The normal-request finalization check still works if the scheduled endpoint is unavailable.

Use a password manager's random-password generator for the two secrets; do not reuse the placeholder values in `.env.example` or the demo's built-in test secrets.

### Operator-only settings and commands

These additional settings are for running account-management commands, not for the deployed app:

| Variable         | Meaning                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `ADMIN_EMAIL`    | The administrator's login email. Creation adds this account; reset finds the existing account by this email. No email is sent.  |
| `ADMIN_PASSWORD` | The administrator's initial or replacement password, at least 12 characters. The command stores a hash, not the plain password. |
| `ADMIN_NAME`     | Optional display name when creating an administrator; defaults to `Captain`. Password reset does not change the name.           |

`npm run db:indexes` prepares database indexes. `npm run admin:create` creates one named admin account (up to two). `npm run admin:reset` replaces an existing admin's password and revokes that admin's sessions. These commands load `.env` and use `MONGODB_URI`, `MONGODB_DB` and the environment safety settings above to determine which database they change. Supply account credentials only for the operator command, and remove temporary plain-text password settings afterwards.

Run the index and admin bootstrap commands against each intended environment before opening the app. For an operator command targeting production, explicitly set `VERCEL_ENV=production`, the correct production database name, URI, and authentication configuration in the local operator environment. Production commands are intentionally not inferred from the URI. Keep those secrets out of version control and shell history. Use `npm ci` for deployment to respect the committed dependency lockfile.

### Daily check for contests awaiting finalization

The included schedule calls `/api/cron` daily at 05:05 UTC. This is a backup check for contests whose closing time has passed but whose final scores and winners have not yet been saved. It does not determine when players must stop answering.

Normal server requests also check for expired contests and finalize their results before returning a response. Gameplay separately enforces the configured deadlines, so a missed scheduled check never permits late answers. If nobody visits and the scheduled check has not run, the saved final standings and winner list may remain pending until the next check or request. Repeating the check is safe: already-finalized contests are not finalized again. Monitor Vercel errors and database connectivity if results are not appearing as expected.

## Preparing a month

1. Sign in at `/admin`, select **New contest**, enter month, dates in Toronto time, prize, rules, weekly quota and default timer. Defaults are five questions per period and 20 seconds per question.
2. Save the draft. Add text questions with 2–6 distinct choices, one correct choice and an optional 5–120 second timer override. The editor includes a read-only preview.
3. Verify all questions and rules. Publishing validates that every question will unlock by closing and that no other published contest overlaps it. One contest per month is permitted.
4. Confirm **Publish contest**. Its questions and scoring settings are frozen. A future scheduled contest can return to draft before its start time. Active questions cannot be corrected in place.
5. Messages remain editable after publishing. The private winner message supports `{nickname}` and `{month}`. Provide concrete instructions appropriate to the actual prize.

Weekly periods are seven Toronto calendar days from the start time, including daylight-saving changes. Period one begins immediately. A partial final period receives its full allowance. Allowances accumulate for everyone, including late registrants. Opening a question consumes one attempt; simply leaving the page does not undo it. Participants can stop between questions.

The timer starts on the server when a question is issued and stops when an answer reaches the server. Latency is included; the browser clock cannot create extra time. A question near closing receives only the remaining contest time. Refreshes, offline periods and pauses do not extend deadlines. An expired answer scores zero. A pause rejects new questions and submissions; reopening a paused contest does not restore timed-out questions.

## Winners and exceptions

Final standings use correct count descending, then total response milliseconds on correct answers ascending. Equal values receive equal rank and share the fixed prize, including a tie at zero correct answers. A contest with no attempts has no winner. An admin can inspect attempts, scores, identity activity and history, but cannot overwrite a score.

The winner sees a private congratulations screen with nickname, month and configurable instructions on their next authenticated visit. This is an ordinary in-app page/message, not a push notification. Signing in works away from the bar only if a player already has a valid session; registration and new sign-ins require the bar network. Winner/result pages and public standings can be read remotely. There is no prize-claimed state. Showing this screen is informal proof, not protection against a screenshot forgery.

Early closing finalizes immediately. Reopening requires a new future end and explicit confirmation; it removes the final result snapshot and withdraws winner notices until the next close. All prior attempts remain. **Answers may already have been revealed after the first close**, so reopening carries a fairness cost explained in the admin screen. Use it only when that tradeoff is acceptable.

Live correct-answer totals necessarily allow someone to infer correctness by comparing their score before and after a submission. The implementation withholds correct options and per-question feedback until close, but cannot eliminate this inference while retaining live scores. Equal-score leaderboard rows are alphabetic so hidden tie-break timing is not revealed indirectly through their order.

## Identity and network limitations

An opaque random browser cookie discourages a second registration from the same browser. It is not hardware fingerprinting and does not prove one person per account. Clearing storage, private browsing, or changing devices can bypass it. Nickname plus six-digit PIN permits signing in elsewhere; those credentials should be kept privately. There is no player email/phone recovery. Admin activity shows failed login attempts, new devices, shared-device logins and excessive gameplay request flags.

The network gate checks only Vercel's protected `x-vercel-forwarded-for` value, normalizes IPv4/mapped IPv4/IPv6, and compares it to DNS A/AAAA records. Successful DNS results are cached for at most 30 seconds; failures deny play and retry shortly. There is no stale-address fallback. Deploy directly on Vercel without an additional reverse proxy that changes client identity.

An IPv6 device address will not necessarily equal a router's DDNS AAAA address. VPNs and private relays also change visible egress. Confirm the actual guest Wi-Fi behavior on both iPhone and Android before launch. The UI explains how to reconnect. Local development and Vercel previews bypass the gate; previews must therefore contain only development data and should use Vercel deployment protection.

## Launch validation that needs the bar

- Supply the real DDNS hostname, logo if available, prize language, owner-approved rules and winner instructions.
- On actual guest Wi-Fi, register and play from Android and iPhone. Repeat off Wi-Fi, with VPN/private relay enabled, and after a DDNS address change.
- Verify production admin access remotely and confirm preview cannot connect to the production database.
- Verify Atlas backup/restore settings, logs and deployment secrets; run index initialization before opening registration.
- Check a complete timed round with an older phone, keyboard navigation and a screen reader. Automated accessibility checks supplement rather than replace this physical-device review.
- Run a test contest through close, winner display and admin history. No real prize or paid play should be inferred from local fixture testing.

No live Atlas database, production Vercel deployment, real bar network or physical older phone is provisioned by the repository's local verification.

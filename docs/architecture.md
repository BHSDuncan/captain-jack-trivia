# Application boundaries

SvelteKit server loads and named form actions are the application interface. `/join`, `/play/[id]`, `/leaderboard`, `/history` and `/history/[id]` serve players. `/admin` and its descendants enforce Better Auth sessions on every load and mutation. `/api/auth/*` is Better Auth's handler with public signup disabled. `/api/cron` accepts only a configured bearer secret.

`src/lib/server/domain.ts` defines validation, Toronto-time conversion, quota arithmetic, stable permutations and ranking. `contests.ts` implements transactions, question issuance, scoring, lifecycle and finalization. `identity.ts` owns salted scrypt PIN hashes, hashed random session/device tokens, throttling and audit records. `network.ts` is the DNS/IP boundary. Correct answers remain in these server-only modules and database snapshots until close.

## Persistence invariants

| Collection                                            | Invariant                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `contests`                                            | Unique month; frozen published question set; revision serializes mutations                 |
| `questions`                                           | Draft editor records associated with one contest                                           |
| `players`                                             | Unique case-insensitive nickname key; salted PIN hash                                      |
| `playerSessions`                                      | Hashed opaque session identifier; explicit expiry checks plus TTL cleanup                  |
| `devices`                                             | Unique hashed opaque device credential linked to first registered player                   |
| `attempts`                                            | Unique player/contest/question; partial unique index permits one active attempt per player |
| `contestResults`                                      | One final snapshot per contest; ranked rows and all co-winner IDs                          |
| `auditEvents`                                         | Timestamped lifecycle, editing and identity activity; no raw PINs, session tokens or IPs   |
| `rateLimits`                                          | Hashed fixed-window keys and atomic counters, TTL cleanup                                  |
| `locks`                                               | Serialization of contest publication and administrator bootstrap                           |
| Better Auth `user`, `account`, `session`, `rateLimit` | Named administrators, hashed passwords and revocable sessions                              |

Every question-start, answer and lifecycle transaction increments the contest revision before reading contest state. This makes racing answer/finalization/pause operations conflict and retry within MongoDB rather than accepting a stale contest state. A partial unique active-attempt index also protects against duplicate tabs. Transactions commit question state and audit records together. Publication additionally locks the schedule directory to reject overlapping published periods.

An attempt contains an immutable question snapshot, stable option order, server start/deadline, final answer and elapsed time. Only the question text, visible options, attempt ID and deadline are returned while playing. Public active standings exclude player IDs, tie-break milliseconds and computed rank. Final rows are rebuilt deterministically from attempts; sessions and cached UI values cannot change scores. Answer retries are idempotent once committed.

Deadlines and session expiry are checked during reads/writes; MongoDB TTL removal and Vercel cron precision never determine eligibility. Expired active attempts become timeout records on the next start/submission or contest close. No WebSockets or persistent processes are required.

All unsafe HTTP methods require a same-origin `Origin` header, including during local development. Every admin action checks its session independently of layout rendering. Player registration, sign-in, question loads, question starts and submissions enforce the network gate. Public winner/history reads remain available to a remembered player outside the bar. Responses are private/no-store; fonts are bundled locally.

## Testing and deployment boundary

Integration tests use a real disposable MongoDB replica set and exercise concurrent transactions, session expiry, index uniqueness, immutable answers, operator bootstrap/reset, exact ties and finalization recovery. Browser tests use independently seeded local preview and production-like servers, with separate databases, to exercise actual pages and form requests. Production-like headers in this local test environment simulate the Vercel boundary; a real deployment must still verify the platform header and bar egress.

The Vercel build can report unresolved optional MongoDB integrations (Kerberos, cloud credential providers, optional compressors/encryption) and optional OpenTelemetry instrumentation. Standard Atlas username/password connections do not require those optional packages.

The package override keeps SvelteKit's transitive `cookie` dependency on the compatible patched 0.7 release line to address GHSA-pxg6-pf52-xh8x; the browser/session regression tests cover this boundary.

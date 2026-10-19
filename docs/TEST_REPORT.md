# Validation report

Validated on **18 October 2026** in a Linux environment with **Node.js 24.19.0** and **npm 11.9.0**. The lockfile records the exact installed dependency versions.

## Results

| Check                                                                   | Result                                                               |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| TypeScript strict checking (`npm run typecheck`)                        | Passed                                                               |
| Frontend compilation (`npm run build`)                                  | Passed                                                               |
| Backend HTTP/database integration tests (`npm test`)                    | **14 passed, 0 failed**                                              |
| React interaction tests against real HTTP API (`npm run test:ui`)       | **4 passed, 0 failed**                                               |
| Combined verification command (`npm run check`)                         | Passed                                                               |
| Production dependency audit (`npm audit --omit=dev --audit-level=high`) | 0 reported vulnerabilities at validation time                        |
| Linux launcher shell syntax                                             | Passed                                                               |
| Node startup/development/backup script syntax                           | Passed                                                               |
| Interactive administrator creation                                      | Passed; verified persisted administrator role                        |
| Online SQLite backup                                                    | Passed; backup integrity and saved administrator record verified     |
| Public-interface demo guard                                             | Passed; startup refused public binding with demo credentials enabled |
| Windows launcher                                                        | Supplied with CRLF line endings; not run on a Windows machine        |
| Docker build / Compose runtime                                          | Configuration supplied; not executed here                            |
| Real-browser visual/device QA                                           | Not run; browser-control capability was unavailable                  |

The React tests use **jsdom** with Testing Library and the actual Express API on an ephemeral local port. They verify user interactions and persisted state, but they do not establish pixel-perfect rendering, browser layout, touch behavior, or accessibility certification. The test bridge adapts jsdom cancellation signals to Node's fetch API and forwards the session cookie; production browser code uses native fetch/cookies directly.

The compiled frontend is approximately **293.5 kB JavaScript (90.3 kB gzip)** and **38.0 kB CSS (8.7 kB gzip)**, plus local food assets. Build sizes are informational, not a network-performance benchmark.

## Backend coverage

1. Restaurant catalog/search, bundled assets, static frontend, and response security headers.
2. Registration, password hashing, protected session cookies, logout and token invalidation.
3. CSRF rejection, cross-origin rejection, and administrator access checks.
4. Basket persistence, duplicate detection, mixed-kitchen rejection, quantity validation, atomic invalid-update behavior.
5. Address ownership, editing, deletion and default-address invariants.
6. Authoritative integer pricing, coupon minimums/caps, delivery thresholds, and rejection of tampered totals.
7. Atomic order creation, identical-request replay, idempotency conflict, immutable price/address snapshots, first-order coupon eligibility.
8. Complete fulfillment state machine, order ownership, cash collection, verified review, aggregate rating and audit records.
9. Early cancellation, terminal-state enforcement and first-order eligibility after cancellation.
10. Menu creation/editing, stock availability, restaurant closing, offer activation and audit persistence.
11. Favorites, profile updates, password changes and revocation of other sessions.
12. Login rate limits and expired-session rejection.
13. SQLite persistence, migration idempotence and integrity across a new connection.
14. Non-demo initialization and Secure cookie configuration.

## Interface coverage

1. Administrator signs in, creates a menu item, updates its availability, and observes persisted results.
2. Customer searches, filters cuisine, saves a favorite, opens a menu, and applies its vegetarian filter.
3. Customer signs in, adds a dish, chooses a saved address, applies FIRSTBITE, accepts the correct total, and places an order. The admin advances it through actual API status updates. The customer sees the delivered state and posts a verified review.
4. Guest basket persists, changing kitchens requires confirmation, and signing in transfers that basket into the account.

## Repeat the checks

From the project root after `npm ci`:

```bash
npm run check
```

API tests create isolated databases. UI tests use their own in-memory database. Neither test suite modifies your configured `data/foodio.sqlite` file.

Before operating a real food-delivery service, complete actual-browser responsive/accessibility QA, Windows/Docker verification in the intended environment, deployment-specific security review, realistic concurrency/load tests, restore drills, and the business-specific integrations described in `DEPLOYMENT.md`. No production capacity or security certification is claimed by these checks.

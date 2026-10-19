# FOODIO — Good food. Good mood.

A full-stack food-ordering application inspired by the supplied FOODIO case-study screens. Includes the responsive customer storefront, an administrator workspace, a real HTTP API, persistent SQLite data, original bundled food illustrations, and automated tests.

Prepared for **Shivam Singh · MathTech**.

**Stack:** React + TypeScript + Vite on the frontend; Express + Node.js 24 + SQLite on the backend. One server serves the API and the compiled frontend. You do **not** need MySQL, PostgreSQL, MongoDB, Python, or a separate database installation.

## 1. Start on Windows — easiest method

1. Install **Node.js 24.x LTS** from [nodejs.org](https://nodejs.org/). Keep “Add to PATH” enabled. This project specifically uses Node 24’s built-in SQLite support.
2. Extract the ZIP completely. Do not run files from inside the compressed-folder viewer.
3. Open the extracted `foodio-fullstack` folder.
4. Double-click **`START-WINDOWS.bat`**.
5. The script creates `.env`, installs dependencies, builds the frontend, and starts the application.
6. When the terminal says FOODIO is running, open **http://localhost:3000** in your browser.
7. Keep the terminal open while using the app. Press **Ctrl+C** to stop it.

The first installation needs internet access to download npm packages. After installation, the app, database, icons, and food illustrations work locally without external services. The ZIP does not include `node_modules`; they are installed for your operating system.

### Windows PowerShell alternative

Open PowerShell inside the extracted project folder, then run:

```powershell
node --version
npm.cmd --version
Copy-Item .env.example .env
npm.cmd ci
npm.cmd run build
npm.cmd start
```

`node --version` must begin with `v24.`. If `.env` already exists, keep it rather than copying over your settings. Using `npm.cmd` avoids PowerShell's `npm.ps1` execution-policy issue.

Open **http://localhost:3000**. On later runs, just use `npm.cmd start`, or the batch launcher.

## 2. Start on macOS or Linux

Install Node.js 24.x LTS, extract the project, and open a terminal in its folder:

```bash
bash start.sh
```

Or run the commands directly:

```bash
cp .env.example .env
npm ci
npm run build
npm start
```

Open **http://localhost:3000**. Do not open `index.html` directly: authentication and ordering require the backend.

## 3. Demo accounts

The default local configuration has `DEMO_MODE=true`. Two sample accounts are created on first startup:

| Role          | Email                   | Password         |
| ------------- | ----------------------- | ---------------- |
| Customer      | `customer@foodio.local` | `Customer@12345` |
| Administrator | `admin@foodio.local`    | `Admin@12345`    |

The sign-in page has buttons that fill these credentials; click **Sign in** afterward. You can also register a new customer account. New customers can add their own delivery addresses.

**These credentials are public demo credentials.** Demo mode binds to the local computer only. For real deployment, use a fresh database, disable demo mode, and create your own administrator. See [deployment](docs/DEPLOYMENT.md).

## 4. Try the complete order flow

1. Sign in as the sample customer.
2. Explore **The Green Bowl** or add **Harvest grain bowl** from the home page.
3. Open your basket and select **Continue to checkout**.
4. Use the sample Home address or create another address.
5. Enter **FIRSTBITE** and select **Apply**. It gives 20% off food, capped at ₹100, with a minimum food subtotal of ₹199, on your first non-cancelled order.
6. Review the total, then **Place order**. Payment is **cash on delivery**.
7. The order is saved and its tracking page opens.
8. Open a **different browser or a private window** and sign in as the administrator. Separate windows in the same normal browser profile share the same login cookie.
9. Open **Kitchen desk → Order desk**. Confirm the order, then move it to **In the kitchen**, **On the way**, and **Delivered**. The final step explicitly confirms cash collection.
10. The customer's tracking page updates within **8 seconds**. You can now submit a verified review and download the order receipt.

Orders do not advance automatically. The administrator records the actual workflow. There is no simulated courier movement presented as live GPS.

## 5. What is implemented

### Customer application

- Responsive desktop, tablet, and mobile layouts; mobile navigation and basket drawer.
- Restaurant and dish search, cuisine categories, vegetarian filters, and sorting.
- Six sample kitchens and 28 menu items, seeded once into SQLite.
- Restaurant menus, availability indicators, and genuine reviews from delivered orders.
- Registration, login/logout, persistent sessions, profile editing, and password changes.
- Saved restaurant favorites.
- Local guest basket; server-side saved basket for signed-in customers.
- Quantity limits, removal, basket clearing, and confirmation before switching kitchens.
- Address creation, editing, deletion, default address, and checkout selection.
- Offer listing, promo-code application, backend-calculated prices and delivery charges.
- Cash-on-delivery checkout with idempotency protection against duplicate submissions.
- Order history, tracking timeline, early cancellation, verified reviews, and text receipt download.

### Administrator application

- Role-protected dashboard with order counts, active orders, customers, and delivered-order receipts.
- Order queue and enforced state transitions.
- Menu creation and editing, prices, categories, food illustrations, vegetarian flags, featured flags, and availability.
- Open/pause individual kitchens.
- Activate/deactivate seeded offers.
- Persistent audit records for administrative changes.

### Backend and data

- SQLite database with versioned migrations, foreign keys, transactions, WAL mode, and indexes.
- Automatic sample-menu seeding without overwriting existing edits.
- Scrypt password hashing, opaque sessions stored as hashes, HttpOnly cookies, CSRF checks, and origin checks.
- Auth and API rate limits; request validation; parameterized SQL; ownership checks.
- All prices stored as integer paise. Checkout never trusts frontend totals.
- Immutable order item/address snapshots and a recorded status history.
- Graceful shutdown, JSON API errors, request IDs, consistent SQLite backup script.
- Docker configuration and CI workflow.

### Deliberate boundaries

This is a working local ordering system with sample merchants. It does not connect to actual restaurants, delivery riders, maps, card/UPI gateways, email/SMS providers, social login, or password-reset email. It does not schedule future orders or implement multi-merchant baskets. There are no fake payment buttons or fabricated live delivery coordinates.

The receipt is an order summary, not a jurisdiction-specific tax invoice. The app uses tax-inclusive sample menu prices and no separate tax calculation. Delivery pricing is a configured flat fee, not geocoded routing. The displayed Bengaluru collection is sample catalog context; entering an address does not validate real service coverage.

## 6. Everyday commands

| Command                | Purpose                                                      |
| ---------------------- | ------------------------------------------------------------ |
| `npm start`            | Serve compiled frontend and API at port 3000                 |
| `npm run dev`          | Start backend watcher and Vite frontend at port 5173         |
| `npm run build`        | Type-check and build frontend into `dist/`                   |
| `npm test`             | Run backend HTTP/database integration tests                  |
| `npm run test:ui`      | Run React interaction tests in jsdom against the real API    |
| `npm run check`        | Type-check, build, API tests, UI tests                       |
| `npm run admin:create` | Interactively create a new administrator; password is hidden |
| `npm run db:backup`    | Make a consistent SQLite backup in `backups/`                |

For development, open **http://localhost:5173**. Vite forwards `/api` requests to the backend. Use one hostname consistently; `localhost` and `127.0.0.1` have separate browser cookies.

The project includes a compiled `dist/` directory in the ZIP. After editing frontend source, rebuild it before `npm start`.

## 7. Where your data lives

By default, data is created automatically at **`data/foodio.sqlite`**. The nearby `-wal` and `-shm` files are normal SQLite runtime files. Users, sessions, addresses, carts, orders, favorites, reviews, menu changes, and audit records persist across restarts.

- Stop the server before moving its live database files.
- Use `npm run db:backup` for a consistent backup while it is running.
- Do not commit databases, backups, or `.env` to a public repository.
- To start a new sample environment without deleting your old data, change `DATABASE_PATH` to a new filename, then restart.
- Disabling demo mode does not delete any existing accounts or orders.

## 8. Configuration

Copy `.env.example` to `.env`. The app supplies local defaults if you omit this step.

| Setting           | Default                                    | Meaning                                        |
| ----------------- | ------------------------------------------ | ---------------------------------------------- |
| `PORT`            | `3000`                                     | HTTP port                                      |
| `HOST`            | `127.0.0.1`                                | Listening interface; local-only by default     |
| `DATABASE_PATH`   | `./data/foodio.sqlite`                     | SQLite file path, relative to project root     |
| `ALLOWED_ORIGINS` | localhost/127.0.0.1 on ports 3000 and 5173 | Exact allowed browser origins, comma-separated |
| `COOKIE_SECURE`   | `false`                                    | Set `true` behind HTTPS                        |
| `DEMO_MODE`       | `true`                                     | Create/show local sample credentials           |

No secret API key or external database URL is required. Use an absolute database path in hosted deployments.

To use a different local port, change `PORT` and add its matching URLs to `ALLOWED_ORIGINS`; for example, `http://localhost:3001`. Restart after changing configuration. The dev proxy reads `PORT` through the dev launcher.

## 9. Project map

| Path                  | Responsibility                                                        |
| --------------------- | --------------------------------------------------------------------- |
| `client/pages/`       | Storefront, restaurant menu, checkout, orders, account, offers, admin |
| `client/components/`  | Basket, address forms, dialog, dish and restaurant cards              |
| `client/context.tsx`  | Session and basket state                                              |
| `client/api.ts`       | API requests, CSRF token, money/time formatting                       |
| `client/styles.css`   | Responsive FOODIO visual system                                       |
| `server/app.mjs`      | HTTP routes, authorization, validation, serving frontend              |
| `server/services.mjs` | Pricing, order projection, state machine and schemas                  |
| `server/db.mjs`       | SQLite connection, migrations, transactions                           |
| `server/security.mjs` | Passwords, session tokens and cookies                                 |
| `server/seed.mjs`     | Sample kitchens, dishes, offers and optional demo users               |
| `server/migrations/`  | Ordered database schema changes                                       |
| `public/images/`      | Original local SVG food assets                                        |
| `scripts/`            | Local development, admin creation, backups, asset generation          |
| `tests/`              | Backend integration and React interaction tests                       |
| `docs/`               | Architecture, API reference, deployment, testing and asset credits    |

## 10. Troubleshooting

**“Node.js was not found” / “node is not recognized”**
Install Node 24.x LTS, close the terminal, and open a new terminal. Verify `node --version`.

**“No such built-in module: node:sqlite”**
You are running an older Node version. Install Node 24.x LTS and make sure it is first on PATH. Do not install a random npm package called `sqlite` as a workaround.

**“npm.ps1 cannot be loaded”**
Use `npm.cmd` in PowerShell or use `START-WINDOWS.bat`.

**Port already in use**
Stop the other instance with Ctrl+C, or change `PORT` and `ALLOWED_ORIGINS` in `.env`. Open the matching URL.

**“Cannot connect to FOODIO” / blank page after opening HTML**
Start the Node server and visit its HTTP URL. Do not double-click `index.html`. For development use port 5173; for compiled mode use port 3000.

**Login succeeds but a different tab has another account**
Browser tabs share cookies. Use a private window or another browser for the admin/customer two-account demonstration. Refresh a stale tab before continuing.

**“Your session changed. Refresh and try again.”**
A session may have expired, been signed out, or been changed in another tab. Refresh and sign in again. Sessions last seven days; changing a password invalidates other sessions.

**“Too many requests”**
Wait for the rate-limit window. Login has a per-IP and per-account/IP limit over 15 minutes. The general API limit is 300 requests per minute per direct client IP.

**“This browser origin is not allowed”**
Add your exact origin to `ALLOWED_ORIGINS` and restart. Include the scheme and port. Do not use `*`.

**FIRSTBITE rejected**
It requires a food subtotal of ₹199 or more and no previous non-cancelled order for that account. A cancelled first order does not consume eligibility. `FRESH10` requires ₹299 or more.

**Order is stuck at “Order placed”**
Open the admin workspace and record the next status. This app does not pretend that a real restaurant or courier is connected.

**“Database is locked” or write error**
Use one app instance per local SQLite file. Keep the database on a writable local disk, not a network share or read-only ZIP folder.

**Dependency installation fails**
Check network access to the npm registry and retry `npm ci`. Keep the included `package-lock.json`; it records the tested dependency versions.

## Further reading

- [Architecture and data model](docs/ARCHITECTURE.md)
- [API reference and examples](docs/API.md)
- [Deployment and operational boundaries](docs/DEPLOYMENT.md)
- [Validation report](docs/TEST_REPORT.md)
- [Asset and design notes](docs/ASSETS.md)

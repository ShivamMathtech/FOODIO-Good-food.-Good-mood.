# Deployment and operations

## Local installation

The default launchers run on loopback only with public sample credentials. This is the quickest development/demo mode and needs no outside infrastructure. The application has been validated in Linux with Node 24; the Windows launcher is supplied for Windows users but was not executed on a Windows host here.

## Docker

Docker is optional. The container configuration uses non-demo mode and exposes its port only on the host's loopback interface.

```bash
docker compose up --build -d
docker compose exec foodio node scripts/create-admin.mjs
```

Follow the administrator prompts. Open `http://localhost:3000` and register a customer account. The Docker image does not create demo users. The `foodio-data` named volume retains database records across restarts.

```bash
docker compose logs -f foodio
docker compose stop
docker compose start
```

Do not use `docker compose down -v` unless you intend to delete your database volume. Docker configuration is included but was not executed in the validation environment.

## Moving beyond localhost

A production deployment needs your actual merchant data, operating procedures and service integrations. The supplied application does not connect real stores or riders. Use the following settings for a single-instance deployment:

1. Use a fresh database path, such as `/srv/foodio/data/production.sqlite`.
2. Set `DEMO_MODE=false`.
3. Create your administrator using `npm run admin:create`. The command does not silently promote or replace an existing customer.
4. Set the exact HTTPS origin in `ALLOWED_ORIGINS`.
5. Set `COOKIE_SECURE=true` when traffic is served over HTTPS.
6. Build with `npm run build`, and run the backend under a process supervisor.
7. Place TLS termination/reverse proxy in front of the server. Keep the origin server on a private interface where possible.
8. Persist the database on a local writable disk and schedule consistent backups.

If a database still contains either publicly documented demo password, the non-demo server refuses to start. Either use a new database or sign into both demo accounts locally and change their passwords before changing the mode. Disabling demo mode never deletes user records.

Example environment for a trusted reverse proxy on the same host:

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
DATABASE_PATH=/srv/foodio/data/production.sqlite
ALLOWED_ORIGINS=https://food.example.com
COOKIE_SECURE=true
DEMO_MODE=false
```

Replace the example hostname with your real one. For container deployment the server needs `HOST=0.0.0.0` inside the container; limit externally exposed ports through the host/proxy configuration.

The app does not enable Express `trust proxy` by default. Consequently, behind a reverse proxy all clients may share the proxy's IP for rate limiting. Configure a precisely trusted proxy subnet and distributed rate limiting before serving high-traffic production workloads. Never trust arbitrary forwarded IP headers.

## Backup and restore

From the project root:

```bash
npm run db:backup
```

This uses SQLite's online backup API and creates a consistent file in `backups/`. It is safer than copying a live database without its WAL data.

Restore without overwriting the existing database:

1. Stop the app.
2. Copy the backup to a new writable path, for example `data/restored.sqlite`.
3. Set `DATABASE_PATH=./data/restored.sqlite` in `.env`.
4. Restart and verify account/order records.
5. Keep the previous database until the restore is verified.

Schema migrations run automatically once per filename and inside transactions. Back up before changing migration code or deploying new migrations. Existing migration files should be immutable once deployed; add another numbered SQL file instead.

## Monitoring and housekeeping

- `GET /api/health` checks a database query and returns version information.
- Unexpected application errors produce JSON log entries with a request ID and message.
- Authentication and API throttles are stored in SQLite. Expired counters are removed during subsequent API activity; expired sessions are cleaned when a new session is created.
- Admin updates are stored in `admin_audit`.
- No email/SMS/dispatch background jobs run in this edition.
- Use one app process per database file and measure your expected workload before scaling.
- Serve over HTTPS for real accounts and restrict filesystem access to the database and backups.

## Commercial deployment scope

The following are not included and should be designed for the actual business before launch: real payment-provider checkout/webhooks and reconciliation, refunds, rider dispatch/location feeds, merchant isolation, delivery-area validation, taxes and invoice compliance, email verification/password-reset delivery, moderation, retention/export policies, observability/alerts, comprehensive browser/device QA, accessibility audit, penetration testing, disaster-recovery testing, and measured load testing.

The source code includes defense-in-depth controls, but the included tests are not a security audit or a promise of a particular production capacity.

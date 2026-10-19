import { createApp } from './app.mjs';
import { verifyPassword } from './security.mjs';
import { fileURLToPath } from 'node:url';
const demoMode = (process.env.DEMO_MODE ?? 'true') === 'true';
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
if (demoMode && !['127.0.0.1', 'localhost', '::1'].includes(host)) {
  console.error('DEMO_MODE must be false before listening on a public network interface.');
  process.exit(1);
}
const { app, db } = await createApp({
  databasePath: process.env.DATABASE_PATH || './data/foodio.sqlite',
  demoMode,
  secureCookie: process.env.COOKIE_SECURE === 'true',
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',')
    .map((x) => x.trim())
    .filter(Boolean),
  distPath: fileURLToPath(new URL('../dist/', import.meta.url)),
  publicPath: fileURLToPath(new URL('../public/', import.meta.url)),
});
if (!demoMode) {
  for (const [email, password] of [
    ['admin@foodio.local', 'Admin@12345'],
    ['customer@foodio.local', 'Customer@12345'],
  ]) {
    const user = db.prepare('SELECT password_hash FROM users WHERE email=?').get(email);
    if (user && (await verifyPassword(password, user.password_hash))) {
      console.error(
        'Public demo credentials are still active. Use a fresh DATABASE_PATH for non-demo operation, or change both demo account passwords before restarting.',
      );
      db.close();
      process.exit(1);
    }
  }
}
const server = app.listen(port, host, () =>
  console.log(`FOODIO is running at http://${host}:${port}${demoMode ? ' (local demo mode)' : ''}`),
);
server.on('error', (err) => {
  console.error(
    err.code === 'EADDRINUSE'
      ? `Port ${port} is already in use. Change PORT in .env.`
      : err.message,
  );
  db.close();
  process.exit(1);
});
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

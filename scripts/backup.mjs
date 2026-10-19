import { backup } from 'node:sqlite';
import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDatabase } from '../server/db.mjs';
const source = process.env.DATABASE_PATH || './data/foodio.sqlite';
if (!existsSync(source)) {
  console.error('No database exists yet. Start FOODIO and create an order first.');
  process.exit(1);
}
mkdirSync('backups', { recursive: true, mode: 0o700 });
const destination = resolve(
  'backups',
  `foodio-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`,
);
const db = openDatabase(source);
try {
  await backup(db, destination);
  chmodSync(destination, 0o600);
  console.log('Consistent SQLite backup created: ' + destination);
} finally {
  db.close();
}

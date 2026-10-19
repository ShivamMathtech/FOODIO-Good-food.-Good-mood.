import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Writable } from 'node:stream';
import { z } from 'zod';
import { openDatabase } from '../server/db.mjs';
import { hashPassword } from '../server/security.mjs';
let muted = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!muted) stdout.write(chunk);
    callback();
  },
});
const rl = createInterface({ input: stdin, output, terminal: !!stdin.isTTY });
let db;
try {
  const name = z
    .string()
    .trim()
    .min(2)
    .max(80)
    .parse(await rl.question('Administrator name: '));
  const email = z
    .email()
    .max(254)
    .parse((await rl.question('Administrator email: ')).trim().toLowerCase());
  stdout.write('Password (10+ characters; hidden): ');
  muted = true;
  const password = z
    .string()
    .min(10)
    .max(128)
    .parse(await rl.question(''));
  muted = false;
  stdout.write('\n');
  stdout.write('Confirm password (hidden): ');
  muted = true;
  const confirmation = await rl.question('');
  muted = false;
  stdout.write('\n');
  if (password !== confirmation) throw new Error('Passwords do not match.');
  db = openDatabase(process.env.DATABASE_PATH || './data/foodio.sqlite');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email))
    throw new Error(
      'That email already exists. This command never overwrites or promotes an existing account.',
    );
  db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'admin')").run(
    name,
    email,
    await hashPassword(password),
  );
  console.log('Administrator created. Sign in through the application.');
} catch (error) {
  muted = false;
  console.error(
    '\nAdministrator was not created: ' +
      (error instanceof z.ZodError ? error.issues.map((i) => i.message).join('; ') : error.message),
  );
  process.exitCode = 1;
} finally {
  muted = false;
  rl.close();
  db?.close();
}

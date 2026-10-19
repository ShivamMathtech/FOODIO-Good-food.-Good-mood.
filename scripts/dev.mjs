import { spawn } from 'node:child_process';
const commands = [
  ['--watch', '--env-file-if-exists=.env', 'server/index.mjs'],
  ['node_modules/vite/bin/vite.js'],
];
const children = commands.map((args) =>
  spawn(process.execPath, args, { stdio: 'inherit', env: process.env }),
);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) c.kill('SIGTERM');
  setTimeout(() => process.exit(code), 250).unref();
}
for (const child of children) {
  child.on('exit', (code) => {
    if (!stopping) stop(code || 0);
  });
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

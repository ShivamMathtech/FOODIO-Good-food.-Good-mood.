#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo 'Install Node.js 24.x LTS from https://nodejs.org/ first.'
  exit 1
fi
node -e "if(Number(process.versions.node.split('.')[0])!==24){console.error('FOODIO requires Node.js 24.x LTS.');process.exit(1)}"
if [ ! -f .env ]; then cp .env.example .env; fi
if [ ! -d node_modules ]; then npm ci; fi
npm run build
printf '%s\n' 'Open http://localhost:3000. Press Ctrl+C to stop.'
npm start

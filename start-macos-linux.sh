#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js 22 LTS is required: https://nodejs.org/'
  exit 1
fi
if [ ! -d node_modules/three ]; then
  echo 'Installing dependencies (internet required for first setup)...'
  npm install
fi
echo 'Little Haven: http://localhost:5188/'
npm run dev

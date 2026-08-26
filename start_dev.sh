#!/usr/bin/env bash
set -e

# Siduri Development Startup Script
echo "============================================"
echo " Starting Siduri (API & Web) in Dev Mode    "
echo "============================================"

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  pnpm install
fi

# Run turborepo dev pipeline (starts apps/api and apps/web concurrently)
exec pnpm dev

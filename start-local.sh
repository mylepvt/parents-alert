#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
API="$ROOT/apps/api"
WEB="$ROOT/apps/web"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Bus Alert — Local Dev Mode"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Copy local env
cp "$ROOT/.env.local" "$API/.env"

# ── Backend ──────────────────────────────
echo ""
echo "▶ Setting up Python backend..."

cd "$API"

# pydantic-core max Python 3.13 — find compatible version
PYTHON=""
# pyenv 3.12 check first (most reliable)
if PYENV_VERSION=3.12.8 pyenv exec python --version &>/dev/null 2>&1; then
  PYTHON="pyenv exec python"
  export PYENV_VERSION=3.12.8
fi
# Fallback: look for 3.12/3.13 on PATH
if [ -z "$PYTHON" ]; then
  for p in python3.12 python3.13; do
    if command -v "$p" &>/dev/null; then
      PYTHON="$p"; break
    fi
  done
fi
# Last resort: system python (warn)
if [ -z "$PYTHON" ]; then
  PYTHON="python3"
  echo "  ⚠ Could not find Python 3.12/3.13. Trying $($PYTHON --version)..."
fi

echo "  Using: $($PYTHON --version 2>&1)"

if [ ! -d ".venv" ]; then
  echo "  Creating venv..."
  $PYTHON -m venv .venv
fi

source .venv/bin/activate
echo "  Installing dependencies (first time ~1 min)..."
pip install -q -r requirements.txt

echo "  Starting FastAPI on http://localhost:8000"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload --log-level warning &
API_PID=$!

# ── Admin user ───────────────────────────
sleep 3
echo ""
echo "▶ Creating admin user (admin / admin123)..."
AUTO_ADMIN_USER=admin AUTO_ADMIN_PASS=admin123 python create_admin.py

# ── Frontend ─────────────────────────────
echo ""
echo "▶ Setting up Next.js frontend..."

cd "$WEB"

echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
echo "NEXT_PUBLIC_APP_NAME=Bus Alert" >> .env.local

if [ ! -d "node_modules" ]; then
  echo "  Installing npm packages (first time — ~2 min)..."
  npm install
fi

echo "  Starting Next.js on http://localhost:3000"
npm run dev &
WEB_PID=$!

# ── Done ─────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  App running!"
echo "  Frontend : http://localhost:3000"
echo "  API docs : http://localhost:8000/docs"
echo ""
echo "  Default login: admin / admin123"
echo "  Ctrl+C to stop both servers"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Wait and cleanup on Ctrl+C
trap "kill $API_PID $WEB_PID 2>/dev/null; exit" INT TERM
wait

# Bus Alert — AI Voice Calling System
## Seth M R Jaipuria School, Bhiwadi

Coordinator types a message → one click → AI voice calls all parents → busy auto-retried → live dashboard → final report.

---

## Prerequisites

- Docker + Docker Compose
- ngrok (for Twilio webhooks during local dev)
- Twilio account (buy Indian number or use trial)
- Anthropic API key
- Node.js 22+ (for local frontend dev without Docker)
- Python 3.12+ (for local backend dev without Docker)

---

## Local Setup

```bash
git clone <repo>
cd bus-alert-system

# Copy env and fill in keys
cp .env.example .env
```

Fill in `.env`:
- `SECRET_KEY` — random 32+ char string
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `ANTHROPIC_API_KEY`
- `BASE_URL` — your ngrok URL (step below)
- `SCHOOL_PHONE` — your school's callback number

---

## Twilio + ngrok Setup

```bash
# Start ngrok in separate terminal
ngrok http 8000

# Copy the https URL e.g. https://abc123.ngrok.io
# Set in .env: BASE_URL=https://abc123.ngrok.io
```

In Twilio console — no additional webhook config needed. The app sets callback URLs dynamically per call.

---

## Start with Docker

```bash
docker-compose up --build
```

Services:
- API: http://localhost:8000 (docs at /docs)
- Web: http://localhost:3000
- PostgreSQL: localhost:5432
- Redis: localhost:6379

---

## Create Admin User

```bash
docker-compose exec api python create_admin.py
```

Or run locally:
```bash
cd apps/api
pip install -r requirements.txt
python create_admin.py
```

---

## Add Parents

1. Open http://localhost:3000
2. Login with admin credentials
3. Go to **Groups** tab
4. Create a class group (e.g. "Class 3-A")
5. **CSV Import** — upload CSV with columns:
   ```
   child_name,parent_name,phone_number
   Arjun Sharma,Rajesh Sharma,+919876543210
   ```
   Or add parents one by one.

---

## Send First Alert

1. Dashboard → **New Alert**
2. Select group → Select language → Type message
3. Click **Launch** → Watch live dashboard
4. Campaign auto-completes → Report auto-generated

---

## Android Install (PWA)

1. Open http://your-domain.com in **Chrome**
2. Tap ⋮ menu → **Add to Home Screen**
3. App installs like a native app

---

## Production Deploy

### API → Railway

```bash
# In Railway, connect repo
# Set root directory: apps/api
# Add all env vars from .env.example
# Railway auto-detects Dockerfile
```

### Web → Vercel

```bash
# Connect repo to Vercel
# Set root directory: apps/web
# Add env var: NEXT_PUBLIC_API_URL=https://your-railway-url.up.railway.app
```

### Redis → Upstash

1. Create free Redis at upstash.com
2. Copy connection URL
3. Set `REDIS_URL` in Railway env vars

### Database → Supabase

1. Create project at supabase.com
2. Get connection string (port 5432, not 6543)
3. Format: `postgresql+asyncpg://postgres:pass@host:5432/postgres`
4. Set `DATABASE_URL` in Railway env vars

### Final Steps

```bash
# Update BASE_URL to Railway URL in env vars
# Tables auto-create on first startup
# Run create_admin.py once via Railway shell
```

---

## Architecture

```
Next.js (Vercel)
    ↓ REST + SSE
FastAPI (Railway)
    ↓ async tasks
Celery Worker (Railway)
    ↓ voice calls
Twilio → Parent Phone
    ↓ TwiML
AI Script ← Claude claude-sonnet-4-20250514
    ↓ status callbacks
Webhook → DB update → SSE → Frontend
```

---

## Feature Matrix

| Feature | Status |
|---|---|
| Real AI voice calls | ✅ Twilio + Polly.Aditi/Raveena |
| Auto-retry busy numbers | ✅ 5 attempts, 30s gap |
| Hindi + English | ✅ Language per campaign |
| Live dashboard | ✅ SSE real-time, no refresh |
| Android installable | ✅ Full PWA |
| CSV import + export | ✅ Both directions |
| Campaign report | ✅ Auto-generated with chart |
| Production deploy ready | ✅ Railway + Vercel |
| Answering machine detection | ✅ Twilio AMD |
| Rate limiting | ✅ slowapi on auth endpoints |
| Twilio signature verification | ✅ In production mode |

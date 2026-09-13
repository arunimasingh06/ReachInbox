# ReachInbox Full-Stack Email Job Scheduler

A production-grade, distributed email scheduling service and real-time dashboard built for **ReachInbox.ai (Outbox Labs)**.

Designed for reliable, resilient scheduling and sending of emails at scale under high load, network partitions, and server restarts without losing jobs, dropping requests, or sending duplicate emails.

---

## Architecture Overview

```
                               ┌──────────────────────────────────────────────┐
                               │         Frontend Dashboard (React)           │
                               │  - Google OAuth (Real Identity Services)     │
                               │  - Figma UI (Sidebar, Tables, Detail Drawer) │
                               │  - CSV Lead Parser & Chips Selector          │
                               │  - Elasticsearch Search Bar                  │
                               └──────────────────────┬───────────────────────┘
                                                      │ HTTP / REST
                                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                            Express API Server (backend/src/server.ts)                       │
│  - REST Endpoints (/api/emails, /api/auth, /api/slack)                                      │
│  - Real Slack OAuth v2 Authorization & Callback                                             │
│  - Startup Reconciler (Scans PostgreSQL -> Verifies BullMQ -> Restores Missing Jobs)        │
│  - Live Bull Board Dashboard (/admin/queues)                                                │
└──────────────────────┬───────────────────────────────────────────────┬──────────────────────┘
                       │                                               │
                       ▼                                               ▼
          ┌───────────────────────────┐                   ┌──────────────────────────┐
          │  PostgreSQL (Prisma ORM)  │                   │          Redis 7         │
          │   Single Source of Truth  │                   │ - BullMQ Delayed Queues  │
          │  Atomic Status Guard Row  │                   │ - Atomic Lua Rate Limit  │
          │  (PENDING -> PROCESSING)  │                   │ - Per-Sender Timestamps  │
          └────────────▲──────────────┘                   └────────────▲─────────────┘
                       │                                               │
                       └───────────────────────┬───────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                          BullMQ Worker Engine (backend/src/worker.ts)                       │
│  - Configurable Concurrency (WORKER_CONCURRENCY)                                            │
│  - Step 1: Database State Transition Guard (UPDATE ... WHERE status IN ('PENDING'))        │
│  - Step 2: Per-Sender Minimum Send Delay Throttle (Redis Timestamp Check)                   │
│  - Step 3: Atomic Per-Sender Hourly Limiter (Redis Lua Script INCR+EXPIRE)                  │
│  - Step 4: SMTP Dispatcher (Ethereal Email + Preview URL Generator)                         │
│  - Step 5: Database Finalizer (SENT / FAILED) & Elasticsearch Document Indexer             │
│  - Step 6: Live Slack Notifier (Immediate POST on hourly cap hit)                            │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Architectural Guarantees

### 1. Database-Level Primary Idempotency (Zero Duplicate Sends)
Even under worker crashes, concurrent duplicate deliveries, or multiple workers picking up the same job, duplicates are prevented at the database row level:
- **Primary Guard**: When a worker processes an email, it executes an atomic conditional update in PostgreSQL:
  ```sql
  UPDATE "Email" 
  SET status = 'PROCESSING' 
  WHERE id = :id AND status IN ('PENDING', 'SCHEDULED');
  ```
  Because PostgreSQL serializes row-level locks, exactly **one** worker succeeds (`count === 1`). Any duplicate worker receives `count === 0` and aborts immediately without contacting the SMTP server.
- **Secondary Guard (BullMQ Job ID)**: Every job is enqueued with `jobId: email.id`. BullMQ enforces unique job IDs across delayed and waiting states, dropping duplicate enqueue attempts.

### 2. Server Restart Persistence & Reconciliation
- **Source of Truth**: PostgreSQL persistently stores all scheduling metadata, recipient lists, scheduled times, and execution statuses.
- **Boot Reconciler (`reconcileOnBoot`)**:
  1. On server startup, queries PostgreSQL for all rows where `status IN ('PENDING', 'SCHEDULED')`.
  2. Queries BullMQ via `emailQueue.getJob(email.id)`.
  3. If missing from the queue (e.g., Redis restart without persistence or network blip during initial enqueue):
     - Computes remaining delay: `Math.max(0, scheduledTime - now)`.
     - Re-enqueues into BullMQ using `jobId = email.id`.
  4. Recovers any orphaned `PROCESSING` rows where a worker died mid-flight back to `SCHEDULED` for retry.
  5. Never touches or re-sends emails already marked `SENT` or `FAILED`.

### 3. Atomic Per-Sender Hourly Rate Limiting (Redis Lua Script)
To prevent race conditions where multiple parallel workers exceed a sender's hourly limit:
- **Atomic Lua Script**:
  ```lua
  local current = redis.call('GET', KEYS[1])
  if current and tonumber(current) >= tonumber(ARGV[1]) then
    return { 0, tonumber(current) } -- Denied: limit reached
  end
  local next_val = redis.call('INCR', KEYS[1])
  if next_val == 1 then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
  end
  return { 1, next_val } -- Allowed
  ```
- **Overflow Rescheduling**: When a limit is hit, jobs are **never dropped or failed**. The worker calculates the start of the next hour window (`(60 - currentMinute)` minutes), reschedules the job for that time, updates PostgreSQL, and triggers a live Slack notification.

### 4. Per-Sender Minimum Send Delay
- Enforces a minimum interval between individual sends (e.g. 2 seconds) to mimic email provider throttling.
- Implemented per sender via `sender:last_sent:{senderEmail}` in Redis so that **Sender A's delay never blocks Sender B's concurrent emails**.

### 5. Real OAuth 2.0 Integrations (No Mocks)
- **Google OAuth**: Uses Google Identity Services on the frontend and official `google-auth-library` backend verification to authenticate users and generate verified JWT sessions.
- **Slack OAuth v2**: Features complete OAuth 2.0 authorization code exchange with `incoming-webhook` and `chat:write` scopes, storing webhooks in PostgreSQL and posting live Slack notifications on hourly rate-limit hits.

---

## Tech Stack

| Component | Technology | Role |
|---|---|---|
| **Backend Framework** | Node.js + TypeScript + Express.js | REST APIs, OAuth handlers, queue management |
| **Job Queue** | BullMQ + Redis 7 | Persistent delayed job scheduling & metrics |
| **Relational Database** | PostgreSQL 16 via Prisma ORM | Single source of truth & atomic state guards |
| **Search Engine** | Elasticsearch 8 (`@elastic/elasticsearch`) | Full-text search index for sent & scheduled emails |
| **SMTP Service** | Nodemailer + Ethereal Email | Fake SMTP testing with web inbox preview links |
| **Queue Admin UI** | `@bull-board/express` | Real-time queue dashboard at `/admin/queues` |
| **Frontend Framework** | React 18 + Vite + TypeScript | Modern responsive single-page application |
| **Styling** | Tailwind CSS + Lucide Icons | Exact reproduction of Figma design |
| **Infrastructure** | Docker Compose | PostgreSQL, Redis, Elasticsearch orchestration |

---

## Quick Start Guide

### Prerequisites
- Node.js (v18+) & npm
- Docker & Docker Compose (or local PostgreSQL 16 + Redis 7)

### 1. Start Infrastructure Services
```bash
# Start PostgreSQL, Redis, and Elasticsearch
docker compose up -d
```

### 2. Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev --name init

# (Optional) Run all architectural verifications
npm run test:verify

# Start backend services (API server on :5001 and Worker process)
npm run dev
```
*Note: To run the API server and Worker as separate decoupled processes:*
```bash
npm run dev:server  # Runs Express API on http://localhost:5001
npm run dev:worker  # Runs BullMQ Worker engine
```

### 3. Frontend Setup
```bash
cd ../frontend

# Install dependencies
npm install

# Start Vite development server on http://localhost:3000
npm run dev
```

Visit **`http://localhost:3000`** in your browser.

---

## Environment Variables

### Backend (`backend/.env`)
| Variable | Description | Default |
|---|---|---|
| `PORT` | Backend HTTP port | `5001` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |
| `DATABASE_URL` | PostgreSQL Prisma connection string | `postgresql://postgres:postgres@localhost:5432/reachinbox_scheduler?schema=public` |
| `REDIS_HOST` | Redis hostname | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `WORKER_CONCURRENCY` | Parallel BullMQ worker concurrency | `5` |
| `MIN_SEND_DELAY_SECONDS` | Minimum delay between sends per sender | `2` |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | Hourly sending cap per sender | `100` |
| `ELASTICSEARCH_NODE` | Elasticsearch cluster URL | `http://localhost:9200` |
| `ELASTICSEARCH_INDEX` | Elasticsearch index name | `emails` |
| `GOOGLE_CLIENT_ID` | Real Google OAuth 2.0 Client ID | Required for Google Login |
| `GOOGLE_CLIENT_SECRET` | Real Google OAuth 2.0 Client Secret | Optional |
| `JWT_SECRET` | JWT signing secret | Secure random string |
| `SLACK_CLIENT_ID` | Real Slack OAuth App Client ID | Required for Slack OAuth |
| `SLACK_CLIENT_SECRET` | Real Slack OAuth App Client Secret | Required for Slack OAuth |
| `SLACK_REDIRECT_URI` | Slack OAuth callback URL | `http://localhost:5001/api/slack/oauth/callback` |
| `ETHEREAL_USER` | Ethereal SMTP username (auto-generated if blank) | Auto-generated |
| `ETHEREAL_PASS` | Ethereal SMTP password (auto-generated if blank) | Auto-generated |

---

## Automated Verification Suite

Run the automated test suite verifying all 5 core architectural properties:

```bash
cd backend
npm run test:verify
```

### Verification Tests Included:
1. `verify-ratelimit.ts`: Fires 12 simultaneous worker attempts with an hourly limit of 5; verifies that the Redis Lua script atomically permits exactly 5 and denies/reschedules 7 without race conditions.
2. `verify-delay.ts`: Demonstrates that Sender A's 2-second minimum delay throttles Sender A's subsequent send while Sender B's concurrent emails are allowed independently.
3. `verify-idempotency.ts`: Simulates 5 parallel workers attempting to claim the same email; verifies that PostgreSQL's atomic state transition permits only 1 worker and rejects 4, and BullMQ deduplicates identical job IDs.
4. `verify-reconciliation.ts`: Populates PostgreSQL with scheduled emails and orphaned processing records, simulates queue state loss, and verifies `reconcileOnBoot` restores exact jobs with zero duplicates.
5. `verify-e2e-send.ts`: Schedules an email, boots the BullMQ worker, dispatches via Ethereal SMTP, and verifies generated preview URLs and database transitions.

---

## Live Monitoring & Dashboards
- **Bull Board Queue Dashboard**: `http://localhost:5001/admin/queues`
  - Real-time visualization of `delayed`, `waiting`, `active`, `completed`, and `failed` jobs.
- **Backend Health Check**: `http://localhost:5001/health`

---

## Assumptions & Trade-offs
1. **PostgreSQL as Primary Source of Truth**: PostgreSQL handles state transitions (`PENDING -> PROCESSING -> SENT/FAILED`) atomically. Elasticsearch acts strictly as a search index; if Elasticsearch is temporarily unavailable, searches gracefully fall back to PostgreSQL full-text search.
2. **Ethereal Account Provisioning**: If Ethereal credentials are not specified in `.env`, the server automatically provisions a fresh test account on boot via `nodemailer.createTestAccount()`, logs the credentials, and links preview URLs on each sent email.
3. **Port Selection**: Default backend port is configured to `5001` to prevent port collision with macOS AirPlay Receiver / ControlCenter on port `5000`.
4. **Behavior Under High Load (1000+ Emails)**: When 1000+ emails are scheduled for the same instant, they are enqueued into BullMQ as delayed jobs. BullMQ workers process them bounded by `WORKER_CONCURRENCY` and `MIN_SEND_DELAY_SECONDS`. As individual senders reach their hourly cap, the Redis Lua script atomically reschedules remaining jobs into the next hour window without dropping requests.

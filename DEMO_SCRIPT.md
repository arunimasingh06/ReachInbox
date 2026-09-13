# ReachInbox Assignment: Demo Video Script (Max 5 Minutes)

This step-by-step recording script guides you through demonstrating all required features in under 5 minutes for submission to **Mitrajit** and **Yadav036**.

---

## Pre-Recording Checklist
1. Ensure PostgreSQL and Redis are running:
   ```bash
   # From root:
   docker compose up -d
   ```
2. Start the Backend API server and Worker:
   ```bash
   cd backend
   npm run dev
   ```
3. Start the Frontend dashboard:
   ```bash
   cd frontend
   npm run dev
   ```
4. Open the following browser tabs:
   - Tab 1: Frontend Dashboard (`http://localhost:3000`)
   - Tab 2: BullMQ Queue Dashboard (`http://localhost:5001/admin/queues`)
   - Tab 3: Terminal window showing backend logs

---

## Video Walkthrough Script

### Section 1: Introduction & Login (0:00 - 0:45)
1. **Show Login Screen**:
   - Point out the clean Figma-styled login screen with Google OAuth.
   - Click "Continue with Google" to sign in using real Google Identity Services.
2. **Dashboard Overview**:
   - Highlight the sidebar matching the Figma design:
     - "ONE" brand logo
     - User profile card (Oliver Brown / logged in user)
     - Primary "+ Compose" button
     - Navigation tabs: "Scheduled" and "Sent" with live count badges
     - Slack Integration status widget and link to BullMQ Dashboard
   - Highlight the top search bar (backed by Elasticsearch).

---

### Section 2: Composing & Scheduling Emails via CSV Upload (0:45 - 2:00)
1. **Click "+ Compose"**:
   - Show the Compose Modal matching the Figma 3-panel mockup.
   - Point out the "From" sender input (`oliver.brown@reachinbox.ai`).
2. **Upload Leads via CSV**:
   - Click the **"Upload CSV"** button.
   - Select `sample-leads.csv` from the repository root.
   - Show that the client-side parser detects the 5 emails and displays:
     `5 recipients detected`
   - Show the green email chips with removable ("x") controls.
3. **Configure Pacing & Timing**:
   - Set Subject: `Product Demo & Partnership Discussion`
   - Set Body: `Hi team, excited to share how ReachInbox automates outreach workflows.`
   - Set **"Delay between 2 emails"**: `2 seconds` (to demonstrate provider throttling).
   - Set **"Hourly Limit"**: `100`.
   - In the "Send Later" dropdown, select **"Send Immediately (5s delay)"** (or pick a time 30 seconds ahead).
   - Click **"Schedule"**.
4. **Inspect BullMQ Dashboard**:
   - Switch to Tab 2 (`/admin/queues`).
   - Show the delayed jobs appearing in BullMQ with unique job IDs matching the database IDs.

---

### Section 3: Observing Delayed Dispatch & Ethereal SMTP Inbox (2:00 - 3:00)
1. **Watch Real-Time Execution**:
   - Watch the delayed jobs move into `active`, then `completed`.
   - In the frontend, switch to the **"Sent"** tab.
   - Show the emails appearing with the green **"Sent"** badge.
2. **Click an Email Row to Open Detail Drawer**:
   - Show the slide-out detail drawer matching the Figma design with full headers and body.
3. **Open Ethereal Preview**:
   - Click **"View Inbox"** or **"Open Ethereal Mail"**.
   - Show the rendered email on `ethereal.email` in the browser!

---

### Section 4: Server Restart & Persistence Scenario (3:00 - 4:00)
1. **Schedule Future Emails**:
   - Click "+ Compose".
   - Add 2 recipients.
   - In the "Send Later" dropdown, choose a custom time 2 minutes in the future (or Tomorrow 10:00 AM).
   - Click "Schedule".
   - Show the 2 emails appearing in the **"Scheduled"** tab.
2. **Kill the Backend Server**:
   - In the terminal, press `Ctrl+C` to terminate the backend server.
   - Point out to the camera: *"The backend server is now completely dead."*
3. **Restart the Backend Server**:
   - Run `npm run dev` again.
   - Point out the console log:
     ```
     [Reconciler] Starting startup persistence reconciliation...
     [Reconciler] Reconciliation complete: Checked=2, Re-enqueued=0, AlreadyPresent=2
     ```
   - Explain:
     *"The startup reconciler scanned PostgreSQL, cross-referenced BullMQ, ensured zero duplicates were enqueued, and preserved the scheduled execution times."*
   - Show that future emails remain intact in the dashboard and will fire at the exact right moment.

---

### Section 5: Rate Limiting & Live Slack Alert Under Load (4:00 - 5:00)
1. **Explain the Atomic Lua Mechanism**:
   - *"We use an atomic Redis Lua script keyed by `ratelimit:{senderEmail}:{YYYYMMDDHH}` to enforce hourly limits across concurrent workers."*
2. **Demonstrate Automated Verification**:
   - In the terminal, run:
     ```bash
     npm run test:verify
     ```
   - Point out the 5 passing tests:
     - Atomic rate limiter handling 12 concurrent requests with limit 5 (5 allowed, 7 rescheduled).
     - Per-sender minimum delay throttle.
     - Database idempotency state guard.
     - Server restart reconciliation.
     - End-to-end SMTP send and Ethereal preview link.
3. **Show Live Slack Integration**:
   - Show the "Connect Slack" button in the sidebar and explain the OAuth v2 incoming-webhook flow.
   - Highlight that the moment a sender's cap is reached, a live Slack message is dispatched to the channel.

---

## Video Submission Checklist
- [ ] Video duration is 5 minutes or less.
- [ ] Link to public/unlisted Loom or YouTube added to ClickUp form.
- [ ] GitHub repository is private with access granted to `Mitrajit` and `Yadav036`.

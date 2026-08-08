# Walk-In Hiring Drive Candidate Tracker — HTML/CSS/JS + Supabase

This is a plain **HTML5 + CSS + vanilla JavaScript** rebuild of the original
React app. Same look, same functionality, same stages (Reception → HR
Screening → Cabin 1–4 → LOI → Completed, with Rejected reachable from HR or
any Cabin), same live/realtime updates, same exports — but **no build step,
no framework, no npm install**. It's just static files you can open, host
anywhere, and edit directly.

Backend is still **Supabase** (Postgres + Auth + Realtime), hosting is still
**Vercel**, both free.

Because there's no build step, in-app navigation uses `#/...` hash routes
(e.g. `yoursite.vercel.app/#/admin`, `yoursite.vercel.app/#/volunteer`)
instead of clean paths — this avoids needing any server rewrite rules and
works identically on any static host.

---

## What you need to do by hand

Do these in order. None of it requires prior experience with Supabase,
GitHub, or Vercel.

### 1. Create your free Supabase project

1. Go to **https://supabase.com**, click **Start your project**, sign in
   (GitHub sign-in is easiest).
2. Click **New project**. Pick any name (e.g. `hiring-drive`), set a database
   password (save it somewhere), pick the region closest to your event, and
   choose the **Free** plan. Click **Create new project** and wait ~1–2
   minutes.
3. In the left sidebar, click **SQL Editor** (`>_` icon) → **New query**.
4. Open `supabase/schema.sql` from this project, copy its entire contents,
   paste into the SQL editor, and click **Run**. You should see "Success."
5. *(Optional — sample data for testing only, skip for a real event.)* New
   query again, paste `supabase/seed_optional.sql`, click **Run**.
6. In the left sidebar, click **Project Settings** (gear icon) → **API**.
   Copy the **Project URL** and the **anon / public** key — you need both in
   Step 2.

### 2. Add your Supabase credentials to the app

1. Open `js/config.js` in this project.
2. Replace the two placeholder strings with the values from Step 1.6:
   ```js
   export const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
   export const SUPABASE_ANON_KEY = "eyJ...your-anon-key...";
   ```
3. Save the file. That's the only code edit required.

### 3. Push this code to a free GitHub repo

Open a terminal in this project folder and run:

```bash
git init
git add .
git commit -m "Initial commit: hiring drive tracker (HTML/JS + Supabase)"
```

Then on **https://github.com**, click **+** (top right) → **New
repository**. Name it (e.g. `hiring-drive-tracker`), leave it Public or
Private, do **not** initialize with a README, and click **Create
repository**. GitHub will show you commands — use these (replace
`YOUR-USERNAME`):

```bash
git remote add origin https://github.com/YOUR-USERNAME/hiring-drive-tracker.git
git branch -M main
git push -u origin main
```

### 4. Deploy to Vercel (free Hobby tier)

1. Go to **https://vercel.com**, sign in with your GitHub account.
2. Click **Add New… → Project**. Find your repo and click **Import**.
3. Under **Framework Preset**, choose **Other** (this is a static site —
   there is nothing to build). Leave Build Command empty and Output
   Directory as `.` (the `vercel.json` in this project already sets this for
   you, so you can usually just click through).
4. Click **Deploy**. Wait ~30 seconds. You'll get a live URL like
   `https://hiring-drive-tracker.vercel.app` — this is your app.
   (Because credentials live in `js/config.js`, which you already edited and
   committed, there are no environment variables to set in Vercel.)

### 5. Create your first admin user

1. Back in Supabase, left sidebar → **Authentication** → **Users**.
2. Click **Add user** → **Create new user**. Enter your email and a
   password, and check **"Auto Confirm User"**. Click **Create user**.
3. Go to **Table Editor** (left sidebar) → open the `profiles` table. You
   should see a row for the user you just created, with `role` set to
   `reception` by default.
4. Click into that row's `role` cell and change it to `admin`. Save.
5. Go to your live Vercel URL and log in with that email/password — you'll
   land on the dashboard and see an **Admin** tab in the nav bar.

### 6. Add each role's login for staff, before the event

For every staff member (reception desk, HR, each cabin interviewer, LOI
desk):

1. In Supabase → **Authentication → Users → Add user**, same as Step 5.2,
   using that staff member's email and a password you give them. Check
   **Auto Confirm User**.
2. Log into the app yourself as **admin**, open **Admin**, and in **Staff
   Roster** find their email and pick their role from the dropdown
   (`Reception`, `HR Screening`, `Cabin 1`…`Cabin 4`, `LOI Desk`). Takes
   effect immediately — no redeploy needed.
3. Give each staff member their email + password and the app URL. They log
   in at the root URL and are routed to their queue automatically via the
   **My Queue** nav link.

The public, no-login queue display is at `https://your-app.vercel.app/#/volunteer`.

---

## Running it locally before deploying

Because this uses ES module `<script type="module">` imports, opening
`index.html` directly via `file://` will be blocked by the browser. Serve it
over local HTTP instead, from the project folder:

```bash
python3 -m http.server 8080
# or: npx serve .
```

Then open `http://localhost:8080`.

---

## Project structure

```
index.html              Single HTML entry point
css/style.css            All styling (hand-written, mirrors the original design)
js/config.js              Your Supabase URL + anon key (edit this)
js/supabaseClient.js      Supabase client setup
js/lib.js                 Constants, formatting helpers, export-to-xlsx/csv
js/store.js                Auth state + realtime candidates/settings stores
js/layout.js                Shared header/nav shell for logged-in pages
js/router.js                 Hash-based router (#/, #/login, #/stage/:stage, #/admin, #/volunteer)
js/main.js                    App bootstrap
js/pages/login.js              Sign-in screen
js/pages/volunteer.js          Public read-only live queue (no login)
js/pages/dashboard.js          KPIs, funnel/outcome/hourly charts (Chart.js), search
js/pages/stage.js              Per-role queue + Reception/HR/Cabin/LOI action panels + decision log
js/pages/admin.js              Candidate table, exports, thresholds, staff roster, event reset
supabase/schema.sql        Run once in Supabase SQL Editor (tables, RLS, triggers, RPCs)
supabase/seed_optional.sql  Optional sample data
vercel.json                  Static-site config for Vercel
```

Third-party libraries are loaded from CDN (no `npm install` needed):
`@supabase/supabase-js`, `chart.js` (for the dashboard charts), and `xlsx`
(SheetJS, for the export buttons) — same libraries the original app used.

## Notes on fidelity to the original app

- Same database schema, same business rules (Cabin 4 = experienced only,
  enforced in the database), same Row Level Security policies restricting
  each role to their own stage.
- Same stage flow, same alert thresholds, same KPI calculations, same CSV/XLSX
  export columns, same "Reset for Next Event" admin flow.
- One addition: `supabase/schema.sql` includes a `generate_candidate_code()`
  database function. The original app's Reception form called this function,
  but it was missing from the original migration files — it's included here
  so candidate registration works out of the box.
- Routing is hash-based (`#/admin` instead of `/admin`) since there is no
  build/server step to rewrite paths — functionally identical, just a
  different-looking URL.

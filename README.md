# LUMINA Optical

Premium optical store & eye examination platform — public storefront, multi-step booking, and role-based admin dashboard.

**Stack:** Next.js App Router · React 19 · TypeScript · Tailwind CSS 4 · Supabase (optional document store + media)

## Features

- Public landing with cinematic optical hero + category cards, services, shop, product detail, gallery, about, and contact pages
- Multilingual UI: English, Hebrew, Arabic with full RTL
- Multi-step appointment booking with availability slots
- Customer manage link (view / cancel / reschedule via token)
- Admin dashboard: appointments, calendar, inventory, customers, promotions, media, staff, settings
- SMS notifications (console simulation by default; Twilio / MessageBird / custom)
- Storage cascade: Supabase JSON document → local `data/store.json` fallback

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Without Supabase credentials the app seeds and persists to `data/store.json`.

## Environment variables

Copy `.env.example` to `.env.local`:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Service role / secret key (server store + storage) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional public anon key |
| `SUPABASE_STORE_TABLE` | Defaults to `lumina_store` |
| `SUPABASE_STORE_ID` | Defaults to `default` |
| `SUPABASE_MEDIA_BUCKET` | Media bucket name (see `supabase/storage.sql`) |
| `AUTH_SECRET` | Signs admin session cookies |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin login (defaults below) |
| `EMPLOYEE_PASSWORD` / `RECEPTIONIST_PASSWORD` | Staff role passwords |
| `SMS_PROVIDER` | `console` \| `twilio` \| `messagebird` \| `custom` |
| `NEXT_PUBLIC_SITE_URL` | Public site origin |

## Supabase setup

1. Create a Supabase project.
2. Run SQL in the Supabase SQL Editor:
   - `supabase/schema.sql` — relational schema + `lumina_store` document table
   - `supabase/storage.sql` — media bucket policies
3. Add project URL and **service role / secret** key to `.env.local`.
4. Restart `npm run dev`. On first read, the API seeds `lumina_store` if empty.

The Next.js API primarily uses the **document store** row (`lumina_store.payload`). The broader relational schema is available for future migration or reporting.

## Admin login

| Role | Email | Default password |
| --- | --- | --- |
| Admin | `admin@oyon.optics` | `oyon2024` |
| Employee | `employee@oyon.optics` | `employee2024` |
| Receptionist | `receptionist@oyon.optics` | `reception2024` |

Dashboard: [http://localhost:3000/admin](http://localhost:3000/admin)

Change passwords via env vars before any production deploy. Set a strong `AUTH_SECRET`.

## Public routes

| Path | Description |
| --- | --- |
| `/` | Landing — optical hero, category cards, featured products, promotions, reviews |
| `/services` | Premium services catalogue |
| `/shop` | Product catalog with category filters & search |
| `/product/[slug]` | Product detail |
| `/book` | Booking wizard (`?service=` preselect supported) |
| `/appointments/manage?token=` | Customer appointment manage page |
| `/gallery` | Image gallery with lightbox |
| `/about` | Brand story & team |
| `/contact` | Contact form, hours, map, WhatsApp |

## Key APIs

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/products?featured=1` | Public catalog |
| `GET` | `/api/promotions` | Active homepage promotions |
| `GET` | `/api/reviews` | Featured reviews |
| `GET` | `/api/settings` | Public sanitized settings |
| `GET` | `/api/booking/options` | Services, active staff, slot config |
| `GET` | `/api/availability?staffId=&date=` | Open time slots |
| `POST` | `/api/appointments` | Create booking |
| `GET` / `PATCH` | `/api/appointments?token=` | Manage booking by token |
| `POST` | `/api/contact` | Contact form |

## Assets

- Hero video: `public/videos/hero.mp4`
- Placeholder frame: `public/images/placeholder-frame.svg`

## Scripts

```bash
npm run dev      # development
npm run build    # production build
npm run start    # start production server
npm run lint     # eslint
```

## Vercel deployment

`vercel.json` forces the **Next.js** framework preset. Do **not** set a custom Output Directory in the Vercel dashboard (leave it empty / default). Root Directory must be the repository root (where `package.json` and `app/` live).

### If you see Vercel `NOT_FOUND` on every route

That is Vercel’s **platform** 404 (`x-vercel-error: NOT_FOUND`), not the Next.js `not-found` page. Common causes:

1. **Wrong hostname** — team projects serve at `https://premium-optical-store-<team>.vercel.app`. The shorter `https://premium-optical-store.vercel.app` returns platform `NOT_FOUND` unless that domain is assigned under **Project → Settings → Domains**.
2. **Framework Preset = Other** — set to **Next.js**, then Redeploy.
3. **Output Directory overridden** — clear it (Next.js manages `.next` itself).
4. **Root Directory wrong** — must be `.` (repo root), not a missing subdirectory.
5. **Deployment Protection** — unique deployment URLs may redirect to Vercel SSO before the app is visible.

Probe: `GET /api/health` should return `{ ok: true }` when the Next.js runtime is serving.

## Backups

Production business data is the `lumina_store` / `default` JSON document plus files in the public `lumina-media` bucket. Daily backups write **only** to a private `oyon-backups` bucket (never back into live store or media).

Each snapshot stores the **complete `AppData` object** (`appData`) plus a `sections` summary so a future restore can copy one field at a time (`eyeExamAppointments`, `products`, `lensInventory`, `settings`, …). Restore is not implemented yet. Any future restore must first call `createPreRestoreSnapshot()` so the current production blob is saved under `store/pre-restore/`.

The daily JSON is written **last**, and only after every live media file is already in the backup index. If the Vercel 60s function budget runs out, the job stops starting new copies, keeps progress in `media/index.json`, does **not** write `store/daily/YYYY-MM-DD.json`, and returns HTTP 503. The next cron run resumes unchanged files as skips and continues the rest.

Layout inside `oyon-backups`:

| Path | Purpose |
| --- | --- |
| `store/daily/YYYY-MM-DD.json` | Full AppData snapshot (Jerusalem date, ~30 days kept) |
| `store/pre-restore/*.json` | Mandatory pre-restore copies (future) |
| `media/objects/<live-path>` | Incremental copies of `lumina-media` files |
| `media/index.json` | Size / `updated_at` index so unchanged files are not re-copied |

### Manual setup

1. In the Supabase SQL editor, run the `oyon-backups` block in `supabase/storage.sql` **or** let the first backup job create the bucket (`public: false`).
2. In **Storage**, confirm `oyon-backups` is **private**. Do not add a public read policy.
3. In Vercel, set `CRON_SECRET` (same bearer used by `/api/cron/backups`). Optional: `SUPABASE_BACKUP_BUCKET=oyon-backups`.
4. After deploy, Vercel Cron hits `GET /api/cron/backups` daily at `00:00 UTC`. Vercel sends `Authorization: Bearer $CRON_SECRET` when that env var is set. The route requires that exact header (401 if `CRON_SECRET` is missing or wrong).
5. Hobby plans may not run cron. Trigger the same URL manually or from an external scheduler.

The job is read-only against `lumina_store` and `lumina-media`. It does not seed, delete, or update production business data.

## Design notes

Light premium direction (Warby Parker / Apple–inspired): navy accent (`--accent`), Fraunces display typography, Manrope body, large spacing, restrained motion. Brand **LUMINA** is the hero signal on the landing page with a full-bleed looping video.

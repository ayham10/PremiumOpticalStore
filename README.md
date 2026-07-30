# LUMINA Optical

Premium optical store & eye examination platform — public storefront, multi-step booking, and role-based admin dashboard.

**Stack:** Next.js App Router · React 19 · TypeScript · Tailwind CSS 4 · Supabase (optional document store + media)

## Features

- Public landing, shop, product detail, gallery, about, and contact pages
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
| Admin | `admin@lumina.optics` | `lumina2024` |
| Employee | `employee@lumina.optics` | `employee2024` |
| Receptionist | `receptionist@lumina.optics` | `reception2024` |

Dashboard: [http://localhost:3000/admin](http://localhost:3000/admin)

Change passwords via env vars before any production deploy. Set a strong `AUTH_SECRET`.

## Public routes

| Path | Description |
| --- | --- |
| `/` | Landing — hero video, services, featured products, promotions, reviews |
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

## Design notes

Light premium direction (Warby Parker / Apple–inspired): navy accent (`--accent`), Fraunces display typography, Manrope body, large spacing, restrained motion. Brand **LUMINA** is the hero signal on the landing page with a full-bleed looping video.

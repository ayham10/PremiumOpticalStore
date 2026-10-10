# OYON Optics — GitHub emergency recovery

This document is for authorized administrators only. It describes how to recover
from the private GitHub disaster-recovery repository. It does **not** restore
production automatically.

Do not paste credentials, customer names, phone numbers, or raw booking tokens
into tickets, chat, or screenshots.

## What GitHub stores

The private backup repository keeps:

| Path | Meaning |
| --- | --- |
| `backups/database.json` | Latest **complete** store document (compatibility copy) |
| `backups/daily/YYYY-MM-DD.json` | Immutable dated store snapshot (Israel calendar date) |
| `backups/daily/YYYY-MM-DD.manifest.json` | Integrity and completion receipt |
| `backups/history.json` | Dated snapshot index and last-run status |
| `backups/backup-info.json` | Latest run receipt |
| `backups/media-index.json` | Deduplicated media inventory |
| `backups/media/<path>` | Actual product, page, library, and video files |

A dated file is a valid recovery point only when its manifest has
`complete: true` and `verified: true`. Incomplete runs may update
`backup-info.json` and `history.json.lastRun` without replacing a valid daily
snapshot.

Secrets such as SMTP passwords and API tokens are redacted from snapshots.
Twilio/WhatsApp **environment** credentials stay in Vercel and are never written
to GitHub. Booking manage **hashes** stay in the store document; raw tokens do
not.

## 1. Select a dated snapshot

1. Open the private GitHub backup repository.
2. Open `backups/history.json` and choose a row with `complete` and `verified`.
3. Download `backups/daily/YYYY-MM-DD.json` and
   `backups/daily/YYYY-MM-DD.manifest.json`.
4. Prefer a date that still has the media files you need. Media is incremental
   and shared across dates.

Admin → Backups also lists dated GitHub snapshots (counts and dates only).

## 2. Verify integrity

On a trusted workstation, without uploading the files anywhere public:

```bash
node -e '
const fs = require("fs");
const crypto = require("crypto");
const snap = fs.readFileSync("2026-10-10.json");
const manifest = JSON.parse(fs.readFileSync("2026-10-10.manifest.json", "utf8"));
const sha = crypto.createHash("sha256").update(snap).digest("hex");
if (manifest.complete !== true || manifest.verified !== true) throw new Error("not a valid recovery point");
if (sha !== manifest.appDataSha256) throw new Error("checksum mismatch");
const data = JSON.parse(snap.toString("utf8"));
if (!Array.isArray(data.products) || !data.settings) throw new Error("invalid store");
console.log("verified", manifest.date);
'
```

Do not continue if the checksum fails or `complete` is false.

## 3. Recover the database document

Production restore from GitHub is **manual and separately approved**.

Preferred path:

1. Create a new Supabase **pre-restore / safety** snapshot of the live store
   (Admin → Backups → create backup now). Never skip this.
2. Replace only `public.lumina_store` row `id = default` `payload` with the
   verified JSON after review.
3. Do not write environment variables, GitHub tokens, or Supabase keys into the
   document.

If you instead use Admin → Backups restore, restore from a **Supabase** snapshot
that already contains this data. GitHub is the secondary copy when Supabase
backups are unavailable.

## 4. Restore missing media

1. From the verified JSON, collect `lumina-media` paths (product images,
   custom-page desktop/mobile crops, media library, videos).
2. For each missing live object, copy
   `backups/media/<path>` from GitHub into the `lumina-media` bucket at the same
   path.
3. Prefer the protected Supabase `oyon-backups/media/objects/<path>` copy when it
   exists and matches size.
4. External `https://` URLs that are not `lumina-media` are listed as
   `externalMediaCount` in the manifest. Those files were never stored on
   GitHub; restore them from the original host or leave the URL as-is.

Files larger than GitHub’s 100 MB blob limit were never uploaded. Treat them as
unrecoverable from GitHub and use Supabase `oyon-backups` instead.

## 5. Validate the recovered website

After the store write and media copies:

- Home, shop, and custom service pages in Arabic, Hebrew, and English
- Product prices, stock, and category memberships
- Lens inventory
- Booking calendar (do not open customer manage links in shared browsers)
- Branding, SEO, and WhatsApp **settings presence** (re-enter env tokens if
  messaging tests fail)

## 6. Roll back if recovery fails

1. Stop further writes.
2. Restore the safety snapshot taken in step 3 from Supabase
   (`store/pre-restore/`) using Admin → **التراجع عن آخر استعادة**, or by
   writing that JSON back to `lumina_store`.
3. Leave GitHub files unchanged. Do not delete dated snapshots while recovering.
4. Record the failed date and checksum in an internal note without customer
   payloads.

## Triggers and schedule

- GitHub “Backup All” is an **admin-triggered** production action
  (`POST /api/admin/github-backups`).
- It does **not** replace the existing daily Supabase backup cron.
- Press Backup All again to resume incomplete media copies. A failed run never
  deletes the latest valid dated snapshot.

## Safety

- Production-only write.
- No automatic production restore from GitHub.
- Client APIs return dates, counts, and checksums only.
- Retention (default 30 days, `GITHUB_BACKUP_RETENTION_DAYS`) runs only after a
  new dated snapshot is verified, and never removes the newest valid snapshot.

# OYON WhatsApp Web Service

Optional standalone WhatsApp provider for OYON Optics, built with [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js). This service is **separate** from the existing Meta WhatsApp Cloud API integration in the main Next.js app.

Do **not** connect booking flows to this service until explicitly approved.

## Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/health` | None | Service health + WhatsApp status summary |
| GET | `/status` | None | Connection state |
| GET | `/qr` | None | Latest QR for admin scanning |
| POST | `/send` | API key | Send a plain-text WhatsApp message |

### Connection states

- `INITIALIZING`
- `QR_REQUIRED`
- `AUTHENTICATED`
- `READY`
- `DISCONNECTED`
- `AUTH_FAILURE`

### POST `/send`

Headers:

```http
Authorization: Bearer <WHATSAPP_WEB_SERVICE_API_KEY>
```

Body:

```json
{
  "to": "972521234567",
  "message": "Hello from OYON"
}
```

Israeli numbers are normalized from formats such as `9725XXXXXXXX`, `05XXXXXXXX`, or `5XXXXXXXX`.

## Local development

```bash
cd whatsapp-web-service
cp .env.example .env
npm install
npm run dev
```

Then open:

- `GET http://localhost:3100/health`
- `GET http://localhost:3100/status`
- `GET http://localhost:3100/qr`

When status becomes `QR_REQUIRED`, scan the QR from `/qr` (`qrDataUrl` is suitable for an admin UI image).

Send test message:

```bash
curl -X POST http://localhost:3100/send \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"to":"972521234567","message":"Test"}'
```

## Persistent authentication

LocalAuth stores session data under `WWEBJS_AUTH_DATA_PATH` (default: `./data/wwebjs-auth`).

For Railway, mount a persistent volume to that path so WhatsApp sessions survive redeploys. Example:

```env
WWEBJS_AUTH_DATA_PATH=/data/wwebjs-auth
```

Do not rely on ephemeral container storage for auth data.

## Railway deployment (future)

Recommended setup:

1. Create a new Railway service from this directory (`whatsapp-web-service`).
2. Set environment variables:
   - `PORT` (Railway injects this automatically)
   - `WHATSAPP_WEB_SERVICE_API_KEY`
   - `WWEBJS_AUTH_DATA_PATH=/data/wwebjs-auth`
   - `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` if using a Chromium-enabled image
3. Attach a persistent volume at `/data/wwebjs-auth`.
4. Use a Linux-compatible Node image with Chromium dependencies installed.
5. Keep Puppeteer flags from `src/client.js` (`--no-sandbox`, `--disable-dev-shm-usage`, etc.) for containerized Linux.

Suggested start command:

```bash
npm start
```

After deploy:

1. Call `GET /status` until `QR_REQUIRED`.
2. Display `GET /qr` in the future OYON admin panel.
3. Scan once; session should persist on the mounted volume.

## Security notes

- Protect `/send` with `WHATSAPP_WEB_SERVICE_API_KEY`.
- Consider restricting `/qr` and `/status` behind admin auth when integrating with OYON.
- Logs intentionally avoid printing full phone numbers, message bodies, or secrets.

## Relationship to the main OYON app

The main Next.js app continues to use Meta WhatsApp Cloud API via `lib/whatsapp/provider.ts`. This service is an optional future provider and is not wired into booking, reminders, or admin settings yet.

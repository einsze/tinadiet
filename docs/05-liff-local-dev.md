# LIFF Local Development

LIFF features (`liff.getIDToken`, `liff.scanCode`, in-app browser handoff) only
work when the page is loaded **through LINE on a real device** against an
**HTTPS** URL. `localhost` will not work.

## Recommended setup: Cloudflare Tunnel

1. Install `cloudflared` (Windows: `winget install --id Cloudflare.cloudflared`).
2. `cloudflared tunnel --url http://localhost:5173` -> prints a temporary
   `https://*.trycloudflare.com` URL.
3. In the LINE Developers Console, set the LIFF Endpoint URL to that URL.
4. Open the LIFF from your phone (the LINE app -> chat -> LIFF entry).

## Alternative: ngrok

```
ngrok http 5173
```
Then point the LIFF Endpoint URL to the `https://*.ngrok-free.app` printed URL.

## Tips

- The tunnel URL changes each restart (free Cloudflare/ngrok). Update the
  LIFF Endpoint URL each time, OR pay for a stable subdomain.
- Backend tunnel: run a second `cloudflared`/`ngrok` for `http://localhost:3000`
  and set `VITE_API_BASE_URL` to that URL in `liff/.env`.
- For LINE webhook testing, the **same** backend tunnel URL goes into the
  Messaging API channel's webhook setting.
- LIFF can be opened in a desktop browser for non-LINE-specific UI work, but
  `liff.init` will run in "external browser" mode with limited APIs.

## Mock LIFF for pure UI work

Set `VITE_LIFF_ID=mock` in `liff/.env` to bypass LIFF init and inject a fake
user. Implemented in `src/lib/liff.ts` (added in Sprint 1).

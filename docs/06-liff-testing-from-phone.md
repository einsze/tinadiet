# Test LIFF dari HP (Sprint 1 M5)

LIFF SDK (`liff.getIDToken()`, `liff.scanCode()`, dst) **hanya jalan saat halaman
dibuka dari dalam LINE app via HTTPS URL**. `localhost` tidak bisa karena bukan
HTTPS dan LINE app tidak bisa reach machine lokal.

Untuk Sprint 1, pakai **Cloudflare Tunnel** (cloudflared) untuk expose Vite dev
server ke HTTPS URL temporary. Production hosting (Cloudflare Pages atau Railway
serve static) ditunda ke Sprint 2.

## Prasyarat

- `cloudflared` terinstall (skip kalau sudah):
  ```
  winget install --id Cloudflare.cloudflared
  ```
  Verifikasi: `cloudflared --version`

## Langkah test

### 1. Jalankan Vite dev server

Terminal A:
```
cd projects/liff
npm run dev
```
Vite serve di `http://localhost:5173`.

### 2. Buka tunnel ke localhost:5173

Terminal B (yang baru):
```
cloudflared tunnel --url http://localhost:5173
```

cloudflared akan print URL seperti:
```
https://random-words-here.trycloudflare.com
```

Salin URL ini.

### 3. Update LIFF Endpoint URL di LINE Developers Console

1. Buka: https://developers.line.biz/console/channel/2010309437/liff
2. Klik LIFF app **"Tina Diet"** (ID `2010309437-ER1WKReq`)
3. Field **"Endpoint URL"** → ganti dari `https://example.com` ke URL Cloudflare
   tadi (contoh: `https://random-words-here.trycloudflare.com`)
4. **Update**

> Endpoint URL ini akan berubah setiap kali Anda restart cloudflared (free tier
> tidak punya stable subdomain). Untuk dev yang sering, pertimbangkan ngrok
> stable subdomain ($8/mo) atau setup proper Cloudflare Pages di Sprint 2.

### 4. Buka LIFF dari LINE app di HP

1. Tap LIFF URL dari HP Anda: `https://liff.line.me/2010309437-ER1WKReq`
   (kirim ke diri sendiri lewat LINE Keep / Notes / email)
2. LINE app buka in-app browser → LIFF init
3. Anda akan lihat:
   - Loading "Initializing LIFF..."
   - Lalu "Authenticating..." (saat exchange ID token ke backend)
   - Lalu "Welcome, [nama LINE Anda] 👋" + DB user ID + display name

## Apa yang divalidasi

Jika halaman menampilkan "Welcome, ..." dengan data user benar:
- ✅ LIFF SDK init success
- ✅ LIFF returns valid ID token
- ✅ Backend `/api/v1/auth/exchange` verifies token via LINE
- ✅ Backend issues session JWT
- ✅ LIFF stores session, calls `/api/v1/users/me`
- ✅ User upserted di SQLite

**Itu = Sprint 1 closed.**

## Troubleshooting

| Gejala | Penyebab | Fix |
|---|---|---|
| Blank screen | Vite dev tidak jalan | Cek Terminal A masih running |
| LIFF init error | LIFF endpoint URL belum di-update | Update via Developers Console |
| "Failed to authenticate" + 401 | Backend reject ID token | Cek log Railway, pastikan LINE_LOGIN_CHANNEL_ID benar |
| "Failed to authenticate" + network error | API_BASE_URL salah | Cek `liff/.env` → `VITE_API_BASE_URL=https://api.tinadiet.com` |
| Loop redirect ke LINE Login | `isLoggedIn()` false | Buka LIFF lewat LIFF URL (liff.line.me/...), bukan langsung browser |

## Reset endpoint URL setelah test

Setelah selesai test, kembalikan LIFF Endpoint URL ke placeholder
`https://example.com` (atau biarkan trycloudflare URL kadaluarsa).

Saat production deploy nanti, endpoint URL akan jadi `https://app.tinadiet.com`
yang stabil.

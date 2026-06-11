# LINE Rich Menu Setup for TinaDiet OA

Persistent button bar that appears at the bottom of every LINE chat with TinaDiet. Replaces the URL-in-message gate links currently used (the gate replies still work as fallback).

## What this gives the user

A 6-button menu always visible inside the LINE chat that deep-links to specific LIFF pages:

```
+-------------+-------------+-------------+
|             |             |             |
|  Dashboard  |  Ask Tina   |   Premium   |
|     📊      |     💬      |     ⭐      |
|             |             |             |
+-------------+-------------+-------------+
|             |             |             |
|   Profile   |   Support   |  Log food   |
|     👤      |     🆘      |     📷      |
|             |             |             |
+-------------+-------------+-------------+
```

The 6th cell ("Log food") is a `richmenuswitch`/`postback` action that posts a friendly Thai prompt — useful for users who forget how to log.

## Two setup paths

Pick whichever is easier for you:

- **Path A — LINE OA Manager GUI** (no code, no API key juggling). Recommended for the first setup. ~10 minutes.
- **Path B — Messaging API script** (programmatic, reusable). Useful when you want to update the menu without re-uploading the image each time.

---

## Path A — LINE OA Manager GUI

### A.1 Prepare the menu background image

Required dimensions (one of):

| Layout | Pixel size | Areas |
| --- | --- | --- |
| Large (recommended for 6 buttons) | 2500 × 1686 | up to 6, 3 × 2 grid |
| Compact (4 buttons) | 2500 × 843 | up to 4, 4 × 1 grid |

Design tips:

- Pink/cream brand palette (matches the OnboardingSplash mascot card).
- Each cell needs a clear icon + Thai label (e.g. `📊 หน้าแรก`, `💬 ถาม Tina`, `⭐ Premium`, `👤 โปรไฟล์`, `🆘 ช่วยเหลือ`, `📷 บันทึกอาหาร`).
- Keep tappable area ≥ 600 × 500 px per cell on the large layout.
- Save as JPG or PNG, file size ≤ 1 MB.
- Generate with Canva, Figma, or any image tool — no special LINE template needed.

### A.2 Create the menu in OA Manager

1. Open <https://manager.line.biz>, pick the **TinaDiet** OA.
2. **Home → Menu → Rich Menu → Create**.
3. Title (internal only): `Main menu v1`.
4. Display name (shown to user in the chat keyboard): `เมนูหลัก`.
5. Template: pick **Large** (3 × 2). For 4-button compact, pick **Compact**.
6. Upload your background image from step A.1.
7. For each of the 6 areas, set the action to **Link**, URL = one of the LIFF deep links below, and label = a short Thai string for accessibility.

### A.3 LIFF deep links to paste into each area

Replace `<LIFF_ID>` with the LIFF ID from Sprint 1 (the `VITE_LIFF_ID` env var on Cloudflare; format `2010309437-xxxx`).

| Cell | URL | Action label |
| --- | --- | --- |
| Dashboard | `https://liff.line.me/<LIFF_ID>` | หน้าแรก |
| Ask Tina | `https://liff.line.me/<LIFF_ID>/chat` | ถาม Tina |
| Premium | `https://liff.line.me/<LIFF_ID>/premium` | Premium |
| Profile | `https://liff.line.me/<LIFF_ID>/profile` | โปรไฟล์ |
| Support | `https://liff.line.me/<LIFF_ID>/support` | ช่วยเหลือ |
| Log food | `https://liff.line.me/<LIFF_ID>` *(or set to a richmenu postback that sends the user a Thai prompt — see A.4)* | บันทึกอาหาร |

> The `/chat`, `/premium`, etc. paths are handled by the react-router-dom routes added in Sprint 5 M2. Cloudflare Workers Static Assets `not_found_handling = "single-page-application"` (already configured in `liff/wrangler.toml`) makes the SPA accept any path.

### A.4 Optional: turn the "Log food" tile into a chat prompt

Instead of opening the LIFF, you can set that cell's action to **Text** with content:

```
อยากบันทึกอาหารใช่ไหมคะ? พิมพ์ชื่ออาหารมาได้เลย เช่น "ผัดกะเพราไก่ไข่ดาว"
หรือถ้าเป็นสมาชิก Premium ส่งรูปอาหารมาได้ Tina คำนวณให้ค่ะ 📷
```

This is a `text` action — the OA Manager sends that string from the user side, so it triggers your existing webhook intent classifier and Tina replies normally.

### A.5 Display settings & publish

1. Set **Display period** = Always (until manually changed).
2. Set **Default behavior** = **On by default** (so the menu opens automatically when a user opens the chat).
3. Click **Save** and confirm.

The menu will appear in every TinaDiet chat within a few minutes for users who have added the bot.

---

## Path B — Messaging API script

If you want to script the setup, here is the high-level sequence using the LINE Messaging API (requires `LINE_CHANNEL_ACCESS_TOKEN`, which you already have in `SECRETS_TINADIET_LOCAL.md`).

```bash
# 1. Create the menu definition (returns richMenuId)
curl -X POST 'https://api.line.me/v2/bot/richmenu' \
  -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "size": { "width": 2500, "height": 1686 },
    "selected": true,
    "name": "Main menu v1",
    "chatBarText": "เมนูหลัก",
    "areas": [
      {
        "bounds": { "x": 0, "y": 0, "width": 833, "height": 843 },
        "action": { "type": "uri", "uri": "https://liff.line.me/<LIFF_ID>", "label": "หน้าแรก" }
      },
      {
        "bounds": { "x": 833, "y": 0, "width": 834, "height": 843 },
        "action": { "type": "uri", "uri": "https://liff.line.me/<LIFF_ID>/chat", "label": "ถาม Tina" }
      },
      {
        "bounds": { "x": 1667, "y": 0, "width": 833, "height": 843 },
        "action": { "type": "uri", "uri": "https://liff.line.me/<LIFF_ID>/premium", "label": "Premium" }
      },
      {
        "bounds": { "x": 0, "y": 843, "width": 833, "height": 843 },
        "action": { "type": "uri", "uri": "https://liff.line.me/<LIFF_ID>/profile", "label": "โปรไฟล์" }
      },
      {
        "bounds": { "x": 833, "y": 843, "width": 834, "height": 843 },
        "action": { "type": "uri", "uri": "https://liff.line.me/<LIFF_ID>/support", "label": "ช่วยเหลือ" }
      },
      {
        "bounds": { "x": 1667, "y": 843, "width": 833, "height": 843 },
        "action": { "type": "message", "text": "อยากบันทึกอาหาร", "label": "บันทึกอาหาร" }
      }
    ]
  }'

# 2. Upload the background image to that richMenuId
curl -X POST "https://api-data.line.me/v2/bot/richmenu/<RICH_MENU_ID>/content" \
  -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" \
  -H 'Content-Type: image/png' \
  --data-binary "@./rich-menu-bg.png"

# 3. Set it as the default for all users
curl -X POST "https://api.line.me/v2/bot/user/all/richmenu/<RICH_MENU_ID>" \
  -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN"
```

To replace the menu later (new design, new buttons), repeat the same flow with a new richMenuId and re-run step 3 with the new ID — it overwrites the default.

---

## Verifying after setup

1. Open the TinaDiet chat in LINE on your phone (force-quit and reopen the app if the menu does not appear).
2. The keyboard area should be hidden and the rich menu (or a small `เมนูหลัก` toggle) appears in its place.
3. Tap each cell and confirm:
   - Dashboard → opens LIFF on the `/` page.
   - Ask Tina → opens LIFF on `/chat`. If you are Free, the locked card shows.
   - Premium → opens LIFF on `/premium`. Free user sees the upgrade card; Premium user sees the manage card.
   - Profile → opens LIFF on `/profile`.
   - Support → opens LIFF on `/support` (FAQ + contact).
   - Log food → either opens LIFF home OR posts the Thai prompt into the chat (depending on which action you chose).

## Known gotchas

- The rich menu image must be a valid JPG/PNG ≤ 1 MB; transparent PNGs may render the chat background through the menu.
- LIFF deep links like `https://liff.line.me/<id>/chat` only work because Cloudflare SPA fallback is on. If you ever remove that fallback, the deep links will 404 — keep `not_found_handling = "single-page-application"` in `liff/wrangler.toml`.
- The "default for all users" call (`/v2/bot/user/all/richmenu/<id>`) replaces any previous default. There is no merge — be sure you have only one default at a time.
- LINE caches the rich menu client-side; users may need to clear LINE chat cache once after first activation. In practice the menu appears within a few minutes for everyone.

## When to re-run this

- After any change to LIFF route names (e.g. `/chat` → `/consult`).
- When you decide to launch under a `liff.line.me` deep link vs. a different domain.
- When you redesign the menu image (Path A: edit + republish; Path B: re-upload via step 2).

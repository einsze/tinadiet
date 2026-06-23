---
title: DB Queries
description: SQLite query snippets for ops, monitoring, and manual fixes.
sidebar:
  order: 1
---

Curated SQLite queries for ops and monitoring. Designed for **Railway
Console** (backend service → Console tab) since the DB lives on Railway
volume at `/data/app.db`. No `sqlite3` CLI in container — use `node -e`
inline.

:::tip[Source of truth]
This page mirrors `projects/ops/DB_QUERIES.md` in the repo. If you find
divergence, the repo version is canonical (it's the runbook the
maintainer uses day-to-day).
:::

## Quoting convention

Outer single quotes (bash escape-free), inner JS double quotes. For
multi-line SQL with `'` chars inside, escape with `\"`.

## ⚠️ Safety

Read-only queries are zero risk. Mutation queries (grant/revoke premium,
delete user) are clearly marked **`⚠ MUTATION`** — double-check user_id
before running, and always SELECT before UPDATE.

## 1. Quick health snapshot

The "is the DB alive?" sanity check + key counts at a glance.

```bash
node -e '
const db = require("better-sqlite3")("/data/app.db");
const q = (sql) => db.prepare(sql).get().n;
const out = {
  users_total:        q("SELECT COUNT(*) AS n FROM users"),
  profile_complete:   q("SELECT COUNT(*) AS n FROM users WHERE daily_calorie_goal IS NOT NULL"),
  premium_active:     q("SELECT COUNT(*) AS n FROM users WHERE plan=\"premium\" AND premium_expires_at > datetime(\"now\")"),
  signups_last_7d:    q("SELECT COUNT(*) AS n FROM users WHERE created_at >= datetime(\"now\",\"-7 days\")"),
  food_logs_today:    q("SELECT COUNT(*) AS n FROM food_logs WHERE date = date(\"now\",\"localtime\")"),
  food_logs_total:    q("SELECT COUNT(*) AS n FROM food_logs"),
  weight_logs_total:  q("SELECT COUNT(*) AS n FROM weight_logs"),
  chat_msgs_total:    q("SELECT COUNT(*) AS n FROM chat_messages"),
  chat_refusals:      q("SELECT COUNT(*) AS n FROM chat_messages WHERE refused = 1"),
  payments_success:   q("SELECT COUNT(*) AS n FROM payments WHERE status=\"successful\""),
  payments_pending:   q("SELECT COUNT(*) AS n FROM payments WHERE status=\"pending\""),
};
console.log(JSON.stringify(out, null, 2));
'
```

## 2. Users

### 2.1 List all users (table view)

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const rows=db.prepare("SELECT id, display_name AS name, substr(line_user_id, 1, 10) AS line_prefix, plan, substr(premium_expires_at, 1, 10) AS expires, CASE WHEN daily_calorie_goal IS NOT NULL THEN 1 ELSE 0 END AS onboarded, substr(created_at, 1, 10) AS joined FROM users ORDER BY id ASC").all();console.table(rows);console.log("Total:", rows.length);'
```

### 2.2 List premium users (with days remaining)

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const rows=db.prepare("SELECT id, display_name AS name, substr(premium_expires_at, 1, 10) AS expires, ROUND((julianday(premium_expires_at) - julianday(\"now\"))) AS days_left FROM users WHERE plan=\"premium\" AND premium_expires_at > datetime(\"now\") ORDER BY premium_expires_at ASC").all();console.table(rows);'
```

### 2.3 Drop-off: signed up but never completed profile

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const rows=db.prepare("SELECT id, display_name AS name, substr(line_user_id, 1, 10) AS line_prefix, substr(created_at, 1, 10) AS joined FROM users WHERE daily_calorie_goal IS NULL ORDER BY created_at DESC").all();console.table(rows);console.log("Dropped before onboarding:", rows.length);'
```

### 2.4 Active users (logged food in last 7 days)

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const rows=db.prepare("SELECT u.id, u.display_name AS name, u.plan, COUNT(f.id) AS logs_7d, MAX(f.logged_at) AS last_log FROM users u LEFT JOIN food_logs f ON f.user_id = u.id AND f.logged_at >= datetime(\"now\",\"-7 days\") GROUP BY u.id ORDER BY logs_7d DESC").all();console.table(rows);'
```

### 2.5 Find user by display name (partial match)

Replace `acare` with target name:

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const rows=db.prepare("SELECT id, display_name, line_user_id, plan, premium_expires_at, daily_calorie_goal FROM users WHERE LOWER(display_name) LIKE \"%acare%\"").all();console.log(JSON.stringify(rows, null, 2));'
```

### 2.6 New signups breakdown (last 30 days, daily)

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const rows=db.prepare("SELECT date(created_at) AS day, COUNT(*) AS signups FROM users WHERE created_at >= datetime(\"now\",\"-30 days\") GROUP BY date(created_at) ORDER BY day DESC").all();console.table(rows);'
```

## 3. Payments & revenue

### 3.1 All payments (most recent first)

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const rows=db.prepare("SELECT p.id, u.display_name AS user, p.method, p.status, p.amount_satang/100 AS thb, substr(p.completed_at, 1, 16) AS paid_at, substr(p.grant_ends_at, 1, 10) AS grant_until FROM payments p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.id DESC LIMIT 50").all();console.table(rows);'
```

### 3.2 Payment history for one user

Replace `2` with target user_id:

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const rows=db.prepare("SELECT id, method, status, amount_satang/100 AS thb, substr(completed_at, 1, 16) AS paid_at, substr(grant_starts_at, 1, 10) AS grant_from, substr(grant_ends_at, 1, 10) AS grant_to, failure_message FROM payments WHERE user_id = 2 ORDER BY id DESC").all();console.table(rows);'
```

### 3.3 Revenue summary (monthly, successful only)

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const rows=db.prepare("SELECT substr(completed_at, 1, 7) AS month, COUNT(*) AS txn, SUM(amount_satang)/100 AS thb, SUM(amount_satang) * 0.9535 / 100 AS net_thb FROM payments WHERE status = \"successful\" GROUP BY substr(completed_at, 1, 7) ORDER BY month DESC").all();console.table(rows);console.log("(net_thb = after Omise 4.65% fee, approx)");'
```

### 3.4 Pending payments older than 1 hour (stale charges)

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const rows=db.prepare("SELECT id, user_id, method, amount_satang/100 AS thb, substr(created_at, 1, 16) AS created, substr(expires_at, 1, 16) AS expires FROM payments WHERE status = \"pending\" AND created_at < datetime(\"now\", \"-1 hour\") ORDER BY created_at ASC").all();console.table(rows);'
```

## 4. Engagement

### 4.1 Today's food logs across all users

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const rows=db.prepare("SELECT f.id, u.display_name AS user, f.food_name_th AS food, f.kcal, f.source, substr(f.logged_at, 12, 5) AS time FROM food_logs f LEFT JOIN users u ON u.id = f.user_id WHERE f.date = date(\"now\",\"localtime\") ORDER BY f.logged_at DESC").all();console.table(rows);'
```

### 4.2 Log volume by source (manual vs chat_ai vs photo)

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const rows=db.prepare("SELECT source, COUNT(*) AS logs, AVG(kcal) AS avg_kcal FROM food_logs WHERE logged_at >= datetime(\"now\",\"-30 days\") GROUP BY source ORDER BY logs DESC").all();console.table(rows);'
```

### 4.3 Top 20 most-logged foods

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const rows=db.prepare("SELECT food_name_th AS food, COUNT(*) AS n, AVG(kcal) AS avg_kcal FROM food_logs WHERE food_name_th IS NOT NULL GROUP BY food_name_th ORDER BY n DESC LIMIT 20").all();console.table(rows);'
```

## 5. Chat / consultation

### 5.1 Refused questions (out-of-scope monitoring)

Useful to refine `SYSTEM_PROMPT` in `consultation.ts`:

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const rows=db.prepare("SELECT c.id, u.display_name AS user, prev.content AS question, substr(c.content, 1, 100) AS refusal, substr(c.created_at, 1, 16) AS at FROM chat_messages c JOIN chat_messages prev ON prev.user_id = c.user_id AND prev.id = c.id - 1 AND prev.role = \"user\" LEFT JOIN users u ON u.id = c.user_id WHERE c.refused = 1 ORDER BY c.id DESC LIMIT 20").all();console.table(rows);'
```

### 5.2 Chat quota usage today

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const rows=db.prepare("SELECT u.id, u.display_name AS name, u.plan, COUNT(c.id) AS questions_today FROM users u JOIN chat_messages c ON c.user_id = u.id AND c.role = \"user\" AND c.date = date(\"now\",\"localtime\") GROUP BY u.id ORDER BY questions_today DESC").all();console.table(rows);'
```

## 6. Funnel snapshot

```bash
node -e '
const db = require("better-sqlite3")("/data/app.db");
const q = (sql) => db.prepare(sql).get().n;
const signed = q("SELECT COUNT(*) AS n FROM users");
const onboarded = q("SELECT COUNT(*) AS n FROM users WHERE daily_calorie_goal IS NOT NULL");
const logged_food = q("SELECT COUNT(DISTINCT user_id) AS n FROM food_logs");
const used_chat = q("SELECT COUNT(DISTINCT user_id) AS n FROM chat_messages WHERE role = \"user\"");
const premium = q("SELECT COUNT(*) AS n FROM users WHERE plan = \"premium\"");
console.log("Funnel:");
console.log("  1. Signed up               :", signed);
console.log("  2. Completed profile       :", onboarded, "(" + (signed ? (onboarded*100/signed).toFixed(0) : 0) + "%)");
console.log("  3. Logged at least 1 food  :", logged_food, "(" + (signed ? (logged_food*100/signed).toFixed(0) : 0) + "%)");
console.log("  4. Used chat consultation  :", used_chat, "(" + (signed ? (used_chat*100/signed).toFixed(0) : 0) + "%)");
console.log("  5. Premium                 :", premium, "(" + (signed ? (premium*100/signed).toFixed(0) : 0) + "%)");
'
```

## 7. ⚠ MUTATIONS — handle with care

Always run the corresponding SELECT first to confirm the target row(s).

### 7.1 ⚠ Grant premium manually (e.g. beta tester)

Replace `<LINE_ID>` with target. Grant period = +30 days from now.

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const u=db.prepare("UPDATE users SET plan=\"premium\", premium_expires_at=datetime(\"now\",\"+30 days\"), updated_at=datetime(\"now\") WHERE line_user_id = ?").run("<LINE_ID>");console.log("Rows updated:", u.changes);'
```

### 7.2 ⚠ Revoke premium (reset to free)

Replace `2` with user_id:

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const u=db.prepare("UPDATE users SET plan=\"free\", premium_expires_at=NULL, updated_at=datetime(\"now\") WHERE id = ?").run(2);console.log("Rows updated:", u.changes);'
```

### 7.3 ⚠ Extend premium by N days (preserve stacking)

Replace `2` with user_id, `30` with day count:

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const u=db.prepare("UPDATE users SET premium_expires_at = datetime(COALESCE(premium_expires_at, datetime(\"now\")), \"+30 days\"), plan=\"premium\", updated_at=datetime(\"now\") WHERE id = ?").run(2);console.log("Rows updated:", u.changes);const row=db.prepare("SELECT id, plan, premium_expires_at FROM users WHERE id = ?").get(2);console.log("New state:", row);'
```

### 7.4 ⚠ Delete user + cascade

`ON DELETE CASCADE` removes all related rows. Replace `99` with user_id:

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const u=db.prepare("DELETE FROM users WHERE id = ?").run(99);console.log("Rows deleted:", u.changes);'
```

## 8. Sanity

### 8.1 Migrations applied

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const rows=db.prepare("SELECT name, applied_at FROM _migrations ORDER BY name").all();console.table(rows);'
```

### 8.2 Row counts per table

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const tables=["users","food_logs","weight_logs","chat_messages","subscriptions","payments"];for(const t of tables){const n=db.prepare("SELECT COUNT(*) AS n FROM "+t).get().n;console.log(t.padEnd(20), n);}'
```

### 8.3 DB file size

```bash
ls -lh /data/app.db
```

## 9. Tips

- **Date math**: SQLite's `datetime("now","-7 days")` is UTC. For Bangkok
  local, use `date("now","localtime")`. Most timestamps in this DB are
  stored UTC, except `food_logs.date` and `chat_messages.date` which are
  pre-computed in user TZ at insert.
- **`amount_satang / 100`** to convert to THB display.
- **REPL mode**: paste once, then type queries freely:
  ```bash
  node -i -e 'const db=require("better-sqlite3")("/data/app.db");const q=(s)=>console.table(db.prepare(s).all());const c=(s)=>console.log(db.prepare(s).get());'
  ```
  Then: `q("SELECT * FROM users LIMIT 5")`. Exit with `.exit`.

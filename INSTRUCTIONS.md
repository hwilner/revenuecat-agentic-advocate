# RevenueCat Interview Agent (Vercel)

This repo is a **deployable Next.js app** for Vercel.

It implements:
- **Two modes**: `execution` (do ongoing RevenueCat work) + `interview` (explain + demo the same system).
- **RevenueCat MCP integration** (remote MCP server at `https://mcp.revenuecat.ai/mcp`).
- **Guardrails**: the agent is limited to the RevenueCat work description.
- **Upgrade tokens (single-use)**: if a user requests **extra/out-of-scope work** (or **write actions**), the system generates a **single-use token** and sends it to you via **Telegram**. The user must paste that token to proceed.
- **Quota lock hyperparameters** (env vars): after a daily free limit is reached, the agent **locks** and **demands a Telegram token** for any further requests that day.
- **Public application artifacts**: the agent can publish a public application letter at `/application-letter` and a portfolio index at `/portfolio` (required by RevenueCat). [Source](https://jobs.ashbyhq.com/revenuecat/998a9cef-3ea5-45c2-885b-8a00c4eeb149)
- **Apply helper page**: `/apply` shows exactly what to paste into the application form.
- **Self-editing (Ouroboros-inspired, owner-approved)**: the agent can update its own *operating prompt addendum* and *positioning* via a tool, but only after an upgrade token is validated. This is inspired by Ouroboros’ self-modification concept and its “constitution” approach. [Source](https://github.com/joi-lab/ouroboros)
- **Postgres persistence** (recommended: Neon via Vercel Marketplace) for runs + tokens + usage counters.

---

## 1) Prerequisites (accounts / keys)

### A) OpenAI API key
Create a key and keep it private.

### B) RevenueCat MCP secret key (API v2)
RevenueCat MCP is authenticated with a **Bearer** token (API v2 secret key). RevenueCat MCP docs show the endpoint + Bearer usage. [Source](https://www.revenuecat.com/docs/tools/mcp/setup)

### C) Telegram bot + chat id
You need:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Quick path:
1. In Telegram, open **@BotFather** → create a bot → copy the token.
2. Send a message to your bot.
3. Get your chat id (use any “getUpdates” helper). Example URL (open in browser):
   `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   Look for `chat":{"id":...}`.

### D) Postgres database
You need a Postgres database so the agent can store evidence and tokens.

**Recommended (easy): Neon via Vercel Marketplace.**
Vercel will provision it and inject `DATABASE_URL` as an environment variable.

---

## 2) Put this code into GitHub (why GitHub?)

Vercel deploys by **importing a Git repository**.

1. Create a new GitHub repo (empty).
2. Copy this project into it.
3. Push.

---

## 3) Deploy on Vercel

1. Go to Vercel → **Add New → Project**
2. **Import** your GitHub repo
3. Click **Deploy**

---

## 4) Add Postgres (Neon) on Vercel

1. In your Vercel Project → **Storage**
2. Add **Postgres** (choose Neon)
3. Finish provisioning

Vercel will add a `DATABASE_URL` env var for you.

---

## 5) Set Environment Variables on Vercel

Vercel env vars are configured in **Project → Settings → Environment Variables**. [Source](https://vercel.com/docs/environment-variables)

Add these (mark secrets as **Sensitive**):

### Required (Sensitive)
- `OPENAI_API_KEY`
- `DATABASE_URL` (Vercel usually injects this after you add Postgres)
- `REVENUECAT_API_V2_SECRET_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TOKEN_SIGNING_SECRET` (any long random string)
- `INIT_SECRET` (any long random string)
- `CRON_SECRET` (any long random string)

### Optional
- `REVENUECAT_MCP_URL` (default `https://mcp.revenuecat.ai/mcp`)
- `OPENAI_MODEL` (default `gpt-4o-mini`)
- `GUARDRAILS_ENABLED` (`true` recommended)
- `TOKEN_ESCALATION_ENABLED` (`true` recommended)
- `UPGRADE_TOKEN_TTL_MINUTES` (default `30`)
- `RATE_LIMIT_PER_IP_PER_MINUTE` (default `0`, disabled; set >0 to enable simple per-IP/minute spend protection)

### Quota hyperparameters (threshold-based lock)
Set any of these to a number > 0 to enable quota locking. When exceeded, the API will **demand an upgrade token** (sent to you via Telegram) *even for in-scope requests*.

- `FREE_RUNS_PER_DAY_TOTAL` (global daily limit across all modes, UTC)
- `FREE_RUNS_PER_DAY_INTERVIEW` (daily limit for interview mode, UTC)
- `FREE_RUNS_PER_DAY_EXECUTION` (daily limit for execution mode, UTC)

Example (let people try a bit, then lock for the rest of the day):
- `FREE_RUNS_PER_DAY_TOTAL=20`
- `FREE_RUNS_PER_DAY_INTERVIEW=10`
- `FREE_RUNS_PER_DAY_EXECUTION=10`

Set all of them to `0` (default) to disable quota locking.

After you add/edit env vars, **redeploy** (env var changes apply only to new deployments). [Source](https://vercel.com/docs/environment-variables)

---

## 6) Initialize the database (one-time)

After deployment, open:

`https://YOUR_DOMAIN/api/admin/init`

Preferred auth header:

`Authorization: Bearer INIT_SECRET`

(Legacy supported: `?token=INIT_SECRET`.)

Expected response:

```json
{"ok":true}
```

---

## 7) Publish the public application letter + portfolio URL

RevenueCat requires the agent to publish a **public application letter** and submit its URL. [Source](https://jobs.ashbyhq.com/revenuecat/998a9cef-3ea5-45c2-885b-8a00c4eeb149)

This repo includes public pages:
- `/apply` (checklist page that maps the form fields)
- `/application-letter` (the published application letter)
- `/portfolio` (public portfolio index)
- `/p/<slug>` (any additional published artifact)

To publish the application letter, ask the agent (via UI or API) to **write and publish** it. The agent will store it in Postgres (table `public_artifacts`) and the page becomes publicly viewable.

Example prompt (the agent will call its own publishing tool):

Tip: include explicit instructions for the publish tool (slug/kind) to make the run deterministic.

```
Write our public application letter answering:
"How will the rise of agentic AI change app development and growth over the next 12 months, and why are you the right agent to be RevenueCat’s first Agentic AI Developer & Growth Advocate?"

Then publish it by calling publish_public_artifact with:
- slug: "application-letter"
- kind: "application-letter"
- title: "Agentic AI Advocate — Application Letter"
- content_md: (the letter in Markdown)

Finally, return the public URL to /application-letter.
```

Note: publishing writes to the database, so the guardrails may request an upgrade token (Telegram) depending on your policy.

## 8) Fill the application form quickly

Open:
- `/apply`

It shows exactly what URLs to paste into the RevenueCat form.

## 9) Use the agent

### A) Web UI
Open the homepage `/`.

### B) API (curl)

Interview mode:

```bash
curl -sS https://YOUR_DOMAIN/api/agent \
  -H 'content-type: application/json' \
  -d '{"mode":"interview","prompt":"Explain your architecture and how you prevent fabrication."}'
```

Execution mode (example):

```bash
curl -sS https://YOUR_DOMAIN/api/agent \
  -H 'content-type: application/json' \
  -d '{"mode":"execution","prompt":"List all apps in my RevenueCat project."}'
```

Out-of-scope request (will trigger Telegram token):

```bash
curl -sS https://YOUR_DOMAIN/api/agent \
  -H 'content-type: application/json' \
  -d '{"mode":"execution","prompt":"Write me a crypto trading bot."}'
```

You will receive a token in Telegram. Then retry with:

```bash
curl -sS https://YOUR_DOMAIN/api/agent \
  -H 'content-type: application/json' \
  -d '{"mode":"execution","prompt":"Write me a crypto trading bot.","upgrade_token":"PASTE_TOKEN"}'
```

---

## 10) Cron (optional)

This repo includes a Vercel Cron that calls `/api/cron` weekly (UTC). Cron docs: [Source](https://vercel.com/docs/cron-jobs)

Protect it with an auth header:

`Authorization: Bearer CRON_SECRET`

(Legacy supported: `?token=CRON_SECRET`.)

---

## Notes / Safety

- RevenueCat MCP supports **read** and **write** tools (26 total). [Source](https://www.revenuecat.com/docs/tools/mcp/tools-reference)
- This app defaults to **read-only MCP tool exposure** unless an upgrade token is provided.
- Do not expose secrets to the browser (never use `NEXT_PUBLIC_*` for keys).

# meetup-lite

A when2meet-style scheduling tool, mobile-first, with Discord login and a companion Discord bot. Runs as **one process in one Docker container** — the web server, the Discord bot's webhook handling, and a SQLite database file all together, no other services required.

## What's new in this version

- **Docker**: the whole thing now ships as a single container (see below).
- **Discord OAuth login**: creating an event or entering availability now requires logging in with Discord — that's how meetup-lite knows who's who, instead of free-typed names.
- **A real Discord bot**: `/meet create` posts a public "tracker" message (built with Components V2) showing the event, who's been tagged to respond, and the best time so far. Clicking **Enter availability** opens a private (ephemeral) message where you pick your times — nobody else sees that message. The organizer can tag specific people as expected responders and nudge whoever hasn't answered yet.

This is a breaking change from the single-file version: the database schema changed (identity is now keyed by Discord user ID, not by a typed name) and the participant API moved from `/api/events/:id/participants/:name` to `/api/events/:id/me` (identity comes from your session now, not the URL). **Start with a fresh `data.db`** — there isn't a meaningful migration path from the old schema.

## Quick start (Docker)

```bash
cp .env.example .env
# fill in .env — see "Setting up the Discord application" below
docker compose up -d --build
```

That's it: `docker compose up` builds the image, starts the container, and persists the SQLite file in a named volume (`meetup-data`) so it survives restarts and rebuilds.

Without Docker: `node server.js` (needs Node 22.5+, for `node:sqlite`). Zero npm dependencies either way.

## Setting up the Discord application

You need one Discord Application for both login and the bot.

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. **OAuth2 → General**: copy the **Client ID** and **Client Secret** into `.env` as `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`.
3. Still on **OAuth2 → General**, add a redirect: `https://your-domain.com/auth/discord/callback` (must exactly match your `BASE_URL` in `.env` + `/auth/discord/callback`). This step alone is enough for login to work — the bot is optional.
4. To also enable the bot:
   - **Bot** tab → **Reset Token**, copy it into `.env` as `DISCORD_BOT_TOKEN`.
   - **General Information** tab → copy **Public Key** into `.env` as `DISCORD_PUBLIC_KEY`.
   - **General Information** tab → set **Interactions Endpoint URL** to `https://your-domain.com/discord/interactions`. Discord will send a test ping here — it must resolve *after* your container is already running with `DISCORD_PUBLIC_KEY` set, or verification fails.
   - **Installation** tab (or **OAuth2 → URL Generator** with the *Guild Install* integration type): scopes `bot` and `applications.commands`; bot permissions `Send Messages`, `Embed Links`, `Use Slash Commands`, `Mention Everyone` (needed so the responder-tag pings actually notify people). Open the generated URL to add the bot to your server. The in-app **Add Bot to Server** button uses this same Guild Install URL (`integration_type=1`), so it works even though the app has no OAuth2 code-grant redirect configured — if you build your own invite URL instead and leave off `integration_type=1`, Discord will reject it with "Integration requires code grant".
5. Restart the container after changing `.env` — slash commands are (re-)registered automatically on every boot when `DISCORD_BOT_TOKEN` is set.

If you only ever intend to use the web app (no bot), you can skip step 4 entirely — `DISCORD_BOT_TOKEN` / `DISCORD_PUBLIC_KEY` are optional and everything else still works.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `BASE_URL` | yes | Public https URL, no trailing slash. Used for the OAuth redirect and the "View full grid" link the bot posts. |
| `DISCORD_CLIENT_ID` | yes | Discord application ID (OAuth + bot, same app). |
| `DISCORD_CLIENT_SECRET` | yes | Discord OAuth2 client secret. |
| `DISCORD_BOT_TOKEN` | no | Enables the bot: posting/editing the tracker message, sending reminder pings. |
| `DISCORD_PUBLIC_KEY` | no | Enables the bot: verifies that `/discord/interactions` requests really came from Discord. |
| `PORT` | no | Default `3000`. |
| `DB_PATH` | no | Default `/data/data.db` in the container (`./data.db` outside it). |

## How it works

### Identity

Every participant is a Discord user, whether they respond via the website or via the bot — `discord_id` is the join key across both surfaces, so someone who half-fills in their availability on Discord and finishes on the web (or vice versa) is editing the same response, not creating a duplicate.

### Web

- `GET /` — create an event (requires login).
- `GET /e/:id` — view an event and enter your availability (viewing is public; entering availability requires login). The page carries Open Graph / Twitter Card meta tags, so sharing the link in Discord, iMessage, Slack, etc. unfurls a rich embed with the event title, date range, how many people have signed up (once anyone has), and the current matched date (once one exists).
- A **matched date** is only reported once at least two people have entered their availability — one person's free slots aren't a match with anyone. Until then the results view and the Discord tracker say they're waiting on more people.
- `GET /` and `GET /e/:id` show an **Add Bot to Server** button when `DISCORD_CLIENT_ID` is configured.
- On `GET /e/:id`, **My availability** includes a **Copy day pattern** action so you can copy one day's selected slots to other day tabs before saving.
- Day tabs on `GET /e/:id` now show a swipe hint automatically when tabs overflow horizontally.
- Full REST API (`/api/events`, `/api/events/:id`, `/api/events/:id/me`, `/api/events/:id/results`) — see the comment block at the top of `server.js` for the exact contract. The web page is just one consumer of this API.

### Discord bot

- **`/meet create`** — opens a modal (title, dates, time window, timezone, slot size) and posts a public tracker message in that channel.
- **Enter availability** (button on the tracker) — opens an ephemeral (private) message with one dropdown per day; picks save instantly and update the public tracker's response count. Discord's select menus cap out at 25 options and the UI only shows the first 4 days at once — for longer or finer-grained events, use **View full grid** to finish on the web instead.
- **Manage responders** (organizer only) — opens a private user-picker to tag who's expected to respond; newly tagged people get a one-off ping message so they're actually notified (editing the tracker message itself doesn't re-notify anyone, per how Discord works).
- **Remind pending** (organizer only) — pings everyone tagged who hasn't responded yet.

### Timezones

Unchanged from before: every slot is an absolute UTC instant under the hood. The web page converts to each viewer's own detected timezone; the bot shows everything in the event's configured timezone (since a shared tracker message can't be personalized per reader) and labels it clearly.

## Local development (no Docker)

```bash
node --version   # need 22.5+
cp .env.example .env   # fill in at least DISCORD_CLIENT_ID/SECRET + BASE_URL=http://localhost:3000
node server.js
```

For local bot testing you'll need a tunnel (e.g. `cloudflared` or `ngrok`) so Discord can reach `/discord/interactions`, since Discord doesn't support `localhost` as an Interactions Endpoint URL.

## Known limitations

- No timezone handling beyond what's described above — see the earlier notes if you're curious about the DST math (`src/time.js`).
- No auth beyond "logged in as yourself" — anyone with the link can view an event and, once logged in, submit their own availability. There's no concept of a private/invite-only event.
- Discord's component limits mean bot-created events are capped at 25 time slots/day and the in-Discord picker only shows the first 4 days — the web app has neither limit.
- "Manage responders" and "Remind pending" are Discord-only; there's no web UI for them yet (the tracker on the web page is read-only).
- Sessions and OAuth login state live in the same SQLite file as everything else — fine at this scale, but there's no separate session store.

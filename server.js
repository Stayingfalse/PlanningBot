#!/usr/bin/env node
/**
 * meetup-lite — a when2meet-style scheduling tool with Discord OAuth login and
 * a companion Discord bot (Components V2, ephemeral responses, a public tracker).
 *
 * Runs as one process / one container. Data lives in a single SQLite file
 * (node:sqlite, built into Node — no native deps to compile).
 *
 * ── Architecture ─────────────────────────────────────────────────────────
 * Everything state-changing goes through the functions in src/db.js and
 * src/results.js. The HTTP routes below and the Discord interaction handlers
 * in src/interactions.js are both just callers of those same functions —
 * a person can create an event and respond via the web UI, via `/meet
 * create` in Discord, or a mix of both, and it's all the same data.
 *
 * ── Required environment ─────────────────────────────────────────────────
 * BASE_URL                Public https URL this is reachable at (no trailing slash)
 * DISCORD_CLIENT_ID       Discord application id (OAuth + bot, same app)
 * DISCORD_CLIENT_SECRET   Discord OAuth2 client secret
 *
 * ── Optional (enables the Discord bot side) ─────────────────────────────
 * DISCORD_BOT_TOKEN       Bot token, for posting/editing the tracker message
 * DISCORD_PUBLIC_KEY      App's public key, for verifying interaction webhooks
 *
 * ── Other ────────────────────────────────────────────────────────────────
 * PORT      default 3000
 * DB_PATH   default ./data.db
 * See README.md for full setup instructions (Discord Developer Portal steps,
 * Docker instructions, etc).
 */

'use strict';

const http = require('node:http');

const db = require('./src/db');
const oauth = require('./src/oauth');
const rest = require('./src/discordRest');
const interactions = require('./src/interactions');
const { computeResults } = require('./src/results');
const { isValidTimeZone, generateSlots } = require('./src/time');
const { homePage, eventPage } = require('./src/web');

const PORT = process.env.PORT || 3000;

// ── Small helpers ───────────────────────────────────────────────────────

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}
function sendHtml(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}
function redirect(res, location, extraHeaders) {
  res.writeHead(302, { Location: location, ...extraHeaders });
  res.end();
}
function readRawBody(req, limitBytes = 2_000_000) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let len = 0;
    req.on('data', (chunk) => {
      len += chunk.length;
      if (len > limitBytes) { req.destroy(); reject(new Error('body too large')); return; }
      raw += chunk;
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}
async function readJsonBody(req) {
  const raw = await readRawBody(req);
  if (!raw) return {};
  return JSON.parse(raw);
}

function validEventInput(body) {
  if (!body || typeof body.title !== 'string' || !body.title.trim()) return 'title is required';
  if (!Array.isArray(body.dates) || body.dates.length === 0) return 'dates must be a non-empty array';
  for (const d of body.dates) if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return `invalid date: ${d}`;
  const startHour = Number(body.startHour);
  const endHour = Number(body.endHour);
  const slotMinutes = Number(body.slotMinutes);
  if (!Number.isInteger(startHour) || startHour < 0 || startHour > 23) return 'invalid startHour';
  if (!Number.isInteger(endHour) || endHour < 1 || endHour > 24) return 'invalid endHour';
  if (endHour <= startHour) return 'endHour must be after startHour';
  if (![15, 30, 60].includes(slotMinutes)) return 'slotMinutes must be 15, 30, or 60';
  if (typeof body.timezone !== 'string' || !isValidTimeZone(body.timezone)) return 'invalid or missing timezone';
  return null;
}

// ── Router ──────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean);

    // GET /
    if (req.method === 'GET' && parts.length === 0) {
      return sendHtml(res, 200, homePage(oauth.getViewer(req)));
    }

    // GET /e/:id  — page shell only; data comes from /api/*
    if (req.method === 'GET' && parts[0] === 'e' && parts.length === 2) {
      const event = db.getEvent(parts[1]);
      if (!event) return sendHtml(res, 404, '<h1>Event not found</h1>');
      return sendHtml(res, 200, eventPage(parts[1]));
    }

    // ── Auth ──
    if (req.method === 'GET' && parts[0] === 'auth' && parts[1] === 'discord' && parts.length === 2) {
      if (!oauth.configured()) return sendHtml(res, 500, '<h1>Discord login is not configured</h1><p>Set DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, and BASE_URL.</p>');
      const next = url.searchParams.get('next') || '/';
      return redirect(res, oauth.loginUrl(next));
    }
    if (req.method === 'GET' && parts[0] === 'auth' && parts[1] === 'discord' && parts[2] === 'callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code || !state) return sendHtml(res, 400, '<h1>Missing code or state</h1>');
      try {
        const { sessionId, nextPath } = await oauth.handleCallback(code, state);
        return redirect(res, nextPath || '/', { 'Set-Cookie': oauth.sessionCookie(sessionId) });
      } catch (e) {
        return sendHtml(res, 400, `<h1>Login failed</h1><p>${e.message}</p><p><a href="/">Try again</a></p>`);
      }
    }
    if (req.method === 'GET' && parts[0] === 'auth' && parts[1] === 'logout') {
      const { sid } = oauth.parseCookies(req);
      if (sid) db.deleteSession(sid);
      return redirect(res, '/', { 'Set-Cookie': oauth.clearSessionCookie() });
    }

    // GET /api/me
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'me') {
      const viewer = oauth.getViewer(req);
      if (!viewer) return sendJson(res, 401, { error: 'not logged in' });
      return sendJson(res, 200, viewer);
    }

    // POST /api/events
    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'events' && parts.length === 2) {
      const viewer = oauth.getViewer(req);
      if (!viewer) return sendJson(res, 401, { error: 'log in with Discord first' });
      const body = await readJsonBody(req);
      const err = validEventInput(body);
      if (err) return sendJson(res, 400, { error: err });
      const id = db.createEvent({
        title: body.title.trim(), dates: body.dates, startHour: Number(body.startHour),
        endHour: Number(body.endHour), slotMinutes: Number(body.slotMinutes), timezone: body.timezone,
        createdByDiscordId: viewer.discordId, createdByName: viewer.username, guildId: null,
      });
      return sendJson(res, 201, { id });
    }

    // GET /api/events/:id
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'events' && parts.length === 3) {
      const event = db.getEvent(parts[2]);
      if (!event) return sendJson(res, 404, { error: 'not found' });
      const slots = generateSlots(event.dates, event.startHour, event.endHour, event.slotMinutes, event.timezone);
      const participants = db.getParticipantsWithSlots(parts[2]);
      const expectedResponders = computeResults(parts[2]).expectedResponders;
      return sendJson(res, 200, { ...event, slots, participants, expectedResponders });
    }

    // GET /api/events/:id/results
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'events' && parts.length === 4 && parts[3] === 'results') {
      if (!db.getEvent(parts[2])) return sendJson(res, 404, { error: 'not found' });
      return sendJson(res, 200, computeResults(parts[2]));
    }

    // PUT /api/events/:id/me
    if (req.method === 'PUT' && parts[0] === 'api' && parts[1] === 'events' && parts[3] === 'me' && parts.length === 4) {
      const viewer = oauth.getViewer(req);
      if (!viewer) return sendJson(res, 401, { error: 'log in with Discord first' });
      const event = db.getEvent(parts[2]);
      if (!event) return sendJson(res, 404, { error: 'not found' });
      const body = await readJsonBody(req);
      const slots = Array.isArray(body.slots) ? body.slots.filter((s) => typeof s === 'string') : [];
      db.upsertParticipant({ eventId: parts[2], discordId: viewer.discordId, name: viewer.username, slots });
      if (rest.botConfigured() && event.trackerChannelId && event.trackerMessageId) {
        interactions.refreshTracker(parts[2]).catch((e) => console.error('Tracker refresh failed:', e));
      }
      return sendJson(res, 200, { ok: true });
    }

    // DELETE /api/events/:id/me
    if (req.method === 'DELETE' && parts[0] === 'api' && parts[1] === 'events' && parts[3] === 'me' && parts.length === 4) {
      const viewer = oauth.getViewer(req);
      if (!viewer) return sendJson(res, 401, { error: 'log in with Discord first' });
      db.removeParticipant(parts[2], viewer.discordId);
      return sendJson(res, 200, { ok: true });
    }

    // POST /discord/interactions — Discord webhook. Signature must be checked
    // against the EXACT raw bytes Discord sent, before any JSON parsing.
    if (req.method === 'POST' && parts[0] === 'discord' && parts[1] === 'interactions') {
      if (!rest.botConfigured()) return sendJson(res, 501, { error: 'bot not configured' });
      const rawBody = await readRawBody(req);
      const signature = req.headers['x-signature-ed25519'];
      const timestamp = req.headers['x-signature-timestamp'];
      if (!rest.verifyDiscordSignature(rawBody, signature, timestamp)) {
        res.writeHead(401); return res.end('invalid request signature');
      }
      let interaction;
      try { interaction = JSON.parse(rawBody); } catch (e) { return sendJson(res, 400, { error: 'malformed body' }); }

      const { response, followUp } = await interactions.handleInteraction(interaction);
      sendJson(res, 200, response);
      if (followUp) followUp().catch((e) => console.error('Interaction follow-up failed:', e));
      return;
    }

    sendJson(res, 404, { error: 'not found' });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) sendJson(res, 500, { error: 'internal error' });
  }
});

server.listen(PORT, () => {
  console.log(`meetup-lite running on port ${PORT}`);
  if (!oauth.configured()) {
    console.warn('Discord OAuth is not configured (DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET / BASE_URL) — logins will fail.');
  }
  if (rest.botConfigured()) {
    interactions.registerCommandsIfConfigured();
  } else {
    console.log('Discord bot not configured (DISCORD_BOT_TOKEN / DISCORD_PUBLIC_KEY) — /discord/interactions is disabled, web-only mode.');
  }
});

// Opportunistic cleanup of expired sessions / stale OAuth state, so these
// tables don't grow forever in a long-running container.
setInterval(() => db.cleanupExpired(), 60 * 60 * 1000).unref();

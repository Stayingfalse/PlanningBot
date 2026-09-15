'use strict';

const db = require('./db');

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const BASE_URL = (process.env.BASE_URL || '').replace(/\/+$/, '');
const BOT_PERMISSIONS = '2147633152';

function configured() {
  return Boolean(CLIENT_ID && CLIENT_SECRET && BASE_URL);
}

function redirectUri() {
  return `${BASE_URL}/auth/discord/callback`;
}

function installRedirectUri() {
  return `${BASE_URL}/auth/discord/install/callback`;
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function sessionCookie(sessionId) {
  const secure = BASE_URL.startsWith('https://') ? '; Secure' : '';
  return `sid=${sessionId}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax${secure}`;
}

function clearSessionCookie() {
  return 'sid=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax';
}

// Reads the viewer's session from the request, or null if not logged in / expired.
function getViewer(req) {
  const { sid } = parseCookies(req);
  return db.getSession(sid);
}

function loginUrl(nextPath) {
  const state = db.createOAuthState(nextPath || '/');
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'identify',
    state,
  });
  return `https://discord.com/api/oauth2/authorize?${params}`;
}

function installUrl(nextPath) {
  const state = db.createOAuthState(nextPath || '/');
  // Use Guild Install (integration_type=0) plus a real code-grant callback so
  // bot invites keep working even when the Discord app requires OAuth2 code
  // grant for bot authorization.
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    permissions: BOT_PERMISSIONS,
    integration_type: '0',
    scope: 'bot applications.commands',
    response_type: 'code',
    redirect_uri: installRedirectUri(),
    state,
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

async function exchangeCode(code, uri) {
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: uri,
    }),
  });
  if (!tokenRes.ok) throw new Error(`Discord token exchange failed (${tokenRes.status})`);
  return tokenRes.json();
}

// Exchanges an OAuth2 `code` for a Discord identity, upserts the user, and opens a session.
// Returns { sessionId, nextPath }. Throws on any failure (bad/expired state, bad code, etc).
async function handleCallback(code, state) {
  const nextPath = db.consumeOAuthState(state);
  if (nextPath === null) throw new Error('invalid or expired login attempt — please try logging in again');

  const tokenData = await exchangeCode(code, redirectUri());

  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!userRes.ok) throw new Error(`Discord profile fetch failed (${userRes.status})`);
  const user = await userRes.json();

  const displayName = user.global_name || user.username;
  db.upsertUser({ discordId: user.id, username: displayName, avatar: user.avatar });
  const sessionId = db.createSession(user.id);
  return { sessionId, nextPath };
}

async function handleInstallCallback(code, state) {
  const nextPath = db.consumeOAuthState(state);
  if (nextPath === null) throw new Error('invalid or expired bot-install attempt — please try again');
  await exchangeCode(code, installRedirectUri());
  return { nextPath };
}

module.exports = {
  configured, loginUrl, installUrl, handleCallback, handleInstallCallback,
  parseCookies, sessionCookie, clearSessionCookie, getViewer,
};

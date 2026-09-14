'use strict';

const { createPublicKey, verify } = require('node:crypto');

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const APPLICATION_ID = process.env.DISCORD_CLIENT_ID; // the bot's application id is the OAuth client id
const PUBLIC_KEY_HEX = process.env.DISCORD_PUBLIC_KEY;
const API_BASE = 'https://discord.com/api/v10';

function botConfigured() {
  return Boolean(BOT_TOKEN && APPLICATION_ID && PUBLIC_KEY_HEX);
}

// ── Ed25519 request signature verification ─────────────────────────────
// Discord signs every interaction webhook POST with its application's Ed25519
// key. The public key is a 32-byte value; Node's crypto.createPublicKey needs
// it wrapped in a minimal DER/SPKI header (a fixed 12-byte prefix for Ed25519,
// since there are no algorithm parameters to encode) before it can verify.
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

let cachedKeyObject = null;
function publicKeyObject() {
  if (cachedKeyObject) return cachedKeyObject;
  const raw = Buffer.from(PUBLIC_KEY_HEX, 'hex');
  if (raw.length !== 32) throw new Error('DISCORD_PUBLIC_KEY must be a 32-byte hex string');
  const der = Buffer.concat([ED25519_SPKI_PREFIX, raw]);
  cachedKeyObject = createPublicKey({ key: der, format: 'der', type: 'spki' });
  return cachedKeyObject;
}

// rawBody MUST be the exact bytes Discord sent — never JSON.parse'd and re-stringified.
function verifyDiscordSignature(rawBody, signatureHex, timestamp) {
  try {
    if (!signatureHex || !timestamp) return false;
    const sig = Buffer.from(signatureHex, 'hex');
    if (sig.length !== 64) return false;
    const message = Buffer.concat([Buffer.from(timestamp, 'utf8'), Buffer.from(rawBody, 'utf8')]);
    return verify(null, message, publicKeyObject(), sig);
  } catch (e) {
    return false;
  }
}

// ── Bot REST API ────────────────────────────────────────────────────────

async function discordApi(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discord API ${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function postMessage(channelId, payload) {
  return discordApi('POST', `/channels/${channelId}/messages`, payload);
}

function editMessage(channelId, messageId, payload) {
  return discordApi('PATCH', `/channels/${channelId}/messages/${messageId}`, payload);
}

// Registers (or updates) the bot's global slash commands. Idempotent — safe to call on every boot.
function registerGlobalCommands(commands) {
  return discordApi('PUT', `/applications/${APPLICATION_ID}/commands`, commands);
}

module.exports = {
  botConfigured, verifyDiscordSignature, discordApi, postMessage, editMessage, registerGlobalCommands,
};

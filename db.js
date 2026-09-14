'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data.db');
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    dates TEXT NOT NULL,
    start_hour INTEGER NOT NULL,
    end_hour INTEGER NOT NULL,
    slot_minutes INTEGER NOT NULL,
    timezone TEXT NOT NULL,
    created_by_discord_id TEXT NOT NULL,
    created_by_name TEXT NOT NULL,
    guild_id TEXT,
    tracker_channel_id TEXT,
    tracker_message_id TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS participants (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id),
    discord_id TEXT NOT NULL,
    name TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(event_id, discord_id)
  );
  CREATE TABLE IF NOT EXISTS availability (
    participant_id TEXT NOT NULL REFERENCES participants(id),
    slot TEXT NOT NULL,
    PRIMARY KEY (participant_id, slot)
  );
  CREATE TABLE IF NOT EXISTS expected_responders (
    event_id TEXT NOT NULL REFERENCES events(id),
    discord_id TEXT NOT NULL,
    name TEXT NOT NULL,
    added_at INTEGER NOT NULL,
    PRIMARY KEY (event_id, discord_id)
  );
  CREATE TABLE IF NOT EXISTS users (
    discord_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    avatar TEXT,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    discord_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS oauth_states (
    state TEXT PRIMARY KEY,
    next_path TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

function newId(bytes = 8) {
  return crypto.randomBytes(bytes).toString('base64url');
}

// ── Events ──────────────────────────────────────────────────────────────

function rowToEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    dates: JSON.parse(row.dates),
    startHour: row.start_hour,
    endHour: row.end_hour,
    slotMinutes: row.slot_minutes,
    timezone: row.timezone,
    createdByDiscordId: row.created_by_discord_id,
    createdByName: row.created_by_name,
    guildId: row.guild_id,
    trackerChannelId: row.tracker_channel_id,
    trackerMessageId: row.tracker_message_id,
    createdAt: row.created_at,
  };
}

function createEvent({ title, dates, startHour, endHour, slotMinutes, timezone, createdByDiscordId, createdByName, guildId }) {
  const id = newId(6);
  db.prepare(
    `INSERT INTO events (id, title, dates, start_hour, end_hour, slot_minutes, timezone,
       created_by_discord_id, created_by_name, guild_id, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(id, title.slice(0, 200), JSON.stringify(dates), startHour, endHour, slotMinutes, timezone,
    createdByDiscordId, createdByName.slice(0, 100), guildId || null, Date.now());
  return id;
}

function getEvent(id) {
  return rowToEvent(db.prepare('SELECT * FROM events WHERE id = ?').get(id));
}

function setEventTracker(id, channelId, messageId) {
  db.prepare('UPDATE events SET tracker_channel_id = ?, tracker_message_id = ? WHERE id = ?').run(channelId, messageId, id);
}

// ── Participants + availability ────────────────────────────────────────

function getParticipant(eventId, discordId) {
  return db.prepare('SELECT * FROM participants WHERE event_id = ? AND discord_id = ?').get(eventId, discordId);
}

function getParticipantSlotSet(eventId, discordId) {
  const row = db.prepare('SELECT id FROM participants WHERE event_id = ? AND discord_id = ?').get(eventId, discordId);
  if (!row) return new Set();
  return new Set(db.prepare('SELECT slot FROM availability WHERE participant_id = ?').all(row.id).map((r) => r.slot));
}

function getParticipantsWithSlots(eventId) {
  const people = db.prepare('SELECT id, discord_id, name FROM participants WHERE event_id = ? ORDER BY updated_at ASC').all(eventId);
  const slotStmt = db.prepare('SELECT slot FROM availability WHERE participant_id = ?');
  return people.map((p) => ({
    discordId: p.discord_id,
    name: p.name,
    slots: slotStmt.all(p.id).map((r) => r.slot),
  }));
}

// Replaces a participant's ENTIRE slot list with `slots`.
function upsertParticipant({ eventId, discordId, name, slots }) {
  let row = db.prepare('SELECT id FROM participants WHERE event_id = ? AND discord_id = ?').get(eventId, discordId);
  let participantId;
  if (row) {
    participantId = row.id;
    db.prepare('UPDATE participants SET name = ?, updated_at = ? WHERE id = ?').run(name.slice(0, 100), Date.now(), participantId);
    db.prepare('DELETE FROM availability WHERE participant_id = ?').run(participantId);
  } else {
    participantId = newId(8);
    db.prepare('INSERT INTO participants (id, event_id, discord_id, name, updated_at) VALUES (?,?,?,?,?)')
      .run(participantId, eventId, discordId, name.slice(0, 100), Date.now());
  }
  const insert = db.prepare('INSERT OR IGNORE INTO availability (participant_id, slot) VALUES (?,?)');
  for (const slot of slots) insert.run(participantId, slot);
  return participantId;
}

// Replaces ONLY the slots that fall on `dayPrefix` (an ISO date's UTC-day prefix isn't
// reliable across timezones, so callers pass the exact set of slot strings that belong
// to "this day" as seen in whatever zone they're working in — see interactions.js).
function setParticipantDaySlots({ eventId, discordId, name, daySlotKeys, newSlotsForDay }) {
  let row = db.prepare('SELECT id FROM participants WHERE event_id = ? AND discord_id = ?').get(eventId, discordId);
  let participantId;
  if (row) {
    participantId = row.id;
    db.prepare('UPDATE participants SET name = ?, updated_at = ? WHERE id = ?').run(name.slice(0, 100), Date.now(), participantId);
  } else {
    participantId = newId(8);
    db.prepare('INSERT INTO participants (id, event_id, discord_id, name, updated_at) VALUES (?,?,?,?,?)')
      .run(participantId, eventId, discordId, name.slice(0, 100), Date.now());
  }
  const del = db.prepare('DELETE FROM availability WHERE participant_id = ? AND slot = ?');
  for (const slot of daySlotKeys) del.run(participantId, slot);
  const insert = db.prepare('INSERT OR IGNORE INTO availability (participant_id, slot) VALUES (?,?)');
  for (const slot of newSlotsForDay) insert.run(participantId, slot);
  return participantId;
}

function removeParticipant(eventId, discordId) {
  const row = db.prepare('SELECT id FROM participants WHERE event_id = ? AND discord_id = ?').get(eventId, discordId);
  if (!row) return;
  db.prepare('DELETE FROM availability WHERE participant_id = ?').run(row.id);
  db.prepare('DELETE FROM participants WHERE id = ?').run(row.id);
}

// ── Expected responders (tagged by the organizer, tracked whether they've answered) ──

function addExpectedResponders(eventId, people) {
  const stmt = db.prepare(
    'INSERT INTO expected_responders (event_id, discord_id, name, added_at) VALUES (?,?,?,?) ' +
    'ON CONFLICT(event_id, discord_id) DO UPDATE SET name = excluded.name'
  );
  for (const p of people) stmt.run(eventId, p.discordId, p.name.slice(0, 100), Date.now());
}

// Full replace — used when a picker UI (e.g. Discord's User Select) represents the
// complete intended set, so anyone left out should no longer be considered "expected".
function setExpectedResponders(eventId, people) {
  db.prepare('DELETE FROM expected_responders WHERE event_id = ?').run(eventId);
  const stmt = db.prepare('INSERT INTO expected_responders (event_id, discord_id, name, added_at) VALUES (?,?,?,?)');
  for (const p of people) stmt.run(eventId, p.discordId, p.name.slice(0, 100), Date.now());
}

function getExpectedResponders(eventId) {
  return db.prepare('SELECT discord_id AS discordId, name FROM expected_responders WHERE event_id = ? ORDER BY added_at ASC').all(eventId);
}

// ── Users (Discord identities seen via OAuth) ──────────────────────────

function upsertUser({ discordId, username, avatar }) {
  db.prepare(
    'INSERT INTO users (discord_id, username, avatar, updated_at) VALUES (?,?,?,?) ' +
    'ON CONFLICT(discord_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = excluded.updated_at'
  ).run(discordId, username, avatar || null, Date.now());
}

function getUser(discordId) {
  return db.prepare('SELECT discord_id AS discordId, username, avatar FROM users WHERE discord_id = ?').get(discordId);
}

// ── Sessions ────────────────────────────────────────────────────────────

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function createSession(discordId) {
  const id = newId(24);
  const now = Date.now();
  db.prepare('INSERT INTO sessions (id, discord_id, created_at, expires_at) VALUES (?,?,?,?)')
    .run(id, discordId, now, now + SESSION_TTL_MS);
  return id;
}

function getSession(sessionId) {
  if (!sessionId) return null;
  const row = db.prepare(
    'SELECT s.discord_id AS discordId, s.expires_at AS expiresAt, u.username, u.avatar ' +
    'FROM sessions s JOIN users u ON u.discord_id = s.discord_id WHERE s.id = ?'
  ).get(sessionId);
  if (!row) return null;
  if (row.expiresAt < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    return null;
  }
  return { discordId: row.discordId, username: row.username, avatar: row.avatar };
}

function deleteSession(sessionId) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

// ── OAuth CSRF state (short-lived, single-use) ─────────────────────────

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function createOAuthState(nextPath) {
  const state = newId(16);
  db.prepare('INSERT INTO oauth_states (state, next_path, created_at) VALUES (?,?,?)')
    .run(state, nextPath || '/', Date.now());
  return state;
}

function consumeOAuthState(state) {
  const row = db.prepare('SELECT next_path AS nextPath, created_at AS createdAt FROM oauth_states WHERE state = ?').get(state);
  if (!row) return null;
  db.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);
  if (Date.now() - row.createdAt > STATE_TTL_MS) return null;
  return row.nextPath;
}

function cleanupExpired() {
  const now = Date.now();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
  db.prepare('DELETE FROM oauth_states WHERE created_at < ?').run(now - STATE_TTL_MS);
}

module.exports = {
  db, newId,
  createEvent, getEvent, setEventTracker,
  getParticipant, getParticipantSlotSet, getParticipantsWithSlots, upsertParticipant, setParticipantDaySlots, removeParticipant,
  addExpectedResponders, setExpectedResponders, getExpectedResponders,
  upsertUser, getUser,
  createSession, getSession, deleteSession,
  createOAuthState, consumeOAuthState,
  cleanupExpired,
};

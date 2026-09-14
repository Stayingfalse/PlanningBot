'use strict';

// Every slot is stored and transmitted as an absolute UTC instant (ISO string).
// The only place timezone math happens is here, converting wall-clock times
// (as specified in some IANA zone) into those UTC instants, and back again for
// display/grouping. Everything downstream just compares UTC strings.

function isValidTimeZone(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; }
  catch (e) { return false; }
}

function getZonedParts(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = {};
  for (const { type, value } of dtf.formatToParts(date)) {
    if (type !== 'literal') parts[type] = parseInt(value, 10);
  }
  if (parts.hour === 24) parts.hour = 0;
  return parts;
}

// Converts a wall-clock date/time as seen in `timeZone` into a UTC epoch-ms instant.
function zonedTimeToUtc(year, month, day, hour, minute, timeZone) {
  const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
  let t = desired;
  for (let i = 0; i < 2; i++) {
    const p = getZonedParts(new Date(t), timeZone);
    const shownAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    t += desired - shownAsUtc;
  }
  return t;
}

function generateSlots(dates, startHour, endHour, slotMinutes, timeZone) {
  const slots = [];
  for (const date of dates) {
    const [y, m, d] = date.split('-').map(Number);
    let minutesOfDay = startHour * 60;
    const endMinutes = endHour * 60;
    while (minutesOfDay < endMinutes) {
      const hour = Math.floor(minutesOfDay / 60);
      const minute = minutesOfDay % 60;
      const utcMs = zonedTimeToUtc(y, m, d, hour, minute, timeZone);
      slots.push(new Date(utcMs).toISOString());
      minutesOfDay += slotMinutes;
    }
  }
  slots.sort();
  return slots;
}

// How many slots fall on each calendar date (in the *event's own* timezone) —
// used to enforce Discord's 25-option-per-select-menu limit for bot-created events.
function maxSlotsPerDay(dates, startHour, endHour, slotMinutes) {
  const perDay = Math.ceil((endHour - startHour) * 60 / slotMinutes);
  return perDay; // same for every date, since each date uses the same hour window
}

function localDateKey(isoUtc, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = {};
  for (const { type, value } of dtf.formatToParts(new Date(isoUtc))) if (type !== 'literal') parts[type] = value;
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// Groups a flat list of UTC ISO slot strings by their calendar date as seen in `timeZone`.
// Returns an array of { date: 'YYYY-MM-DD', slots: [isoUtc, ...] } sorted chronologically.
function groupSlotsByLocalDay(slots, timeZone) {
  const byDay = new Map();
  for (const slot of slots) {
    const key = localDateKey(slot, timeZone);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(slot);
  }
  return Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([date, s]) => ({ date, slots: s }));
}

function formatTimeInZone(isoUtc, timeZone) {
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(isoUtc));
}

function formatDayLabel(localDateKey) {
  const [y, m, d] = localDateKey.split('-').map(Number);
  const noon = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(noon);
}

module.exports = {
  isValidTimeZone, getZonedParts, zonedTimeToUtc, generateSlots,
  maxSlotsPerDay, groupSlotsByLocalDay, localDateKey, formatTimeInZone, formatDayLabel,
};

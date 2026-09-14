'use strict';

const db = require('./db');
const { generateSlots } = require('./time');

function computeResults(eventId) {
  const event = db.getEvent(eventId);
  const slots = generateSlots(event.dates, event.startHour, event.endHour, event.slotMinutes, event.timezone);
  const participants = db.getParticipantsWithSlots(eventId);
  const total = participants.length;

  const counts = {};
  const names = {};
  for (const slot of slots) { counts[slot] = 0; names[slot] = []; }
  for (const p of participants) {
    for (const slot of p.slots) {
      if (counts[slot] === undefined) continue; // stale slot from a since-edited event
      counts[slot] += 1;
      names[slot].push(p.name);
    }
  }

  let maxCount = 0;
  for (const slot of slots) maxCount = Math.max(maxCount, counts[slot]);
  const best = { count: maxCount, slots: total > 0 ? slots.filter((s) => counts[s] === maxCount && maxCount === total) : [] };

  const allNames = participants.map((p) => p.name);
  const top = slots
    .map((slot) => ({ slot, count: counts[slot], names: names[slot], missing: allNames.filter((n) => !names[slot].includes(n)) }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count || a.slot.localeCompare(b.slot))
    .slice(0, 8);

  const respondedIds = new Set(participants.map((p) => p.discordId));
  const expectedResponders = db.getExpectedResponders(eventId).map((r) => ({ ...r, responded: respondedIds.has(r.discordId) }));

  return { totalParticipants: total, slots, counts, names, best, top, expectedResponders };
}

module.exports = { computeResults };

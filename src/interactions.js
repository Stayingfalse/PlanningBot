'use strict';

const db = require('./db');
const { generateSlots, isValidTimeZone, groupSlotsByLocalDay, localDateKey, formatTimeInZone, formatDayLabel, maxSlotsPerDay } = require('./time');
const { computeResults } = require('./results');
const rest = require('./discordRest');

const BASE_URL = (process.env.BASE_URL || '').replace(/\/+$/, '');
const MAX_BOT_DAYS_SHOWN = 4; // keeps the ephemeral "enter availability" message comfortably within Discord's component limits

// ── Discord API numeric constants (see docs.discord.com/developers/interactions) ──
const InteractionType = { PING: 1, APPLICATION_COMMAND: 2, MESSAGE_COMPONENT: 3, MODAL_SUBMIT: 5 };
const CallbackType = { PONG: 1, CHANNEL_MESSAGE_WITH_SOURCE: 4, UPDATE_MESSAGE: 7, MODAL: 9 };
const Flags = { EPHEMERAL: 64, IS_COMPONENTS_V2: 32768 };
const ComponentType = { ACTION_ROW: 1, BUTTON: 2, STRING_SELECT: 3, TEXT_INPUT: 4, USER_SELECT: 5, TEXT_DISPLAY: 10, SEPARATOR: 14, CONTAINER: 17, LABEL: 18 };
const ButtonStyle = { PRIMARY: 1, SECONDARY: 2, SUCCESS: 3, DANGER: 4, LINK: 5 };

// ── Slash command registration ─────────────────────────────────────────

const COMMANDS = [
  {
    name: 'meet',
    description: "Schedule a time that works for everyone",
    options: [
      { type: 1, name: 'create', description: 'Create a new scheduling poll in this channel' },
    ],
  },
];

async function registerCommandsIfConfigured() {
  if (!rest.botConfigured()) return;
  try {
    await rest.registerGlobalCommands(COMMANDS);
    console.log('Registered Discord slash commands.');
  } catch (e) {
    console.error('Failed to register Discord slash commands:', e.message);
  }
}

// ── Components V2 builders ─────────────────────────────────────────────

function textDisplay(content) { return { type: ComponentType.TEXT_DISPLAY, content }; }
function separator(spacing = 1) { return { type: ComponentType.SEPARATOR, spacing }; }
function actionRow(components) { return { type: ComponentType.ACTION_ROW, components }; }
function container(components, accentColor) {
  const c = { type: ComponentType.CONTAINER, components };
  if (accentColor !== undefined) c.accent_color = accentColor;
  return c;
}
function button({ customId, label, style = ButtonStyle.SECONDARY, url, disabled }) {
  const b = { type: ComponentType.BUTTON, label, style };
  if (url) b.url = url; else b.custom_id = customId;
  if (disabled) b.disabled = true;
  return b;
}
function stringSelect({ customId, placeholder, minValues = 1, maxValues = 1, options }) {
  return { type: ComponentType.STRING_SELECT, custom_id: customId, placeholder, min_values: minValues, max_values: maxValues, options };
}
function label(text, component) { return { type: ComponentType.LABEL, label: text.slice(0, 45), component }; }
function ephemeral(text) {
  return { type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: text, flags: Flags.EPHEMERAL } };
}

function getInvoker(interaction) {
  const u = (interaction.member && interaction.member.user) || interaction.user;
  const displayName = (interaction.member && interaction.member.nick) || u.global_name || u.username;
  return { id: u.id, displayName };
}

function modalFieldValue(interaction, customId) {
  for (const c of interaction.data.components || []) {
    if (c.component && c.component.custom_id === customId) return c.component.value;
  }
  return undefined;
}

// ── The public tracker message ─────────────────────────────────────────

function buildTrackerComponents(event) {
  const results = computeResults(event.id);
  const lines = [];
  lines.push(`# 📅 ${event.title}`);
  lines.push(`${event.dates.length} date${event.dates.length === 1 ? '' : 's'} · ${event.startHour}:00–${event.endHour}:00 · ${event.timezone.replace(/_/g, ' ')}`);
  lines.push(`Organized by <@${event.createdByDiscordId}>`);

  const responded = results.expectedResponders.filter((r) => r.responded).length;
  const totalTracked = results.expectedResponders.length;
  if (totalTracked > 0) {
    lines.push('');
    lines.push(`**Responses: ${responded}/${totalTracked}**`);
    lines.push(results.expectedResponders.map((r) => `${r.responded ? '✅' : '⏳'} <@${r.discordId}>`).join('  '));
  } else if (results.totalParticipants > 0) {
    lines.push('');
    lines.push(`**${results.totalParticipants} response${results.totalParticipants === 1 ? '' : 's'} so far** — no one's been tagged as a required responder yet.`);
  }

  lines.push('');
  if (results.totalParticipants === 0) {
    lines.push('_No one has entered their availability yet._');
  } else if (results.best.slots.length > 0) {
    const s = results.best.slots[0];
    const extra = results.best.slots.length > 1 ? ` (+${results.best.slots.length - 1} more)` : '';
    lines.push(`🏆 **Everyone's free:** ${formatDayLabel(localDateKey(s, event.timezone))} at ${formatTimeInZone(s, event.timezone)}${extra}`);
  } else {
    const t = results.top[0];
    lines.push(`🔶 **Best so far:** ${formatDayLabel(localDateKey(t.slot, event.timezone))} at ${formatTimeInZone(t.slot, event.timezone)} — ${t.count}/${results.totalParticipants} free`);
  }

  const buttons = [
    button({ customId: `meet:respond:${event.id}`, label: 'Enter availability', style: ButtonStyle.PRIMARY }),
    button({ customId: `meet:responders:${event.id}`, label: 'Manage responders', style: ButtonStyle.SECONDARY }),
    button({ customId: `meet:remind:${event.id}`, label: 'Remind pending', style: ButtonStyle.SECONDARY }),
  ];
  if (BASE_URL) buttons.push(button({ url: `${BASE_URL}/e/${event.id}`, label: 'View full grid', style: ButtonStyle.LINK }));

  return [container([textDisplay(lines.join('\n')), separator(), actionRow(buttons)], 0x5b8def)];
}

async function refreshTracker(eventId) {
  const event = db.getEvent(eventId);
  if (!event || !event.trackerChannelId || !event.trackerMessageId) return;
  try {
    await rest.editMessage(event.trackerChannelId, event.trackerMessageId, { flags: Flags.IS_COMPONENTS_V2, components: buildTrackerComponents(event) });
  } catch (e) {
    console.error('Failed to refresh tracker message:', e.message);
  }
}

// ── The ephemeral "enter availability" message ─────────────────────────

function buildRespondMessage(event, invoker) {
  const slots = generateSlots(event.dates, event.startHour, event.endHour, event.slotMinutes, event.timezone);
  const groups = groupSlotsByLocalDay(slots, event.timezone);
  const mySlots = db.getParticipantSlotSet(event.id, invoker.id);
  const shown = groups.slice(0, MAX_BOT_DAYS_SHOWN);

  const comps = [textDisplay(
    `### Your availability — ${event.title}\nTimes shown in ${event.timezone.replace(/_/g, ' ')}. Pick everything you're free for — changes save instantly.`
  )];
  for (const g of shown) {
    comps.push(actionRow([
      stringSelect({
        customId: `meet:day:${event.id}:${g.date}`,
        placeholder: formatDayLabel(g.date),
        minValues: 0,
        maxValues: g.slots.length,
        options: g.slots.map((s) => ({ label: formatTimeInZone(s, event.timezone), value: s, default: mySlots.has(s) })),
      }),
    ]));
  }
  if (groups.length > MAX_BOT_DAYS_SHOWN) {
    comps.push(separator());
    comps.push(textDisplay(`_Showing the first ${MAX_BOT_DAYS_SHOWN} of ${groups.length} days. Use **View full grid** on the tracker message for the rest._`));
  }
  return { type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: Flags.EPHEMERAL | Flags.IS_COMPONENTS_V2, components: [container(comps, 0x5b8def)] } };
}

// ── Slash command: /meet create ────────────────────────────────────────

function createEventModal() {
  return {
    type: CallbackType.MODAL,
    data: {
      custom_id: 'meet:create_modal',
      title: 'Schedule availability',
      components: [
        label('Event title', { type: ComponentType.TEXT_INPUT, custom_id: 'title', style: 1, max_length: 100, required: true, placeholder: 'Board game night' }),
        label('Dates (comma-separated, YYYY-MM-DD)', { type: ComponentType.TEXT_INPUT, custom_id: 'dates', style: 1, required: true, placeholder: '2026-09-20, 2026-09-21' }),
        label('Time window (24h, start-end hour)', { type: ComponentType.TEXT_INPUT, custom_id: 'window', style: 1, required: true, placeholder: '18-21' }),
        label('Timezone (IANA name)', { type: ComponentType.TEXT_INPUT, custom_id: 'timezone', style: 1, required: true, placeholder: 'America/New_York' }),
        label('Slot size in minutes: 15, 30, or 60', { type: ComponentType.TEXT_INPUT, custom_id: 'slot_minutes', style: 1, required: false, placeholder: '30' }),
      ],
    },
  };
}

async function handleCommand(interaction) {
  const sub = interaction.data.options && interaction.data.options[0] && interaction.data.options[0].name;
  if (interaction.data.name === 'meet' && sub === 'create') {
    if (!interaction.guild_id) return { response: ephemeral("Run this inside a server, not a DM — I need a channel to post the shared tracker in.") };
    return { response: createEventModal() };
  }
  return { response: ephemeral('Unknown command.') };
}

async function handleModalSubmit(interaction) {
  if (interaction.data.custom_id !== 'meet:create_modal') return { response: ephemeral('This form is no longer supported.') };

  const title = (modalFieldValue(interaction, 'title') || '').trim();
  const datesRaw = (modalFieldValue(interaction, 'dates') || '').trim();
  const windowRaw = (modalFieldValue(interaction, 'window') || '').trim();
  const timezone = (modalFieldValue(interaction, 'timezone') || '').trim();
  const slotMinutesRaw = (modalFieldValue(interaction, 'slot_minutes') || '').trim();

  const errors = [];
  if (!title) errors.push('Title is required.');

  const dates = datesRaw.split(',').map((s) => s.trim()).filter(Boolean);
  if (dates.length === 0) errors.push('Add at least one date.');
  if (dates.length > 14) errors.push('Max 14 dates at once here — use the web app for more.');
  for (const d of dates) if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) errors.push(`"${d}" isn't a valid YYYY-MM-DD date.`);

  const winMatch = windowRaw.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
  let startHour, endHour;
  if (!winMatch) {
    errors.push('Time window must look like "18-21" (24-hour, start-end).');
  } else {
    startHour = Number(winMatch[1]); endHour = Number(winMatch[2]);
    if (!(startHour >= 0 && startHour <= 23)) errors.push('Start hour must be 0-23.');
    if (!(endHour >= 1 && endHour <= 24)) errors.push('End hour must be 1-24.');
    if (endHour <= startHour) errors.push('End hour must be after start hour.');
  }

  if (!timezone || !isValidTimeZone(timezone)) errors.push(`"${timezone || '(empty)'}" isn't a recognized timezone, e.g. "America/New_York" or "Europe/London".`);

  let slotMinutes = 30;
  if (slotMinutesRaw) {
    slotMinutes = Number(slotMinutesRaw);
    if (![15, 30, 60].includes(slotMinutes)) errors.push('Slot size must be 15, 30, or 60.');
  }

  if (errors.length === 0 && winMatch) {
    const perDay = maxSlotsPerDay(dates, startHour, endHour, slotMinutes);
    if (perDay > 25) errors.push(`That's ${perDay} time slots per day — Discord's picker allows at most 25. Shorten the window, use a bigger slot size, or create this on the web app instead.`);
  }

  if (errors.length > 0) return { response: ephemeral('⚠️ ' + errors.join('\n')) };

  const invoker = getInvoker(interaction);
  const eventId = db.createEvent({
    title, dates, startHour, endHour, slotMinutes, timezone,
    createdByDiscordId: invoker.id, createdByName: invoker.displayName, guildId: interaction.guild_id,
  });
  const channelId = interaction.channel_id || (interaction.channel && interaction.channel.id);

  return {
    response: ephemeral(`🎉 Created **${title}** — posting the tracker now...`),
    followUp: async () => {
      try {
        const event = db.getEvent(eventId);
        const msg = await rest.postMessage(channelId, { flags: Flags.IS_COMPONENTS_V2, components: buildTrackerComponents(event) });
        db.setEventTracker(eventId, channelId, msg.id);
      } catch (e) {
        console.error('Failed to post tracker message:', e.message);
      }
    },
  };
}

// ── Message components (buttons & select menus) ────────────────────────

async function handleRespondButton(interaction, eventId) {
  const event = db.getEvent(eventId);
  if (!event) return { response: ephemeral('This event no longer exists.') };
  return { response: buildRespondMessage(event, getInvoker(interaction)) };
}

async function handleDaySelect(interaction, eventId, date) {
  const event = db.getEvent(eventId);
  if (!event) return { response: ephemeral('This event no longer exists.') };
  const invoker = getInvoker(interaction);

  const slots = generateSlots(event.dates, event.startHour, event.endHour, event.slotMinutes, event.timezone);
  const groups = groupSlotsByLocalDay(slots, event.timezone);
  const group = groups.find((g) => g.date === date);
  if (!group) return { response: ephemeral('That day is no longer part of this event.') };

  db.setParticipantDaySlots({
    eventId, discordId: invoker.id, name: invoker.displayName,
    daySlotKeys: group.slots, newSlotsForDay: interaction.data.values || [],
  });

  const updated = buildRespondMessage(event, invoker);
  updated.type = CallbackType.UPDATE_MESSAGE;
  return { response: updated, followUp: () => refreshTracker(eventId) };
}

async function handleRespondersButton(interaction, eventId) {
  const event = db.getEvent(eventId);
  if (!event) return { response: ephemeral('This event no longer exists.') };
  const invoker = getInvoker(interaction);
  if (invoker.id !== event.createdByDiscordId) return { response: ephemeral('Only the organizer who created this event can manage responders.') };

  const current = db.getExpectedResponders(eventId);
  const comps = [container([
    textDisplay(`### Who should respond to **${event.title}**?\nPick everyone you want to tag — this replaces the current list.`),
    actionRow([{
      type: ComponentType.USER_SELECT,
      custom_id: `meet:responders_pick:${eventId}`,
      placeholder: 'Select responders',
      min_values: 0,
      max_values: 25,
      default_values: current.map((r) => ({ id: r.discordId, type: 'user' })),
    }]),
  ], 0x5b8def)];
  return { response: { type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: Flags.EPHEMERAL | Flags.IS_COMPONENTS_V2, components: comps } } };
}

async function handleRespondersPick(interaction, eventId) {
  const event = db.getEvent(eventId);
  if (!event) return { response: ephemeral('This event no longer exists.') };
  const invoker = getInvoker(interaction);
  if (invoker.id !== event.createdByDiscordId) return { response: ephemeral('Only the organizer can do this.') };

  const values = interaction.data.values || [];
  const resolvedUsers = (interaction.data.resolved && interaction.data.resolved.users) || {};
  const resolvedMembers = (interaction.data.resolved && interaction.data.resolved.members) || {};
  const before = new Set(db.getExpectedResponders(eventId).map((r) => r.discordId));

  const people = values.map((id) => {
    const member = resolvedMembers[id];
    const user = resolvedUsers[id];
    const name = (member && member.nick) || (user && user.global_name) || (user && user.username) || id;
    return { discordId: id, name };
  });
  db.setExpectedResponders(eventId, people);
  const addedIds = values.filter((id) => !before.has(id));

  return {
    response: {
      type: CallbackType.UPDATE_MESSAGE,
      data: { flags: Flags.EPHEMERAL | Flags.IS_COMPONENTS_V2, components: [container([textDisplay(`✅ Responders updated — ${values.length} tagged.`)], 0x4ade80)] },
    },
    followUp: async () => {
      await refreshTracker(eventId);
      if (addedIds.length === 0) return;
      try {
        await rest.postMessage(event.trackerChannelId || interaction.channel_id, {
          content: `${addedIds.map((id) => `<@${id}>`).join(' ')} — you've been asked to share your availability for **${event.title}**. Hit **Enter availability** above! 👆`,
          allowed_mentions: { parse: [], users: addedIds },
        });
      } catch (e) {
        console.error('Failed to send responder ping:', e.message);
      }
    },
  };
}

async function handleRemindButton(interaction, eventId) {
  const event = db.getEvent(eventId);
  if (!event) return { response: ephemeral('This event no longer exists.') };
  const invoker = getInvoker(interaction);
  if (invoker.id !== event.createdByDiscordId) return { response: ephemeral('Only the organizer can send reminders.') };

  const results = computeResults(eventId);
  const pending = results.expectedResponders.filter((r) => !r.responded);
  if (pending.length === 0) return { response: ephemeral("Everyone tagged has already responded! 🎉") };

  return {
    response: ephemeral(`Sent a reminder to ${pending.length} pending responder${pending.length === 1 ? '' : 's'}.`),
    followUp: async () => {
      try {
        await rest.postMessage(event.trackerChannelId || interaction.channel_id, {
          content: `${pending.map((r) => `<@${r.discordId}>`).join(' ')} — friendly reminder to enter your availability for **${event.title}**! 👆`,
          allowed_mentions: { parse: [], users: pending.map((r) => r.discordId) },
        });
      } catch (e) {
        console.error('Failed to send reminder:', e.message);
      }
    },
  };
}

async function handleComponent(interaction) {
  const parts = (interaction.data.custom_id || '').split(':');
  const action = parts[1];
  if (action === 'respond') return handleRespondButton(interaction, parts[2]);
  if (action === 'day') return handleDaySelect(interaction, parts[2], parts.slice(3).join(':'));
  if (action === 'responders') return handleRespondersButton(interaction, parts[2]);
  if (action === 'responders_pick') return handleRespondersPick(interaction, parts[2]);
  if (action === 'remind') return handleRemindButton(interaction, parts[2]);
  return { response: ephemeral('This button is no longer supported.') };
}

// ── Top-level dispatch ──────────────────────────────────────────────────

async function handleInteraction(interaction) {
  switch (interaction.type) {
    case InteractionType.PING: return { response: { type: CallbackType.PONG } };
    case InteractionType.APPLICATION_COMMAND: return handleCommand(interaction);
    case InteractionType.MESSAGE_COMPONENT: return handleComponent(interaction);
    case InteractionType.MODAL_SUBMIT: return handleModalSubmit(interaction);
    default: return { response: ephemeral('Unsupported interaction type.') };
  }
}

module.exports = { handleInteraction, registerCommandsIfConfigured, refreshTracker };

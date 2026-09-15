'use strict';

const PAGE_STYLE = `
  :root {
    --bg: #0f1115; --panel: #171a21; --panel-2: #1e222b; --border: #2a2f3a;
    --text: #e8eaed; --muted: #9aa3b2; --accent: #5b8def; --accent-2: #4ade80;
    --danger: #f87171; --discord: #5865F2;
  }

  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body { padding: 16px; padding-block-end: 96px; max-width: 640px; margin: 0 auto; }
  h1 { font-size: 1.3rem; margin: 0 0 4px; }
  h2 { font-size: 1.05rem; margin: 20px 0 8px; }
  p.muted, .muted { color: var(--muted); font-size: 0.9rem; }
  label { display: block; font-size: 0.85rem; color: var(--muted); margin: 14px 0 6px; }
  input[type=text], input[type=date], select {
    width: 100%; padding: 12px; border-radius: 10px; border: 1px solid var(--border);
    background: var(--panel-2); color: var(--text); font-size: 1rem;
  }
  .row { display: flex; gap: 12px; }
  .row > * { flex: 1; }
  button, a.btn {
    font-size: 1rem; padding: 12px 16px; border-radius: 10px; border: none;
    cursor: pointer; font-weight: 600; text-decoration: none; display: inline-block; text-align: center;
  }
  button.primary, a.btn.primary { background: var(--accent); color: white; width: 100%; margin-top: 16px; }
  button.secondary, a.btn.secondary { background: var(--panel-2); color: var(--text); border: 1px solid var(--border); }
  button.discord, a.btn.discord { background: var(--discord); color: white; width: 100%; margin-top: 12px; }
  button.small { padding: 8px 12px; font-size: 0.85rem; }
  button.link { background: none; color: var(--accent); padding: 4px; }
  button:disabled { opacity: 0.5; cursor: default; }
  .card { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 16px; margin-top: 16px; }
  .datelist { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
  .datelist .item { display: flex; align-items: center; justify-content: space-between;
    background: var(--panel-2); border-radius: 8px; padding: 8px 12px; font-size: 0.9rem; }
  .tabs { display: flex; gap: 10px; overflow-x: auto; padding: 4px 24px 10px 0; }
  .tabs button { flex: none; background: var(--panel-2); color: var(--muted); border: 1px solid var(--border); white-space: nowrap; }
  .tabs button.active { background: var(--accent); color: white; border-color: var(--accent); }
  .tabhint { margin: -2px 0 10px; font-size: 0.8rem; }
  .slotlist { display: flex; flex-direction: column; gap: 8px; user-select: none; }
  .slot { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px;
    border-radius: 10px; background: var(--panel-2); border: 1px solid var(--border); font-size: 0.95rem; }
  .slot.selected { background: var(--accent); border-color: var(--accent); color: white; }
  .slot .count { font-size: 0.8rem; color: var(--muted); }
  .slot.selected .count { color: rgba(255,255,255,0.85); }
  .heat0 { background: var(--panel-2); }
  .heat1 { background: #234; }
  .heat2 { background: #2b5a8f; }
  .heat3 { background: #3a7fd6; }
  .heatfull { background: var(--accent-2); color: #0f1115; }
  .heatfull .count { color: #0f1115; }
  .toolbar { position: fixed; inset-inline: 0; inset-block-end: 0; background: var(--panel);
    border-top: 1px solid var(--border); padding: 10px max(16px, env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); display: flex; gap: 8px; max-width: 640px; margin: 0 auto; }
  .pill { display: inline-block; background: var(--panel-2); border: 1px solid var(--border);
    border-radius: 999px; padding: 2px 10px; font-size: 0.75rem; color: var(--muted); }
  .toggle-row { display: flex; gap: 12px; margin-top: 12px; }
  .toggle-row button { flex: 1; }
  .best-banner { background: rgba(74,222,128,0.12); border: 1px solid var(--accent-2); border-radius: 12px;
    padding: 12px; margin-top: 10px; }
  .missing { font-size: 0.8rem; color: var(--danger); }
  a { color: var(--accent); }
  .copyrow { display: flex; gap: 12px; margin-top: 12px; }
  .copyrow input { flex: 1; }
  .timezone-row { align-items: center; margin-top: 12px; }
  .timezone-row .label { flex: none; }
  .userbar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .userbar img { width: 28px; height: 28px; border-radius: 50%; }
  .userbar .name { font-size: 0.9rem; }
  .userbar .spacer { flex: 1; }
  .userbar a { font-size: 0.8rem; color: var(--muted); }
  .responders { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .responder-chip { font-size: 0.8rem; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--border); background: var(--panel-2); }
  .responder-chip.done { border-color: var(--accent-2); color: var(--accent-2); }
  .top-actions { margin-top: 10px; }
  .top-actions .btn { margin-top: 0; width: 100%; }
  .copyday-targets { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
  .copyday-target { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: var(--muted); }
  .copyday-target input { margin: 0; }
  #toast { position: fixed; inset-block-end: 76px; inset-inline-start: 50%; transform: translateX(-50%); background: #000; color: #fff;
    padding: 8px 14px; border-radius: 8px; font-size: 0.85rem; opacity: 0; transition: opacity 0.2s; pointer-events: none; }
  #toast.show { opacity: 0.92; }
`;

const DISCORD_INSTALL_AVAILABLE = Boolean(
  (process.env.DISCORD_CLIENT_ID || '').trim()
  && (process.env.DISCORD_CLIENT_SECRET || '').trim()
  && (process.env.BASE_URL || '').trim()
);

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function userBar(viewer) {
  if (!viewer) return '';
  const avatarUrl = viewer.avatar
    ? `https://cdn.discordapp.com/avatars/${viewer.discordId}/${viewer.avatar}.png?size=64`
    : 'https://cdn.discordapp.com/embed/avatars/0.png';
  return `<div class="userbar">
    <img src="${escapeHtml(avatarUrl)}" alt="">
    <span class="name">${escapeHtml(viewer.username)}</span>
    <span class="spacer"></span>
    <a href="/auth/logout">Log out</a>
  </div>`;
}

function botInviteButton(nextPath) {
  if (!DISCORD_INSTALL_AVAILABLE) return '';
  return `<div class="top-actions"><a class="btn discord" href="/auth/discord/install?next=${encodeURIComponent(nextPath || '/')}">Add Bot to Server</a></div>`;
}

// Open Graph / Twitter Card tags, so links shared in Discord, iMessage, etc.
// unfurl into a rich embed with details about the event. Values arrive
// pre-computed as plain strings; everything is HTML-escaped here.
function ogMetaTags({ title, description, url }) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const u = url ? escapeHtml(url) : null;
  return `
<meta property="og:type" content="website">
<meta property="og:site_name" content="meetup-lite">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
${u ? `<meta property="og:url" content="${u}">\n` : ''}<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">`;
}

function homePage(viewer, og) {
  const formOrLogin = viewer ? `
    <div class="card">
      <label for="title">Event name</label>
      <input type="text" id="title" placeholder="e.g. Board game night">

      <label>Dates</label>
      <div class="row">
        <input type="date" id="datePicker">
        <button class="secondary" id="addDate" type="button">Add</button>
      </div>
      <div class="datelist" id="dateList"></div>

      <div class="row">
        <div>
          <label for="startHour">Earliest</label>
          <select id="startHour"></select>
        </div>
        <div>
          <label for="endHour">Latest</label>
          <select id="endHour"></select>
        </div>
      </div>

      <label for="slotMinutes">Time slot size</label>
      <select id="slotMinutes">
        <option value="15">15 minutes</option>
        <option value="30" selected>30 minutes</option>
        <option value="60">1 hour</option>
      </select>

      <label for="timezone">Timezone (for the times above)</label>
      <select id="timezone"></select>
      <p class="muted">Everyone who opens the link will see times converted to their own device's timezone automatically.</p>

      <button class="primary" id="createBtn" type="button">Create event</button>
      <p class="muted" id="error" style="color:#f87171; display:none;"></p>
    </div>` : `
    <div class="card">
      <p class="muted">Log in with Discord to create an event. This is how meetup-lite knows who's who when it tallies everyone's availability — no more typing your name in by hand.</p>
      <a class="btn discord" href="/auth/discord?next=/">Log in with Discord</a>
    </div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>meetup-lite</title>
${ogMetaTags(og || { title: 'meetup-lite', description: 'Pick some dates and a time window, share the link, see when everyone\u2019s actually free.' })}
<style>${PAGE_STYLE}</style>
</head>
<body>
  ${userBar(viewer)}
  <h1>📅 meetup-lite</h1>
  <p class="muted">Pick some dates and a time window, share the link, see when everyone's actually free.</p>
  ${botInviteButton('/')}
  ${formOrLogin}

<script>
(function () {
  const dates = [];
  const dateList = document.getElementById('dateList');
  const datePicker = document.getElementById('datePicker');
  if (!datePicker) return; // not logged in — nothing else to wire up
  const today = new Date().toISOString().slice(0, 10);
  datePicker.value = today;

  function renderDates() {
    dateList.innerHTML = '';
    dates.slice().sort().forEach((d) => {
      const item = document.createElement('div');
      item.className = 'item';
      const label = document.createElement('span');
      label.textContent = new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      const rm = document.createElement('button');
      rm.className = 'link'; rm.type = 'button'; rm.textContent = 'Remove';
      rm.onclick = () => { dates.splice(dates.indexOf(d), 1); renderDates(); };
      item.append(label, rm);
      dateList.append(item);
    });
  }

  document.getElementById('addDate').onclick = () => {
    const v = datePicker.value;
    if (v && !dates.includes(v)) { dates.push(v); renderDates(); }
  };

  function fillHourSelect(sel, defaultVal) {
    for (let h = 0; h <= 24; h++) {
      const opt = document.createElement('option');
      opt.value = h;
      const label = h === 0 ? '12 AM' : h === 24 ? '12 AM (next day)' : h < 12 ? h + ' AM' : h === 12 ? '12 PM' : (h - 12) + ' PM';
      opt.textContent = label;
      if (h === defaultVal) opt.selected = true;
      sel.append(opt);
    }
  }
  fillHourSelect(document.getElementById('startHour'), 9);
  fillHourSelect(document.getElementById('endHour'), 21);

  function timeZoneList() {
    try { if (typeof Intl.supportedValuesOf === 'function') return Intl.supportedValuesOf('timeZone'); } catch (e) {}
    return ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
      'America/Anchorage', 'Pacific/Honolulu', 'America/Sao_Paulo', 'Europe/London', 'Europe/Berlin',
      'Europe/Paris', 'Europe/Moscow', 'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Kolkata',
      'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul', 'Australia/Sydney', 'Pacific/Auckland'];
  }
  function detectTimeZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; }
  }
  function buildTzSelect(sel, selected) {
    const zones = timeZoneList();
    sel.innerHTML = '';
    if (!zones.includes(selected)) zones.unshift(selected);
    zones.forEach((z) => {
      const opt = document.createElement('option');
      opt.value = z; opt.textContent = z.replace(/_/g, ' ');
      if (z === selected) opt.selected = true;
      sel.append(opt);
    });
  }
  buildTzSelect(document.getElementById('timezone'), detectTimeZone());

  document.getElementById('createBtn').onclick = async () => {
    const errorEl = document.getElementById('error');
    errorEl.style.display = 'none';
    const title = document.getElementById('title').value.trim();
    const startHour = Number(document.getElementById('startHour').value);
    const endHour = Number(document.getElementById('endHour').value);
    const slotMinutes = Number(document.getElementById('slotMinutes').value);
    const timezone = document.getElementById('timezone').value;
    if (!title) { errorEl.textContent = 'Give your event a name.'; errorEl.style.display = 'block'; return; }
    if (dates.length === 0) { errorEl.textContent = 'Add at least one date.'; errorEl.style.display = 'block'; return; }
    if (endHour <= startHour) { errorEl.textContent = '"Latest" must be after "Earliest".'; errorEl.style.display = 'block'; return; }
    const res = await fetch('/api/events', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, dates, startHour, endHour, slotMinutes, timezone }),
    });
    if (res.status === 401) { location.href = '/auth/discord?next=/'; return; }
    if (!res.ok) { errorEl.textContent = (await res.json()).error || 'Something went wrong.'; errorEl.style.display = 'block'; return; }
    const { id } = await res.json();
    location.href = '/e/' + id;
  };
})();
</script>
</body>
</html>`;
}

function eventPage(eventId, og) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>${og ? escapeHtml(og.title) : 'meetup-lite'}</title>
${ogMetaTags(og || { title: 'meetup-lite event', description: 'See when everyone is free and enter your own availability.' })}
<style>${PAGE_STYLE}</style>
</head>
<body>
  <div id="userBarSlot"></div>
  <h1 id="eventTitle">Loading…</h1>
  <p class="muted" id="eventMeta"></p>
  ${botInviteButton(`/e/${eventId}`)}
  <div class="responders" id="respondersBar"></div>

  <div class="copyrow">
    <input type="text" id="shareUrl" readonly>
    <button class="secondary small" id="copyBtn" type="button">Copy link</button>
  </div>

  <div class="row timezone-row">
    <span class="muted label">Times shown in</span>
    <select id="viewerTz"></select>
  </div>

  <div class="toggle-row">
    <button class="secondary" id="tabAvailability" type="button">My availability</button>
    <button class="secondary" id="tabResults" type="button">Results (<span id="respCount">0</span>)</button>
  </div>

  <div id="availabilityView">
    <div class="card" id="loginPrompt" style="display:none;">
      <p class="muted">Log in with Discord to enter your availability.</p>
      <a class="btn discord" id="loginBtn" href="#">Log in with Discord</a>
    </div>
    <div class="card" id="whoAmI" style="display:none;">
      <p class="muted">Responding as <strong id="whoAmIName"></strong>. Tap a time to mark yourself free — tap and drag to select a range.</p>
    </div>
    <div class="tabs" id="dayTabs"></div>
    <p class="muted tabhint" id="dayTabsHint" style="display:none;">Swipe to see more days →</p>
    <div class="card" id="copyDayCard" style="display:none;">
      <p class="muted" style="margin:0;">Copy this day's availability to other days:</p>
      <div class="copyday-targets" id="copyDayTargets"></div>
      <button class="secondary small" id="copyDayBtn" type="button" disabled>Copy day pattern</button>
    </div>
    <div class="slotlist" id="slotList"></div>
  </div>

  <div id="resultsView" style="display:none;">
    <div id="bestBanner"></div>
    <h2>Best options</h2>
    <div id="topList" class="card"></div>
    <h2>Full picture</h2>
    <div class="tabs" id="dayTabsResults"></div>
    <p class="muted tabhint" id="dayTabsResultsHint" style="display:none;">Swipe to see more days →</p>
    <div class="slotlist" id="slotListResults"></div>
  </div>

  <div class="toolbar" id="saveBar" style="display:none;">
    <button class="primary" id="saveBtn" type="button">Save my availability</button>
  </div>
  <div id="toast"></div>

<script>
(function () {
  const eventId = ${JSON.stringify(eventId)};
  let event = null;
  let viewer = null;
  let mySlots = new Set();
  let activeDay = null;
  let activeDayResults = null;
  let slotLocalCache = new Map();
  let dayList = [];
  const tzKey = 'meetuplite:tz';

  const el = (id) => document.getElementById(id);
  function toast(msg) {
    const t = el('toast'); t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1600);
  }

  // ── Timezone handling (see meetup-lite README for the details) ──
  function detectTimeZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; }
  }
  function timeZoneList() {
    try { if (typeof Intl.supportedValuesOf === 'function') return Intl.supportedValuesOf('timeZone'); } catch (e) {}
    return ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
      'America/Anchorage', 'Pacific/Honolulu', 'America/Sao_Paulo', 'Europe/London', 'Europe/Berlin',
      'Europe/Paris', 'Europe/Moscow', 'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Kolkata',
      'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul', 'Australia/Sydney', 'Pacific/Auckland'];
  }
  function buildTzSelect(sel, selected) {
    const zones = timeZoneList();
    sel.innerHTML = '';
    if (!zones.includes(selected)) zones.unshift(selected);
    zones.forEach((z) => {
      const opt = document.createElement('option');
      opt.value = z; opt.textContent = z.replace(/_/g, ' ');
      if (z === selected) opt.selected = true;
      sel.append(opt);
    });
  }
  let viewerTz = localStorage.getItem(tzKey) || detectTimeZone();
  buildTzSelect(el('viewerTz'), viewerTz);

  function zonedDateKey(isoUtc, tz) {
    const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit' });
    const parts = {};
    for (const { type, value } of dtf.formatToParts(new Date(isoUtc))) if (type !== 'literal') parts[type] = value;
    return parts.year + '-' + parts.month + '-' + parts.day;
  }
  function fmtTime(isoUtc) {
    return new Intl.DateTimeFormat(undefined, { timeZone: viewerTz, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(isoUtc));
  }
  function fmtDay(localDateKey) {
    const [y, m, d] = localDateKey.split('-').map(Number);
    const noon = new Date(Date.UTC(y, m - 1, d, 12));
    return new Intl.DateTimeFormat(undefined, { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(noon);
  }
  function rebuildLocalCache() {
    slotLocalCache = new Map();
    const days = new Set();
    event.slots.forEach((s) => {
      const key = zonedDateKey(s, viewerTz);
      slotLocalCache.set(s, key);
      days.add(key);
    });
    dayList = Array.from(days).sort();
  }
  el('viewerTz').onchange = () => {
    viewerTz = el('viewerTz').value;
    localStorage.setItem(tzKey, viewerTz);
    if (!event) return;
    rebuildLocalCache();
    if (!dayList.includes(activeDay)) activeDay = dayList[0];
    if (!dayList.includes(activeDayResults)) activeDayResults = dayList[0];
    renderDayTabs(); renderSlotList(); renderCopyDayOptions(); refreshResults();
  };

  async function loadViewer() {
    const res = await fetch('/api/me');
    viewer = res.ok ? await res.json() : null;
    const slot = el('userBarSlot');
    if (viewer) {
      const avatarUrl = viewer.avatar ? 'https://cdn.discordapp.com/avatars/' + viewer.discordId + '/' + viewer.avatar + '.png?size=64' : 'https://cdn.discordapp.com/embed/avatars/0.png';
      slot.innerHTML = '<div class="userbar"><img src="' + avatarUrl + '" alt=""><span class="name">' + viewer.username + '</span><span class="spacer"></span><a href="/auth/logout">Log out</a></div>';
      el('loginPrompt').style.display = 'none';
      el('whoAmI').style.display = '';
      el('whoAmIName').textContent = viewer.username;
      el('saveBar').style.display = '';
      renderCopyDayOptions();
    } else {
      el('loginBtn').href = '/auth/discord?next=' + encodeURIComponent('/e/' + eventId);
      el('loginPrompt').style.display = '';
      el('whoAmI').style.display = 'none';
      el('saveBar').style.display = 'none';
      el('copyDayCard').style.display = 'none';
    }
  }

  async function loadEvent() {
    const res = await fetch('/api/events/' + eventId);
    if (!res.ok) { el('eventTitle').textContent = 'Event not found'; return; }
    event = await res.json();
    el('eventTitle').textContent = event.title;
    el('eventMeta').textContent = event.dates.length + ' date(s) · organized by ' + event.createdByName + ' · set up for ' + event.timezone.replace(/_/g, ' ');
    el('shareUrl').value = location.href;
    renderResponders();
    rebuildLocalCache();
    if (!dayList.includes(activeDay)) activeDay = dayList[0];
    if (!dayList.includes(activeDayResults)) activeDayResults = dayList[0];
    renderDayTabs();
    if (viewer) {
      const mine = event.participants.find((p) => p.discordId === viewer.discordId);
      if (mine) mySlots = new Set(mine.slots);
    }
    renderSlotList();
    renderCopyDayOptions();
    refreshResults();
  }

  function renderResponders() {
    const bar = el('respondersBar');
    bar.innerHTML = '';
    (event.expectedResponders || []).forEach((r) => {
      const chip = document.createElement('span');
      chip.className = 'responder-chip' + (r.responded ? ' done' : '');
      chip.textContent = (r.responded ? '✅ ' : '⏳ ') + r.name;
      bar.append(chip);
    });
  }

  function renderDayTabs() {
    for (const [tabsId, active, onClick] of [
      ['dayTabs', () => activeDay, (d) => { activeDay = d; renderSlotList(); renderDayTabs(); renderCopyDayOptions(); }],
      ['dayTabsResults', () => activeDayResults, (d) => { activeDayResults = d; renderResultsSlotList(); renderDayTabs(); }],
    ]) {
      const wrap = el(tabsId);
      wrap.innerHTML = '';
      dayList.forEach((d) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = fmtDay(d);
        if (d === active()) b.classList.add('active');
        b.onclick = () => onClick(d);
        wrap.append(b);
      });
    }
    updateTabHints();
  }

  function updateTabHints() {
    const mappings = [
      ['dayTabs', 'dayTabsHint'],
      ['dayTabsResults', 'dayTabsResultsHint'],
    ];
    mappings.forEach(([tabsId, hintId]) => {
      const tabs = el(tabsId);
      const hint = el(hintId);
      if (!tabs || !hint) return;
      hint.style.display = tabs.scrollWidth > tabs.clientWidth ? '' : 'none';
    });
  }

  function slotsForDay(day) { return event.slots.filter((s) => slotLocalCache.get(s) === day); }

  function renderCopyDayOptions() {
    const card = el('copyDayCard');
    const targets = el('copyDayTargets');
    const copyBtn = el('copyDayBtn');
    if (!viewer || !event || !activeDay || dayList.length <= 1) {
      card.style.display = 'none';
      return;
    }
    card.style.display = '';
    targets.innerHTML = '';
    const otherDays = dayList.filter((d) => d !== activeDay);
    otherDays.forEach((d) => {
      const row = document.createElement('label');
      row.className = 'copyday-target';
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.value = d;
      check.addEventListener('change', () => {
        copyBtn.disabled = !targets.querySelector('input:checked');
      });
      const text = document.createElement('span');
      text.textContent = fmtDay(d);
      row.append(check, text);
      targets.append(row);
    });
    copyBtn.disabled = true;
  }

  function copyPatternToDays(targetDays) {
    const sourceSlots = slotsForDay(activeDay);
    const selectedIndexes = [];
    sourceSlots.forEach((slot, idx) => {
      if (mySlots.has(slot)) selectedIndexes.push(idx);
    });
    targetDays.forEach((day) => {
      const daySlots = slotsForDay(day);
      daySlots.forEach((slot) => mySlots.delete(slot));
      selectedIndexes.forEach((idx) => {
        if (idx < daySlots.length) mySlots.add(daySlots[idx]);
      });
    });
  }

  function renderSlotList() {
    const list = el('slotList');
    list.innerHTML = '';
    if (!viewer) return;
    let dragging = false, dragValue = true;
    slotsForDay(activeDay).forEach((slot) => {
      const row = document.createElement('div');
      row.className = 'slot' + (mySlots.has(slot) ? ' selected' : '');
      const label = document.createElement('span');
      label.textContent = fmtTime(slot);
      row.append(label);
      const apply = () => { if (dragValue) mySlots.add(slot); else mySlots.delete(slot); row.classList.toggle('selected', dragValue); };
      row.addEventListener('pointerdown', (e) => { dragging = true; dragValue = !mySlots.has(slot); apply(); e.preventDefault(); });
      row.addEventListener('pointerenter', () => { if (dragging) apply(); });
      list.append(row);
    });
    window.addEventListener('pointerup', () => { dragging = false; }, { once: false });
  }

  async function refreshResults() {
    const res = await fetch('/api/events/' + eventId + '/results');
    if (!res.ok) return;
    const results = await res.json();
    el('respCount').textContent = results.totalParticipants;
    renderBestBanner(results);
    renderTopList(results);
    window.__lastResults = results;
    renderResultsSlotList();
  }

  function renderBestBanner(results) {
    const banner = el('bestBanner');
    if (results.totalParticipants === 0) { banner.innerHTML = '<p class="muted">No one has submitted availability yet.</p>'; return; }
    if (results.totalParticipants < 2) { banner.innerHTML = '<p class="muted">Waiting on at least one more person — a matched date needs at least two people\u2019s availability.</p>'; return; }
    if (results.best.slots.length > 0) {
      banner.innerHTML = '';
      const div = document.createElement('div');
      div.className = 'best-banner';
      const strong = document.createElement('strong');
      strong.textContent = '✅ Everyone is free ' + results.best.slots.length + ' time' + (results.best.slots.length > 1 ? 's' : '') + ':';
      div.append(strong);
      results.best.slots.slice(0, 5).forEach((s) => {
        const p = document.createElement('div');
        p.textContent = fmtDay(slotLocalCache.get(s)) + ' at ' + fmtTime(s);
        div.append(p);
      });
      banner.append(div);
    } else {
      banner.innerHTML = '<p class="muted">No single time works for everyone yet — here are the closest matches:</p>';
    }
  }

  function renderTopList(results) {
    const wrap = el('topList');
    wrap.innerHTML = '';
    if (results.top.length === 0) { wrap.innerHTML = '<p class="muted">No responses yet.</p>'; return; }
    results.top.forEach((t) => {
      const row = document.createElement('div');
      row.style.padding = '8px 0'; row.style.borderBottom = '1px solid var(--border)';
      const title = document.createElement('div');
      title.innerHTML = '<strong>' + fmtDay(slotLocalCache.get(t.slot)) + ' at ' + fmtTime(t.slot) + '</strong> <span class="pill">' + t.count + '/' + results.totalParticipants + '</span>';
      row.append(title);
      if (t.missing.length > 0) {
        const miss = document.createElement('div');
        miss.className = 'missing';
        miss.textContent = 'Missing: ' + t.missing.join(', ');
        row.append(miss);
      }
      wrap.append(row);
    });
  }

  function renderResultsSlotList() {
    const results = window.__lastResults;
    const list = el('slotListResults');
    list.innerHTML = '';
    if (!results) return;
    slotsForDay(activeDayResults).forEach((slot) => {
      const count = results.counts[slot] || 0;
      const total = results.totalParticipants;
      const row = document.createElement('div');
      let heatClass = 'heat0';
      if (total > 0 && count === total) heatClass = 'heatfull';
      else if (total > 0) { const ratio = count / total; heatClass = ratio > 0.66 ? 'heat3' : ratio > 0.33 ? 'heat2' : count > 0 ? 'heat1' : 'heat0'; }
      row.className = 'slot ' + heatClass;
      const label = document.createElement('span'); label.textContent = fmtTime(slot);
      const c = document.createElement('span'); c.className = 'count'; c.textContent = count + '/' + total;
      row.append(label, c);
      list.append(row);
    });
  }

  el('copyBtn').onclick = async () => {
    el('shareUrl').select();
    try { await navigator.clipboard.writeText(el('shareUrl').value); toast('Link copied'); }
    catch (e) { document.execCommand('copy'); toast('Link copied'); }
  };

  el('tabAvailability').onclick = () => { el('availabilityView').style.display = ''; el('resultsView').style.display = 'none'; };
  el('tabResults').onclick = () => { el('availabilityView').style.display = 'none'; el('resultsView').style.display = ''; refreshResults(); };

  el('copyDayBtn').onclick = () => {
    const targetDays = Array.from(el('copyDayTargets').querySelectorAll('input:checked')).map((n) => n.value);
    if (targetDays.length === 0) return;
    copyPatternToDays(targetDays);
    renderSlotList();
    renderCopyDayOptions();
    toast('Copied to ' + targetDays.length + ' day' + (targetDays.length === 1 ? '' : 's'));
  };

  window.addEventListener('resize', updateTabHints);

  el('saveBtn').onclick = async () => {
    const res = await fetch('/api/events/' + eventId + '/me', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots: Array.from(mySlots) }),
    });
    if (res.status === 401) { location.href = '/auth/discord?next=' + encodeURIComponent('/e/' + eventId); return; }
    if (!res.ok) { toast('Could not save — try again'); return; }
    toast('Saved!');
    await loadEvent();
    el('tabResults').click();
  };

  (async () => { await loadViewer(); await loadEvent(); })();
})();
</script>
</body>
</html>`;
}

module.exports = { homePage, eventPage, escapeHtml, ogMetaTags };

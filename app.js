'use strict';

// ================================================================
// CONSTANTS
// ================================================================

const RACE_DATE_STR = '2026-09-13';
const RACE_DATE = new Date(RACE_DATE_STR + 'T09:00:00');
const GNR_DISTANCE = 13.1;
const PEAK_DISTANCE = 10;
const NS = 'gnr_';

const KEYS = {
  SETUP:  NS + 'setup',
  LOGS:   NS + 'logs',
  FREEZE: NS + 'freeze',
};

// ================================================================
// HABIT DEFINITIONS
// ================================================================

const GOOD_HABITS = [
  { id: 'noGluten',     label: 'No gluten',            type: 'daily',    important: true,  icon: '\u{1F33E}' },
  { id: 'noAlcohol',    label: 'No alcohol',            type: 'daily',    important: false, icon: '❌' },
  { id: 'lowCarb',      label: 'Low-carb day',          type: 'daily',    important: false, icon: '\u{1F957}' },
  { id: 'steps10k',     label: '10,000 steps',          type: 'daily',    important: false, icon: '\u{1F45F}' },
  { id: 'sleep7',       label: 'Sleep 7+ hours',        type: 'daily',    important: false, icon: '\u{1F634}' },
  { id: 'mobility',     label: 'Mobility / stretching', type: 'daily',    important: false, icon: '\u{1F9D8}' },
  { id: 'gymSession',   label: 'Gym session',           type: 'weekly',   target: 2,        icon: '\u{1F4AA}', note: 'Target: Tue + Sat' },
  { id: 'shortRun',     label: 'Short run',             type: 'weekly',   target: 1,        icon: '\u{1F3C3}' },
  { id: 'longRun',      label: 'Long run',              type: 'weekly',   target: 1,        icon: '\u{1F3C3}‍♂️', isSunday: true },
  { id: 'fuelPractice', label: 'Race fuel practice',    type: 'optional', important: false, icon: '⚡', note: 'On long runs' },
];


// ================================================================
// STORAGE
// ================================================================

const Store = {
  get(key)        { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } },
  remove(key)     { localStorage.removeItem(key); },
  getLogs()       { return this.get(KEYS.LOGS) || {}; },
  setLog(ds, d)   { const logs = this.getLogs(); logs[ds] = d; this.set(KEYS.LOGS, logs); },
  getLog(ds)      { return this.getLogs()[ds] || null; },
};

// ================================================================
// DATE UTILITIES
// ================================================================

function toDS(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().split('T')[0];
}

function todayDS() { return toDS(new Date()); }

function parseDS(ds) { return new Date(ds + 'T12:00:00'); }

function daysUntilRace() {
  const t = new Date(); t.setHours(0,0,0,0);
  const r = new Date(RACE_DATE); r.setHours(0,0,0,0);
  return Math.max(0, Math.round((r - t) / 86400000));
}

function weeksUntilRace() { return Math.ceil(daysUntilRace() / 7); }

function fmtDate(ds, opts) {
  return parseDS(ds).toLocaleDateString('en-GB', opts || { weekday: 'short', day: 'numeric', month: 'short' });
}

function fmtDateLong(ds) {
  return parseDS(ds).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function isSundayDS(ds) { return parseDS(ds).getDay() === 0; }

function getWeekMon(ds) {
  const d = parseDS(ds);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return toDS(d);
}

function addDays(ds, n) {
  const d = parseDS(ds);
  d.setDate(d.getDate() + n);
  return toDS(d);
}

function monthDays(year, month) { return new Date(year, month + 1, 0).getDate(); }

// ================================================================
// TRAINING PLAN GENERATOR
// ================================================================

function generatePlan(longestRun) {
  // Collect all Sundays from today's "setup start" through race day
  const setup = Store.get(KEYS.SETUP);
  const startDS = setup ? setup.startDate : todayDS();
  const startD = parseDS(startDS);

  // Find first Sunday >= start
  while (startD.getDay() !== 0) startD.setDate(startD.getDate() + 1);

  const sundays = [];
  const d = new Date(startD);
  while (toDS(d) <= RACE_DATE_STR) {
    sundays.push(toDS(d));
    d.setDate(d.getDate() + 7);
  }

  const totalWeeks = sundays.length;
  if (totalWeeks === 0) return { weeks: [], cantReachPeak: false };

  const raceIdx = sundays.indexOf(RACE_DATE_STR);
  const lastTrainingIdx = raceIdx >= 0 ? raceIdx - 1 : totalWeeks - 1;
  // Reserve 1 week for the taper run before race
  const buildCount = Math.max(0, lastTrainingIdx);

  const weeks = [];
  let current = longestRun;

  // Build phase: +1 mile per week up to peak, then hold
  for (let i = 0; i < buildCount; i++) {
    const weekNum = i + 1;
    const dist = current < PEAK_DISTANCE
      ? Math.min(current + 1.0, PEAK_DISTANCE)
      : PEAK_DISTANCE;
    weeks.push({ sunday: sundays[i], weekNum, distance: dist, type: 'build' });
    current = dist;
  }

  // One shorter taper run the week before the race
  const taperIdx = buildCount;
  if (taperIdx <= lastTrainingIdx) {
    const taperDist = Math.max(Math.round(PEAK_DISTANCE * 0.55 * 2) / 2, 4);
    weeks.push({ sunday: sundays[taperIdx], weekNum: buildCount + 1, distance: taperDist, type: 'taper' });
  }

  // Race day
  if (raceIdx >= 0) {
    weeks.push({ sunday: RACE_DATE_STR, weekNum: weeks.length + 1, distance: GNR_DISTANCE, type: 'race' });
  }

  const buildDists = weeks.filter(w => w.type === 'build').map(w => w.distance);
  const maxReached = buildDists.length > 0 ? Math.max(...buildDists) : longestRun;

  return { weeks, cantReachPeak: false, maxReached };
}

function getCurrentWeekPlan() {
  const setup = Store.get(KEYS.SETUP);
  if (!setup) return null;
  const { weeks } = generatePlan(setup.longestRun);
  const t = todayDS();
  for (const w of weeks) { if (w.sunday >= t) return w; }
  return weeks[weeks.length - 1] || null;
}

function getTrainingWeekInfo() {
  const setup = Store.get(KEYS.SETUP);
  if (!setup) return { weekNum: 1, total: 1 };
  const { weeks } = generatePlan(setup.longestRun);
  const t = todayDS();
  for (let i = 0; i < weeks.length; i++) {
    if (weeks[i].sunday >= t) return { weekNum: weeks[i].weekNum, total: weeks.length };
  }
  return { weekNum: weeks.length, total: weeks.length };
}

// ================================================================
// LOG OPERATIONS
// ================================================================

function getOrCreateLog(ds) {
  const existing = Store.getLog(ds);
  if (existing) return existing;
  return {
    date: ds,
    habits: {},
    bad: {},
    longRunDistance: null,
    checkinComplete: false,
  };
}

function saveLog(ds, log) {
  Store.setLog(ds, log);
}

function isCheckinDone(ds) {
  const log = Store.getLog(ds);
  return !!(log && log.checkinComplete);
}

function getWeeklyHabitCount(habitId, weekMonDS) {
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const ds = addDays(weekMonDS, i);
    const log = Store.getLog(ds);
    if (log && log.habits && log.habits[habitId]) count++;
  }
  return count;
}

function getWeeklyLongRunDistance(weekMonDS) {
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const ds = addDays(weekMonDS, i);
    const log = Store.getLog(ds);
    if (log && log.longRunDistance) total += log.longRunDistance;
  }
  return total;
}

function getTotalLoggedMiles() {
  let total = 0;
  const logs = Store.getLogs();
  for (const log of Object.values(logs)) {
    if (log.longRunDistance) total += log.longRunDistance;
    if (log.shortRunDistance) total += log.shortRunDistance;
  }
  return Math.round(total * 10) / 10;
}

function getLongRunPB() {
  let pb = 0;
  const logs = Store.getLogs();
  for (const log of Object.values(logs)) {
    if (log.longRunDistance && log.longRunDistance > pb) pb = log.longRunDistance;
  }
  return pb;
}

function getTotalBikeMiles() {
  let total = 0;
  const logs = Store.getLogs();
  for (const log of Object.values(logs)) {
    if (log.bikeDistance) total += log.bikeDistance;
  }
  return Math.round(total * 10) / 10;
}

function getTotalSwimHours() {
  let total = 0;
  const logs = Store.getLogs();
  for (const log of Object.values(logs)) {
    if (log.swimHours) total += log.swimHours;
  }
  return Math.round(total * 100) / 100;
}

function getTotalHikeMiles() {
  let total = 0;
  const logs = Store.getLogs();
  for (const log of Object.values(logs)) {
    if (log.hikeDistance) total += log.hikeDistance;
  }
  return Math.round(total * 10) / 10;
}

function getTotalAllMiles() {
  let total = 0;
  const logs = Store.getLogs();
  for (const log of Object.values(logs)) {
    if (log.longRunDistance) total += log.longRunDistance;
    if (log.shortRunDistance) total += log.shortRunDistance;
    if (log.bikeDistance) total += log.bikeDistance;
    if (log.hikeDistance) total += log.hikeDistance;
  }
  return Math.round(total * 10) / 10;
}

function getTotalGymSessions() {
  let count = 0;
  const logs = Store.getLogs();
  for (const log of Object.values(logs)) {
    if (log.habits?.gymSession) count++;
  }
  return count;
}

// ================================================================
// STREAKS
// ================================================================

function calcOverallStreak() {
  const freeze = Store.get(KEYS.FREEZE) || { usedDates: [] };
  const usedDates = freeze.usedDates || [];
  let streak = 0;
  const d = new Date(); d.setHours(0,0,0,0);

  // Count today first
  if (isCheckinDone(toDS(d))) streak = 1;
  d.setDate(d.getDate() - 1);

  for (let i = 0; i < 400; i++) {
    const ds = toDS(d);
    if (isCheckinDone(ds) || usedDates.includes(ds)) {
      streak++;
    } else {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function calcHabitStreak(habitId, isBad) {
  let streak = 0;
  const d = new Date(); d.setHours(0,0,0,0);

  // Check today
  const todayLog = Store.getLog(toDS(d));
  const todayOk = isBad
    ? (todayLog && !todayLog.bad?.[habitId])
    : (todayLog && todayLog.habits?.[habitId]);
  if (todayLog && todayOk) streak = 1;
  d.setDate(d.getDate() - 1);

  for (let i = 0; i < 400; i++) {
    const ds = toDS(d);
    const log = Store.getLog(ds);
    if (!log) break;
    const ok = isBad ? !log.bad?.[habitId] : log.habits?.[habitId];
    if (ok) streak++;
    else break;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function calcHitRate(habitId, isBad, days) {
  days = days || 30;
  let hits = 0, total = 0;
  const d = new Date(); d.setHours(0,0,0,0);
  for (let i = 0; i < days; i++) {
    const ds = toDS(d);
    const log = Store.getLog(ds);
    if (log) {
      total++;
      const ok = isBad ? !log.bad?.[habitId] : log.habits?.[habitId];
      if (ok) hits++;
    }
    d.setDate(d.getDate() - 1);
  }
  return total >= 3 ? Math.round((hits / total) * 100) : null;
}

function checkAndEarnFreeze() {
  const freeze = Store.get(KEYS.FREEZE) || { available: false, usedDates: [] };
  if (freeze.available) return false;
  let consecutive = 0;
  const d = new Date(); d.setHours(0,0,0,0);
  for (let i = 0; i < 7; i++) {
    if (isCheckinDone(toDS(d))) consecutive++;
    else break;
    d.setDate(d.getDate() - 1);
  }
  if (consecutive >= 7) {
    freeze.available = true;
    Store.set(KEYS.FREEZE, freeze);
    return true;
  }
  return false;
}

function spendFreeze(ds) {
  const freeze = Store.get(KEYS.FREEZE) || { available: false, usedDates: [] };
  if (!freeze.available) return false;
  freeze.available = false;
  if (!freeze.usedDates) freeze.usedDates = [];
  freeze.usedDates.push(ds);
  Store.set(KEYS.FREEZE, freeze);
  return true;
}

// ================================================================
// ENCOURAGEMENT
// ================================================================

const MSGS = {
  perfect:   ['Perfect day. Stack them up.', 'Every box ticked. Rare and valuable.', 'A complete day. The chain gets stronger.'],
  longPB:    ['New long run distance. Your body is adapting.', 'Personal best long run. Remember this feeling.', 'New distance record for you. Earned.'],
  longRun:   ['Long run done. The miles are in the bank.', 'Race-day confidence built one long run at a time.', 'That distance is yours now.'],
  gym:       ['Strength work done. It pays on race day.', 'Gym session in. You are building a stronger engine.'],
  gluten:    ['Gut happy, legs happy.', 'Clean eating, clean running.', 'Gluten-free day. Gut thanks you.'],
  sleep:     ['Sleep is training too. Good recovery.', 'Your body rebuilds while you rest.'],
  noAlc:     ['Clear head, clear conscience. Good call.', 'Alcohol-free day. Your liver and your legs agree.'],
  default:   ['One day closer to the start line.', 'Consistency beats intensity.', 'You showed up. That is everything.', 'Stack these days. They add up.', 'Building fitness, one session at a time.'],
};

function pickMsg(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function getEncouragementMsg(log, date) {
  if (!log) return pickMsg(MSGS.default);
  const daily = GOOD_HABITS.filter(h => h.type === 'daily');
  const allDone = daily.every(h => log.habits?.[h.id]);
  if (allDone) return pickMsg(MSGS.perfect);
  if (log.longRunDistance) {
    const pb = getLongRunPB();
    if (log.longRunDistance >= pb) return pickMsg(MSGS.longPB);
    return pickMsg(MSGS.longRun);
  }
  if (log.habits?.gymSession) return pickMsg(MSGS.gym);
  if (log.habits?.noGluten) return pickMsg(MSGS.gluten);
  if (log.habits?.sleep7) return pickMsg(MSGS.sleep);
  if (log.habits?.noAlcohol) return pickMsg(MSGS.noAlc);
  return pickMsg(MSGS.default);
}

// ================================================================
// NAVIGATION
// ================================================================

let currentView = 'home';

function showView(view) {
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  const viewEl = document.getElementById('view-' + view);
  if (viewEl) viewEl.classList.add('active');
  const navBtn = document.querySelector(`.nav-btn[data-view="${view}"]`);
  if (navBtn) navBtn.classList.add('active');
  currentView = view;
  renderView(view);
}

function renderView(view) {
  switch (view) {
    case 'home':  renderHome(); break;
    case 'today': renderToday(todayDS()); break;
    case 'plan':  renderPlan(); break;
    case 'route': renderRoute(); break;
    case 'stats': renderStats(); break;
  }
}

// ================================================================
// RENDER: HOME
// ================================================================

function renderHome() {
  const el = document.getElementById('home-content');
  if (!el) return;
  const setup = Store.get(KEYS.SETUP);
  if (!setup) return;

  const dLeft = daysUntilRace();
  const wLeft = Math.floor(dLeft / 7);
  const dRem  = dLeft % 7;

  const wInfo = getTrainingWeekInfo();
  const cwp   = getCurrentWeekPlan();
  const todayLog = Store.getLog(todayDS());
  const todayDone = isCheckinDone(todayDS());

  const overallStreak  = calcOverallStreak();
  const glutenStreak   = calcHabitStreak('noGluten', false);
  const noAlcStreak    = calcHabitStreak('noAlcohol', false);
  const glutenRate     = calcHitRate('noGluten', false);
  const freeze         = Store.get(KEYS.FREEZE) || { available: false };

  const dailyHabits = GOOD_HABITS.filter(h => h.type === 'daily');
  const doneCount   = dailyHabits.filter(h => todayLog?.habits?.[h.id]).length;
  const totalMiles  = getTotalLoggedMiles();

  const isSun = isSundayDS(todayDS());

  const startDate = parseDS(setup.startDate);
  const dayNum = Math.floor((parseDS(todayDS()) - startDate) / 86400000) + 1;
  const startLabel = startDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  el.innerHTML = `
    <div class="dashboard-header">
      <div class="header-row">
        <div>
          <h1 class="app-title">Great North Run</h1>
          <p class="app-subtitle">13 September 2026</p>
          <p class="app-training-since">Training since ${startLabel} &mdash; Day ${dayNum}</p>
        </div>
        <button class="icon-btn" onclick="openSettings()">&#9881;</button>
      </div>
    </div>

    <div class="card countdown-card">
      <div class="countdown-numbers">
        <div class="countdown-unit">
          <span class="countdown-num">${wLeft}</span>
          <span class="countdown-label">weeks</span>
        </div>
        <span class="countdown-separator">+</span>
        <div class="countdown-unit">
          <span class="countdown-num">${dRem}</span>
          <span class="countdown-label">days</span>
        </div>
      </div>
      <p class="countdown-sub">Training week ${wInfo.weekNum} of ${wInfo.total}</p>
      <div class="countdown-miles">
        <span class="countdown-miles-num">${totalMiles}</span>
        <span class="countdown-miles-label">miles logged in training</span>
      </div>
    </div>

    <div class="card ${todayDone ? 'card-success' : ''}">
      <div class="card-header">
        <h3>Today &mdash; ${fmtDate(todayDS(), { weekday: 'long', day: 'numeric', month: 'short' })}</h3>
        ${todayDone
          ? '<span class="badge badge-success">Done</span>'
          : '<span class="badge badge-warn">Pending</span>'}
      </div>
      <p class="muted">${todayDone ? 'Check-in complete' : doneCount + '/' + dailyHabits.length + ' habits logged'}</p>
      <button class="btn-primary mt-8" onclick="showView('today')">${todayDone ? 'View today' : 'Check in now'}</button>
    </div>

    ${cwp ? `
    <div class="card">
      <div class="card-header">
        <h3>This week's long run</h3>
        <span class="badge ${cwp.type === 'race' ? 'badge-red' : cwp.type === 'taper' ? 'badge-navy' : ''}">${cwp.type === 'race' ? 'Race day!' : cwp.type}</span>
      </div>
      <div class="long-run-target">
        <span class="distance-big">${cwp.distance}</span>
        <span class="distance-unit">mi</span>
      </div>
      <p class="muted">Sunday ${fmtDate(cwp.sunday)}</p>
      <button class="btn-secondary mt-8" onclick="showView('plan')">Full plan</button>
    </div>` : ''}

    <div class="card card-highlight">
      <div class="card-header">
        <h3>&#127806; No gluten streak</h3>
        ${freeze.available ? '<span class="badge badge-ice">&#10052; Freeze ready</span>' : ''}
      </div>
      <div class="streak-row">
        <span class="streak-num">${glutenStreak}</span>
        <span class="streak-label">${glutenStreak === 1 ? 'day' : 'days'} clean</span>
      </div>
      <p class="muted">${glutenRate !== null ? glutenRate + '% hit rate (last 30 days)' : 'Keep logging to see your rate'}</p>
    </div>

    <div class="card">
      <h3 class="card-title">Streaks</h3>
      <div class="streak-grid">
        <div class="streak-item">
          <span class="streak-icon">&#128293;</span>
          <span class="streak-n">${overallStreak}</span>
          <span class="streak-l">day streak</span>
        </div>
        <div class="streak-item">
          <span class="streak-icon">&#10060;</span>
          <span class="streak-n">${noAlcStreak}</span>
          <span class="streak-l">alcohol free</span>
        </div>
        <div class="streak-item">
          <span class="streak-icon">&#127945;</span>
          <span class="streak-n">${calcHabitStreak('gymSession', false)}</span>
          <span class="streak-l">gym days</span>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Check-in chain</h3>
        ${freeze.available ? '<span class="badge badge-ice">&#10052; Freeze available</span>' : ''}
      </div>
      <div id="chain-cal"></div>
    </div>

    <button class="btn-secondary full-width" onclick="openRecap()">
      ${isSun ? "This week's recap" : 'Weekly recap'}
    </button>
  `;

  renderCalendar('chain-cal');
}

// ================================================================
// RENDER: CALENDAR
// ================================================================

function renderCalendar(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const freeze = Store.get(KEYS.FREEZE) || { usedDates: [] };
  const usedDates = freeze.usedDates || [];

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const totalDays = monthDays(year, month);
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const startOffset = (firstDay + 6) % 7; // Mon=0

  const todayNum = now.getDate();
  const todayFull = toDS(now);

  let html = '<div class="cal-header">';
  ['M','T','W','T','F','S','S'].forEach(d => {
    html += `<div class="cal-day-label">${d}</div>`;
  });
  html += '</div><div class="calendar-grid">';

  for (let i = 0; i < startOffset; i++) {
    html += '<div class="cal-day empty"></div>';
  }

  for (let day = 1; day <= totalDays; day++) {
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const isToday = day === todayNum;
    const isPast = ds < todayFull;
    const isFut  = ds > todayFull;
    const done   = isCheckinDone(ds);
    const frozen = usedDates.includes(ds);
    let cls = 'cal-day';
    if (isToday) cls += ' today-marker';
    if (frozen) cls += ' frozen';
    else if (isFut) cls += ' future';
    else if (done) cls += ' done';
    else if (isPast) cls += ' missed';
    else cls += ' future';
    html += `<div class="${cls}">${day}</div>`;
  }
  html += '</div>';
  el.innerHTML = html;
}

// ================================================================
// RENDER: TODAY / CHECK-IN
// ================================================================

let checkinDateDS = todayDS();

function renderToday(ds) {
  checkinDateDS = ds || todayDS();
  const el = document.getElementById('today-content');
  if (!el) return;

  const log = getOrCreateLog(checkinDateDS);
  const isToday = checkinDateDS === todayDS();
  const weekMon = getWeekMon(checkinDateDS);

  const gymCount  = getWeeklyHabitCount('gymSession', weekMon);
  const gymTarget = 2;
  const runCount  = getWeeklyHabitCount('shortRun', weekMon);
  const runTarget = 1;

  const isSun = isSundayDS(checkinDateDS);
  const cwp = getCurrentWeekPlan();
  const targetDist = (cwp && isSun) ? cwp.distance : null;

  function habitRow(h, checked, toggle, important) {
    const checkedClass = checked ? 'checked' : '';
    const importantLabel = important ? ' important' : '';
    return `
      <div class="habit-row" onclick="${toggle}">
        <div class="habit-icon ${checkedClass}">${h.icon}</div>
        <div class="habit-text">
          <div class="habit-label${importantLabel}">${h.label}${important ? ' &#127806;' : ''}</div>
          ${h.note ? `<div class="habit-sub">${h.note}</div>` : ''}
        </div>
        <div class="habit-check ${checkedClass}">${checked ? '&#10003;' : ''}</div>
      </div>`;
  }

  function pips(count, target) {
    let s = '<div class="progress-pips">';
    for (let i = 0; i < target; i++) s += `<div class="pip ${i < count ? 'done' : ''}"></div>`;
    s += '</div>';
    return s;
  }

  const dailyHabits = GOOD_HABITS.filter(h => h.type === 'daily');
  const weeklyHabits = GOOD_HABITS.filter(h => h.type === 'weekly');

  let html = `
    <div class="checkin-header">
      <div class="date-nav">
        <button class="date-nav-btn" onclick="navigateDay(-1)">&#8249;</button>
        <div class="date-display">
          <div class="date-main">${isToday ? 'Today' : fmtDate(checkinDateDS, { weekday: 'long' })}</div>
          <div class="date-sub">${fmtDate(checkinDateDS, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
        <button class="date-nav-btn" onclick="navigateDay(1)" ${isToday ? 'disabled' : ''}>&#8250;</button>
      </div>
    </div>

    <div class="card">
      <div class="section-title">Daily habits</div>
      ${dailyHabits.map(h => habitRow(h, !!log.habits?.[h.id], `toggleHabit('${h.id}')`, h.important)).join('')}
    </div>

    <div class="card">
      <div class="section-title">Weekly habits</div>

      <div class="habit-row" onclick="toggleHabit('gymSession')">
        <div class="habit-icon ${log.habits?.gymSession ? 'checked' : ''}">&#128170;</div>
        <div class="habit-text">
          <div class="habit-label">Gym session</div>
          <div class="habit-sub">Aim for Tue + Sat</div>
          <div class="weekly-progress">
            ${pips(gymCount, gymTarget)}
            <span class="habit-sub">${gymCount}/${gymTarget} this week</span>
          </div>
        </div>
        <div class="habit-check ${log.habits?.gymSession ? 'checked' : ''}">${log.habits?.gymSession ? '&#10003;' : ''}</div>
      </div>

      <div class="habit-row" onclick="toggleHabit('shortRun')">
        <div class="habit-icon ${log.habits?.shortRun ? 'checked' : ''}">&#127939;</div>
        <div class="habit-text">
          <div class="habit-label">Short run</div>
          <div class="weekly-progress">
            ${pips(runCount, runTarget)}
            <span class="habit-sub">${runCount}/${runTarget} this week</span>
          </div>
        </div>
        <div class="habit-check ${log.habits?.shortRun ? 'checked' : ''}">${log.habits?.shortRun ? '&#10003;' : ''}</div>
      </div>

      ${log.habits?.shortRun ? `
      <div class="long-run-log">
        <label>Distance run (miles):</label>
        <div class="long-run-input-row">
          <input type="number" class="long-run-input" id="short-run-dist-input"
            value="${log.shortRunDistance || ''}" min="0.1" max="20" step="0.1"
            onchange="saveShortRunDistance(this.value)"
            onblur="saveShortRunDistance(this.value)">
          <span class="input-unit dark">mi</span>
        </div>
      </div>` : ''}

      <div class="habit-row" onclick="toggleHabit('longRun')">
        <div class="habit-icon ${log.habits?.longRun ? 'checked' : ''}">&#127939;&#8205;&#9794;&#65039;</div>
        <div class="habit-text">
          <div class="habit-label">Long run ${isSun ? '(today!)' : '(Sunday)'}</div>
          ${targetDist ? `<div class="habit-sub">Target: ${targetDist} miles</div>` : ''}
        </div>
        <div class="habit-check ${log.habits?.longRun ? 'checked' : ''}">${log.habits?.longRun ? '&#10003;' : ''}</div>
      </div>

      ${log.habits?.longRun ? `
      <div class="long-run-log">
        <label>Distance run (miles):</label>
        <div class="long-run-input-row">
          <input type="number" class="long-run-input" id="long-run-dist-input"
            value="${log.longRunDistance || ''}" min="0.5" max="30" step="0.1"
            onchange="saveLongRunDistance(this.value)"
            onblur="saveLongRunDistance(this.value)">
          <span class="input-unit dark">mi</span>
        </div>
      </div>` : ''}

      <div class="habit-row" onclick="toggleHabit('fuelPractice')">
        <div class="habit-icon ${log.habits?.fuelPractice ? 'checked' : ''}">&#9889;</div>
        <div class="habit-text">
          <div class="habit-label">Race fuel practice</div>
          <div class="habit-sub">On long runs</div>
        </div>
        <div class="habit-check ${log.habits?.fuelPractice ? 'checked' : ''}">${log.habits?.fuelPractice ? '&#10003;' : ''}</div>
      </div>
    </div>

    <div class="card">
      <div class="section-title">Cross training</div>

      <div class="habit-row" onclick="toggleHabit('swim')">
        <div class="habit-icon ${log.habits?.swim ? 'checked' : ''}">\u{1F3CA}</div>
        <div class="habit-text">
          <div class="habit-label">Swim</div>
        </div>
        <div class="habit-check ${log.habits?.swim ? 'checked' : ''}">${log.habits?.swim ? '&#10003;' : ''}</div>
      </div>

      ${log.habits?.swim ? `
      <div class="long-run-log">
        <label>Duration (hours):</label>
        <div class="long-run-input-row">
          <input type="number" class="long-run-input" id="swim-hours-input"
            value="${log.swimHours || ''}" min="0.1" max="10" step="0.25"
            onchange="saveSwimHours(this.value)"
            onblur="saveSwimHours(this.value)">
          <span class="input-unit dark">hrs</span>
        </div>
      </div>` : ''}

      <div class="habit-row" onclick="toggleHabit('bike')">
        <div class="habit-icon ${log.habits?.bike ? 'checked' : ''}">\u{1F6B4}</div>
        <div class="habit-text">
          <div class="habit-label">Bike ride</div>
        </div>
        <div class="habit-check ${log.habits?.bike ? 'checked' : ''}">${log.habits?.bike ? '&#10003;' : ''}</div>
      </div>

      ${log.habits?.bike ? `
      <div class="long-run-log">
        <label>Distance (miles):</label>
        <div class="long-run-input-row">
          <input type="number" class="long-run-input" id="bike-dist-input"
            value="${log.bikeDistance || ''}" min="0.1" max="200" step="0.1"
            onchange="saveBikeDistance(this.value)"
            onblur="saveBikeDistance(this.value)">
          <span class="input-unit dark">mi</span>
        </div>
      </div>` : ''}

      <div class="habit-row" onclick="toggleHabit('hike')">
        <div class="habit-icon ${log.habits?.hike ? 'checked' : ''}">\u{1F97E}</div>
        <div class="habit-text">
          <div class="habit-label">Hiking</div>
        </div>
        <div class="habit-check ${log.habits?.hike ? 'checked' : ''}">${log.habits?.hike ? '&#10003;' : ''}</div>
      </div>

      ${log.habits?.hike ? `
      <div class="long-run-log">
        <label>Distance (miles):</label>
        <div class="long-run-input-row">
          <input type="number" class="long-run-input" id="hike-dist-input"
            value="${log.hikeDistance || ''}" min="0.1" max="100" step="0.1"
            onchange="saveHikeDistance(this.value)"
            onblur="saveHikeDistance(this.value)">
          <span class="input-unit dark">mi</span>
        </div>
      </div>` : ''}
    </div>

    ${!log.checkinComplete ? `
    <button class="btn-primary full-width" onclick="completeCheckin()">Complete check-in</button>
    ` : `
    <div style="text-align:center; padding: 12px 0; color: var(--success); font-weight: 700; font-size: 15px;">
      &#10003; Check-in complete
    </div>
    `}
  `;

  el.innerHTML = html;
}

function navigateDay(dir) {
  const d = parseDS(checkinDateDS);
  d.setDate(d.getDate() + dir);
  const newDS = toDS(d);
  if (newDS > todayDS()) return;
  renderToday(newDS);
}

function toggleHabit(id) {
  const log = getOrCreateLog(checkinDateDS);
  if (!log.habits) log.habits = {};
  log.habits[id] = !log.habits[id];
  if (id === 'longRun' && !log.habits[id]) log.longRunDistance = null;
  if (id === 'shortRun' && !log.habits[id]) log.shortRunDistance = null;
  if (id === 'bike' && !log.habits[id]) log.bikeDistance = null;
  if (id === 'swim' && !log.habits[id]) log.swimHours = null;
  if (id === 'hike' && !log.habits[id]) log.hikeDistance = null;
  saveLog(checkinDateDS, log);
  renderToday(checkinDateDS);
}

function saveLongRunDistance(val) {
  const n = parseFloat(val);
  if (isNaN(n) || n <= 0) return;
  const log = getOrCreateLog(checkinDateDS);
  log.longRunDistance = Math.round(n * 10) / 10;
  saveLog(checkinDateDS, log);
}

function saveShortRunDistance(val) {
  const n = parseFloat(val);
  if (isNaN(n) || n <= 0) return;
  const log = getOrCreateLog(checkinDateDS);
  log.shortRunDistance = Math.round(n * 10) / 10;
  saveLog(checkinDateDS, log);
}

function saveBikeDistance(val) {
  const n = parseFloat(val);
  if (isNaN(n) || n <= 0) return;
  const log = getOrCreateLog(checkinDateDS);
  log.bikeDistance = Math.round(n * 10) / 10;
  saveLog(checkinDateDS, log);
}

function saveSwimHours(val) {
  const n = parseFloat(val);
  if (isNaN(n) || n <= 0) return;
  const log = getOrCreateLog(checkinDateDS);
  log.swimHours = Math.round(n * 100) / 100;
  saveLog(checkinDateDS, log);
}

function saveHikeDistance(val) {
  const n = parseFloat(val);
  if (isNaN(n) || n <= 0) return;
  const log = getOrCreateLog(checkinDateDS);
  log.hikeDistance = Math.round(n * 10) / 10;
  saveLog(checkinDateDS, log);
}

function completeCheckin() {
  const log = getOrCreateLog(checkinDateDS);
  log.checkinComplete = true;
  saveLog(checkinDateDS, log);
  dismissNudge();

  const earned = checkAndEarnFreeze();

  showCompletionModal(log, earned);
  renderToday(checkinDateDS);
}

// ================================================================
// RENDER: TRAINING PLAN
// ================================================================

function renderPlan() {
  const el = document.getElementById('plan-content');
  if (!el) return;
  const setup = Store.get(KEYS.SETUP);
  if (!setup) return;

  const { weeks, cantReachPeak, maxReached } = generatePlan(setup.longestRun);
  const todayStr = todayDS();

  let html = `
    <div class="plan-header">
      <div class="header-row">
        <div>
          <h1 class="app-title">Training Plan</h1>
          <p class="app-subtitle">Built from ${setup.longestRun} miles &rarr; race day</p>
        </div>
      </div>
    </div>
  `;


  const loggedDistances = {};
  const logs = Store.getLogs();
  for (const [ds, log] of Object.entries(logs)) {
    if (log.longRunDistance) loggedDistances[ds] = log.longRunDistance;
  }

  weeks.forEach(week => {
    const isCurrentWeek = week.sunday > todayStr || week.sunday === todayStr;
    const isPast = week.sunday < todayStr;
    const logged = loggedDistances[week.sunday];

    let statusClass = '';
    if (week.type === 'race') statusClass = 'race-week';
    else if (week.sunday < todayStr) statusClass = 'completed';
    else if (isCurrentWeek && weeks.find(w => w.sunday >= todayStr) === week) statusClass = 'current-week';

    const weekNumClass = week.type === 'race' ? 'race'
      : isPast ? 'done'
      : (weeks.find(w => w.sunday >= todayStr) === week ? 'current' : '');

    const typeLabel = week.type === 'build' ? 'Build' :
      week.type === 'cutback' ? 'Recovery' :
      week.type === 'peak' ? 'Peak' :
      week.type === 'taper' ? 'Taper' :
      week.type === 'race' ? 'Race day!' : week.type;

    html += `
      <div class="plan-week-row ${statusClass}">
        <div class="week-num ${weekNumClass}">
          ${week.type === 'race' ? 'GO' : week.weekNum}
        </div>
        <div class="week-info">
          <div class="week-date">${fmtDate(week.sunday)}</div>
          <div class="week-label">${week.type === 'race' ? '&#127937; Race day' : 'Long run'}</div>
          <div class="week-type">${typeLabel}</div>
          ${logged ? `<div class="week-logged">&#10003; Logged ${logged} mi</div>` : ''}
        </div>
        <div style="text-align:right">
          <div class="week-distance">${week.distance}</div>
          <div class="week-distance-unit">miles</div>
        </div>
      </div>`;
  });

  el.innerHTML = html;
}

// ================================================================
// RENDER: ROUTE VISUALIZATION
// ================================================================

function renderRoute() {
  const el = document.getElementById('route-content');
  if (!el) return;

  const totalLogged = getTotalLoggedMiles();
  const totalRatio = totalLogged / GNR_DISTANCE; // e.g. 26 miles / 13.1 = 1.98 routes run
  const pctDisplay = Math.round(totalRatio * 100); // can exceed 100%

  let lapsCompleted = Math.floor(totalRatio);
  let progress = totalRatio - lapsCompleted; // current lap position, 0-1
  if (progress === 0 && lapsCompleted > 0) {
    // Sitting exactly on a multiple of the route distance: show the lap as finished, not reset to the start
    progress = 1;
    lapsCompleted -= 1;
  }

  // Landmarks roughly at % of path: start=0, Tyne Bridge=30%, South Shields=100%
  const tyneBridgePct = 0.30;
  const bridgeReached = progress >= tyneBridgePct;

  // SVG path coordinates
  // Viewbox 0 0 360 140
  // Path goes: start (20,80) -> dip for bridge -> rise -> South Shields (340,70)
  const pathD = 'M 20 80 C 60 80, 90 110, 120 95 C 150 80, 160 65, 200 70 C 240 75, 290 68, 340 70';

  el.innerHTML = `
    <div class="route-header">
      <div class="header-row">
        <div>
          <h1 class="app-title">Route Progress</h1>
          <p class="app-subtitle">Newcastle to South Shields</p>
        </div>
      </div>
    </div>

    <div class="card route-card">
      <div class="route-svg-wrapper">
        <svg class="route-svg" viewBox="0 0 360 140" xmlns="http://www.w3.org/2000/svg">
          <!-- Route background -->
          <defs>
            <linearGradient id="seaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#1a3a5c"/>
              <stop offset="100%" stop-color="#0d1b2a"/>
            </linearGradient>
          </defs>
          <rect width="360" height="140" fill="#0d1b2a" rx="8"/>

          <!-- Sea hints at finish -->
          <ellipse cx="330" cy="115" rx="40" ry="18" fill="#1a4a6e" opacity="0.5"/>
          <ellipse cx="340" cy="125" rx="30" ry="12" fill="#1a5a80" opacity="0.4"/>

          <!-- Route path (faded) -->
          <path d="${pathD}" stroke="rgba(255,255,255,0.15)" stroke-width="5" fill="none" stroke-linecap="round" id="route-full-path"/>

          <!-- Route path (progress) -->
          <path d="${pathD}" stroke="#C8102E" stroke-width="5" fill="none" stroke-linecap="round"
            id="route-progress-path"
            stroke-dasharray="400"
            stroke-dashoffset="${400 - 400 * progress}"/>

          <!-- Tyne Bridge landmark -->
          <g opacity="${bridgeReached ? '1' : '0.4'}">
            <line x1="115" y1="80" x2="115" y2="55" stroke="#ffd700" stroke-width="2.5"/>
            <line x1="125" y1="80" x2="125" y2="55" stroke="#ffd700" stroke-width="2.5"/>
            <path d="M 110 55 Q 120 44 130 55" stroke="#ffd700" stroke-width="2.5" fill="none"/>
            <line x1="110" y1="78" x2="130" y2="78" stroke="#ffd700" stroke-width="2"/>
          </g>

          <!-- Start marker -->
          <circle cx="20" cy="80" r="6" fill="#C8102E"/>
          <text x="20" y="115" font-size="9" fill="rgba(255,255,255,0.7)" text-anchor="middle">Start</text>
          <text x="20" y="124" font-size="8" fill="rgba(255,255,255,0.5)" text-anchor="middle">Newcastle</text>

          <!-- Tyne Bridge label -->
          <text x="120" y="40" font-size="8" fill="${bridgeReached ? '#ffd700' : 'rgba(255,255,255,0.4)'}" text-anchor="middle">Tyne Bridge</text>

          <!-- Finish marker -->
          <circle cx="340" cy="70" r="6" fill="${progress >= 0.95 ? '#22c55e' : 'rgba(255,255,255,0.3)'}"/>
          <text x="340" y="105" font-size="9" fill="rgba(255,255,255,0.7)" text-anchor="middle">Finish</text>
          <text x="340" y="114" font-size="8" fill="rgba(255,255,255,0.5)" text-anchor="middle">South Shields</text>

          <!-- Runner marker (dynamic position along path) -->
          <g id="runner-marker" transform="translate(${20 + (340 - 20) * progress}, ${80 + (progress < 0.5 ? progress * 30 - 15 : (1 - progress) * 30 - 15 + 15)})">
            <circle r="10" fill="white" opacity="0.15"/>
            <text x="0" y="5" font-size="14" text-anchor="middle">&#127939;</text>
          </g>
        </svg>
      </div>

      <div class="route-progress-label">
        ${pctDisplay}% of the route run in training
      </div>
      <div class="route-progress-sub">
        ${lapsCompleted > 0
          ? `&#127942; Run the full route ${lapsCompleted} time${lapsCompleted === 1 ? '' : 's'}`
          : 'Keep going to complete your first full route'}
      </div>
      <div class="progress-bar-wrapper">
        <div class="progress-bar-fill" style="width: ${Math.round(progress * 100)}%"></div>
      </div>

      <div class="route-landmarks">
        <div class="route-landmark">
          <span class="route-landmark-icon">&#127937;</span>
          Newcastle
        </div>
        <div class="route-landmark">
          <span class="route-landmark-icon">${bridgeReached ? '&#127775;' : '&#127775;'}</span>
          Tyne Bridge
          ${bridgeReached ? '<br><small style="color:#ffd700">Reached!</small>' : ''}
        </div>
        <div class="route-landmark">
          <span class="route-landmark-icon">&#127754;</span>
          South Shields
        </div>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">Training distance log</h3>
      <div class="route-mile-row">
        <span class="route-mile-icon">&#127939;</span>
        <span class="route-mile-label">Total miles logged</span>
        <span class="route-mile-dist"><strong>${totalLogged}</strong> mi</span>
      </div>
      <div class="route-mile-row">
        <span class="route-mile-icon">&#127775;</span>
        <span class="route-mile-label">Long run PB</span>
        <span class="route-mile-dist"><strong>${getLongRunPB() || '-'}</strong> mi</span>
      </div>
      <div class="route-mile-row">
        <span class="route-mile-icon">&#127937;</span>
        <span class="route-mile-label">Race distance</span>
        <span class="route-mile-dist"><strong>${GNR_DISTANCE}</strong> mi</span>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">About the route</h3>
      <p class="muted" style="line-height:1.6">The Great North Run starts in Newcastle city centre and heads south over the iconic Tyne Bridge into Gateshead, before turning east and following the coast road through Hebburn and Jarrow to finish at South Shields seafront.</p>
    </div>
  `;
}

// ================================================================
// RENDER: STATS
// ================================================================

function renderStats() {
  const el = document.getElementById('stats-content');
  if (!el) return;

  function statRow(h, streak, rate, isBad) {
    const rateClass = rate === null ? '' : rate >= 80 ? 'high' : rate >= 50 ? 'mid' : 'low';
    return `
      <div class="habit-stat-row">
        <div class="habit-stat-icon">${h.icon}</div>
        <div class="habit-stat-info">
          <div class="habit-stat-label">${h.label}${h.important ? ' &#127806;' : ''}</div>
          <div class="habit-stat-sub">${isBad ? 'Clean streak (avoided)' : 'Streak'}</div>
          ${rate !== null ? `
          <div class="hit-bar-wrapper">
            <div class="hit-bar-fill ${rateClass}" style="width:${rate}%"></div>
          </div>` : ''}
        </div>
        <div class="habit-stat-nums">
          <div class="stat-streak">${streak}</div>
          <div class="stat-rate">${rate !== null ? rate + '%' : '--'}</div>
        </div>
      </div>`;
  }

  const statsStartDS = '2026-06-01';
  const statsStartD = parseDS(statsStartDS);
  const todayD = new Date(); todayD.setHours(0,0,0,0);
  const daysSinceStart = Math.max(0, Math.floor((todayD - statsStartD) / 86400000)) + 1;

  const dailyGood = GOOD_HABITS.filter(h => h.type === 'daily');
  const weeklyGood = GOOD_HABITS.filter(h => h.type === 'weekly' || h.type === 'optional');
  const totalAllMiles = getTotalAllMiles();
  const totalRunMiles = getTotalLoggedMiles();
  const pb = getLongRunPB();
  const totalBikeMiles = getTotalBikeMiles();
  const totalSwimHours = getTotalSwimHours();
  const totalHikeMiles = getTotalHikeMiles();
  const totalGymSessions = getTotalGymSessions();

  let html = `
    <div class="stats-header">
      <div class="header-row">
        <div>
          <h1 class="app-title">Stats since June 1st</h1>
          <p class="app-subtitle">${daysSinceStart} day${daysSinceStart === 1 ? '' : 's'} of training</p>
        </div>
      </div>
    </div>

    <div class="card card-navy">
      <div class="section-title" style="margin-bottom:16px">Training miles</div>
      <div class="stats-miles-grid">
        <div class="stats-miles-stat">
          <div class="stats-miles-num">${totalAllMiles}</div>
          <div class="stats-miles-label">total miles logged</div>
        </div>
        <div class="stats-miles-stat clickable" onclick="openMilesRan()">
          <div class="stats-miles-num">${totalRunMiles}</div>
          <div class="stats-miles-label">total miles ran &rsaquo;</div>
        </div>
        ${pb > 0 ? `
        <div class="stats-miles-stat">
          <div class="stats-miles-num">${pb}</div>
          <div class="stats-miles-label">longest run (PB)</div>
        </div>` : ''}
        ${totalBikeMiles > 0 ? `
        <div class="stats-miles-stat">
          <div class="stats-miles-num">${totalBikeMiles}</div>
          <div class="stats-miles-label">miles biked</div>
        </div>` : ''}
        ${totalSwimHours > 0 ? `
        <div class="stats-miles-stat">
          <div class="stats-miles-num">${totalSwimHours}</div>
          <div class="stats-miles-label">hours swum</div>
        </div>` : ''}
        ${totalGymSessions > 0 ? `
        <div class="stats-miles-stat">
          <div class="stats-miles-num">${totalGymSessions}</div>
          <div class="stats-miles-label">gym sessions</div>
        </div>` : ''}
        ${totalHikeMiles > 0 ? `
        <div class="stats-miles-stat">
          <div class="stats-miles-num">${totalHikeMiles}</div>
          <div class="stats-miles-label">miles hiked</div>
        </div>` : ''}
      </div>
    </div>

    <div class="card">
      <div class="section-title" style="margin-bottom:8px">Daily habits</div>
      ${dailyGood.map(h => statRow(h, calcHabitStreak(h.id, false), calcHitRate(h.id, false), false)).join('')}
    </div>

    <div class="card">
      <div class="section-title" style="margin-bottom:8px">Weekly habits</div>
      ${weeklyGood.map(h => statRow(h, calcHabitStreak(h.id, false), calcHitRate(h.id, false), false)).join('')}
    </div>

    <div class="card">
      <h3 class="card-title">Overall streak</h3>
      <div class="streak-row">
        <span class="streak-num">${calcOverallStreak()}</span>
        <span class="streak-label">consecutive check-in days</span>
      </div>
      ${(() => {
        const freeze = Store.get(KEYS.FREEZE) || { available: false };
        if (freeze.available) return '<p class="muted">&#10052; You have a streak freeze available.</p>';
        return '<p class="muted">Complete 7 days in a row to earn a streak freeze.</p>';
      })()}
    </div>
  `;

  el.innerHTML = html;
}

// ================================================================
// WEEKLY RECAP
// ================================================================

function openRecap() {
  const modal = document.getElementById('recap-modal');
  if (!modal) return;
  renderRecapContent();
  modal.classList.remove('hidden');
}

function closeRecap(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('recap-modal').classList.add('hidden');
}

function renderRecapContent() {
  const el = document.getElementById('recap-content');
  if (!el) return;

  const setup = Store.get(KEYS.SETUP);
  const weekMon = getWeekMon(todayDS());
  const weekSun = addDays(weekMon, 6);

  let totalMiles = 0;
  let longestRun = 0;
  let sleepHit = 0;
  let gymCount = 0;
  let glutenDays = 0;
  let noAlcDays = 0;

  for (let i = 0; i < 7; i++) {
    const ds = addDays(weekMon, i);
    const log = Store.getLog(ds);
    if (!log) continue;
    if (log.longRunDistance) { totalMiles += log.longRunDistance; if (log.longRunDistance > longestRun) longestRun = log.longRunDistance; }
    if (log.shortRunDistance) totalMiles += log.shortRunDistance;
    if (log.habits?.sleep7) sleepHit++;
    if (log.habits?.gymSession) gymCount++;
    if (log.habits?.noGluten) glutenDays++;
    if (log.habits?.noAlcohol) noAlcDays++;
  }

  const pb = getLongRunPB();
  const longestIsPB = longestRun > 0 && longestRun >= pb;

  const nextWeekMon = addDays(weekMon, 7);
  const nextSun = addDays(nextWeekMon, 6);
  let nextPlan = null;
  if (setup) {
    const { weeks } = generatePlan(setup.longestRun);
    nextPlan = weeks.find(w => w.sunday > todayDS()) || null;
  }

  const overallStreak = calcOverallStreak();

  el.innerHTML = `
    <p class="recap-week-title">${fmtDate(weekMon, { day: 'numeric', month: 'short' })} to ${fmtDate(weekSun, { day: 'numeric', month: 'short', year: 'numeric' })}</p>

    <div class="recap-grid">
      <div class="recap-stat">
        <div class="recap-stat-label">Miles logged</div>
        <div class="recap-stat-val">${Math.round(totalMiles * 10) / 10}<span class="recap-stat-unit"> mi</span></div>
      </div>
      <div class="recap-stat ${longestIsPB ? 'recap-pb' : ''}">
        <div class="recap-stat-label">${longestIsPB ? 'New PB! Longest run' : 'Longest run'}</div>
        <div class="recap-stat-val">${longestRun > 0 ? longestRun : '-'}<span class="recap-stat-unit"> mi</span></div>
      </div>
      <div class="recap-stat">
        <div class="recap-stat-label">Sleep 7+ nights</div>
        <div class="recap-stat-val">${sleepHit}<span class="recap-stat-unit">/7</span></div>
      </div>
      <div class="recap-stat">
        <div class="recap-stat-label">Gym sessions</div>
        <div class="recap-stat-val">${gymCount}<span class="recap-stat-unit">/2</span></div>
      </div>
      <div class="recap-stat">
        <div class="recap-stat-label">Gluten-free days</div>
        <div class="recap-stat-val">${glutenDays}<span class="recap-stat-unit">/7</span></div>
      </div>
      <div class="recap-stat">
        <div class="recap-stat-label">Alcohol-free days</div>
        <div class="recap-stat-val">${noAlcDays}<span class="recap-stat-unit">/7</span></div>
      </div>
    </div>

    <div class="recap-stat" style="margin-bottom:16px">
      <div class="recap-stat-label">Check-in streak</div>
      <div class="recap-stat-val">${overallStreak}<span class="recap-stat-unit"> days</span></div>
    </div>

    ${nextPlan ? `
    <div class="recap-next-week">
      <div class="recap-next-label">Next long run target</div>
      <div class="recap-next-dist">${nextPlan.distance} <span class="recap-next-miles">miles</span></div>
      <div class="recap-next-date">Sunday ${fmtDate(nextPlan.sunday)}</div>
    </div>` : ''}

    <button class="btn-secondary full-width" onclick="closeRecap()">Close</button>
  `;
}

// ================================================================
// MILES RAN DRILL-DOWN
// ================================================================

function openMilesRan() {
  const modal = document.getElementById('milesran-modal');
  if (!modal) return;
  renderMilesRanContent();
  modal.classList.remove('hidden');
}

function closeMilesRan(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('milesran-modal').classList.add('hidden');
}

function renderMilesRanContent() {
  const el = document.getElementById('milesran-content');
  if (!el) return;

  const logs = Store.getLogs();
  const entries = [];
  for (const [ds, log] of Object.entries(logs)) {
    if (log.longRunDistance) entries.push({ ds, distance: log.longRunDistance, type: 'Long run' });
    if (log.shortRunDistance) entries.push({ ds, distance: log.shortRunDistance, type: 'Short run' });
  }
  entries.sort((a, b) => b.ds.localeCompare(a.ds));

  const total = Math.round(entries.reduce((sum, e) => sum + e.distance, 0) * 10) / 10;

  if (entries.length === 0) {
    el.innerHTML = '<p class="milesran-empty">No runs logged yet.</p>';
    return;
  }

  el.innerHTML = `
    <p class="milesran-summary">${total} miles across ${entries.length} run${entries.length === 1 ? '' : 's'}</p>
    <div class="milesran-list">
      ${entries.map(e => `
        <div class="milesran-row">
          <div class="milesran-date">${fmtDate(e.ds, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}<span class="milesran-type">${e.type}</span></div>
          <div class="milesran-dist">${e.distance} mi</div>
        </div>`).join('')}
    </div>
  `;
}

// ================================================================
// COMPLETION MODAL
// ================================================================

function showCompletionModal(log, earnedFreeze) {
  const modal = document.getElementById('completion-modal');
  if (!modal) return;

  const title = document.getElementById('completion-title');
  const msg   = document.getElementById('completion-msg');
  const ring  = document.getElementById('ring-fill-el');

  const streak = calcOverallStreak();
  const message = getEncouragementMsg(log, checkinDateDS);
  const streakLine = streak > 1 ? `${streak} days in a row.` : '';

  title.textContent = 'Day complete';
  msg.textContent = (streakLine ? streakLine + ' ' : '') + message;

  modal.classList.remove('hidden');

  // Animate ring
  setTimeout(() => {
    if (ring) {
      ring.style.strokeDashoffset = '0';
    }
  }, 100);

  if (earnedFreeze) {
    setTimeout(() => showToast('&#10052; Streak freeze earned! 7 days strong.'), 1200);
  }
}

function closeCompletion(e) {
  if (e && e.target !== e.currentTarget) return;
  const modal = document.getElementById('completion-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  const ring = document.getElementById('ring-fill-el');
  if (ring) ring.style.strokeDashoffset = '314';
  if (currentView === 'home') renderHome();
}

// ================================================================
// SETTINGS
// ================================================================

function openSettings() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  const setup = Store.get(KEYS.SETUP) || {};

  const inp = document.getElementById('settings-longest-run');
  if (inp) inp.value = setup.longestRun || 5;

  const sel = document.getElementById('settings-days-selector');
  if (sel) {
    sel.classList.add('settings-days');
    sel.querySelectorAll('.day-btn').forEach(btn => {
      btn.classList.toggle('selected', parseInt(btn.dataset.val) === setup.daysPerWeek);
      btn.onclick = () => {
        sel.querySelectorAll('.day-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      };
    });
  }

  modal.classList.remove('hidden');
}

function closeSettings(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('settings-modal').classList.add('hidden');
}

function saveSettings() {
  const setup = Store.get(KEYS.SETUP) || {};
  const inp = document.getElementById('settings-longest-run');
  const sel = document.getElementById('settings-days-selector');
  const selected = sel ? sel.querySelector('.day-btn.selected') : null;

  const newRun = inp ? parseFloat(inp.value) : setup.longestRun;
  const newDays = selected ? parseInt(selected.dataset.val) : setup.daysPerWeek;

  if (isNaN(newRun) || newRun <= 0) { showToast('Enter a valid distance.'); return; }

  setup.longestRun = Math.round(newRun * 10) / 10;
  setup.daysPerWeek = newDays;
  Store.set(KEYS.SETUP, setup);
  closeSettings();
  showToast('Settings saved');
  renderView(currentView);
}

// ================================================================
// RESET
// ================================================================

function confirmResetAll() {
  const ok = confirm('This will erase ALL data: logs, settings, streaks. Are you sure?');
  if (!ok) return;
  const ok2 = confirm('Last chance. Reset everything and start fresh?');
  if (!ok2) return;
  Object.values(KEYS).forEach(k => Store.remove(k));
  location.reload();
}

// ================================================================
// NUDGE BANNER
// ================================================================

function checkNudge() {
  const banner = document.getElementById('nudge-banner');
  const text   = document.getElementById('nudge-text');
  if (!banner || !text) return;

  const todayDone = isCheckinDone(todayDS());
  if (todayDone) { banner.classList.add('hidden'); return; }

  const now = new Date();
  const hour = now.getHours();
  const streakRisk = calcOverallStreak() >= 3 && hour >= 20;

  if (streakRisk) {
    text.textContent = 'Streak at risk. Check in before midnight.';
    banner.classList.remove('hidden');
  } else if (hour >= 12) {
    text.textContent = "You haven't checked in today yet.";
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

function dismissNudge() {
  const banner = document.getElementById('nudge-banner');
  if (banner) banner.classList.add('hidden');
}

// ================================================================
// TOAST
// ================================================================

function showToast(msg) {
  const t = document.getElementById('freeze-toast');
  const m = document.getElementById('freeze-toast-msg');
  if (!t || !m) return;
  m.innerHTML = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3000);
}

// ================================================================
// ONBOARDING
// ================================================================

let obDaysSelected = 3;

function onboardNext(step) {
  if (step === 1) {
    const val = parseFloat(document.getElementById('ob-longest-run')?.value);
    if (isNaN(val) || val <= 0 || val > 13.1) {
      alert('Please enter a distance between 0.5 and 13 miles.');
      return;
    }
    window._obLongest = val;
    document.getElementById('onboard-step-1').classList.add('hidden');
    document.getElementById('onboard-step-2').classList.remove('hidden');
  } else {
    const sel = document.getElementById('ob-days-selector');
    const chosen = sel ? sel.querySelector('.day-btn.selected') : null;
    const days = chosen ? parseInt(chosen.dataset.val) : 3;

    const setup = {
      longestRun: window._obLongest || 5,
      daysPerWeek: days,
      startDate: todayDS(),
    };
    Store.set(KEYS.SETUP, setup);
    document.getElementById('onboard-screen').classList.add('hidden');
    launchApp();
  }
}

function initDaySelector(selectorId) {
  const sel = document.getElementById(selectorId);
  if (!sel) return;
  sel.querySelectorAll('.day-btn').forEach(btn => {
    btn.onclick = () => {
      sel.querySelectorAll('.day-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    };
  });
}

// ================================================================
// LAUNCH APP
// ================================================================

function launchApp() {
  const app = document.getElementById('app');
  if (!app) return;
  app.classList.remove('hidden');
  showView('home');
  checkNudge();
}

// ================================================================
// INIT
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
  initDaySelector('ob-days-selector');

  if (!Store.get(KEYS.SETUP)) {
    document.getElementById('onboard-screen').classList.remove('hidden');
  } else {
    launchApp();
  }
});

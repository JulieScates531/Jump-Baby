/* Jump Baby – daily chores & sports training tracker.
 * All data is stored on this device (localStorage). Use Parent > Backup to move it.
 */
(function () {
  'use strict';

  const STORE_KEY = 'jumpbaby.v1';
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DOW1 = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
  const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // ---------- helpers ----------
  const uid = () => Math.random().toString(36).slice(2, 9);
  const pad = n => String(n).padStart(2, '0');
  const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dateOf = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const todayKey = () => keyOf(new Date());
  const addDays = (k, n) => { const d = dateOf(k); d.setDate(d.getDate() + n); return keyOf(d); };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtMin = m => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  const fmtClock = ms => {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return (h ? h + ':' + pad(m) : m) + ':' + pad(sec);
  };

  // Weeks start on Monday.
  const weekStart = k => addDays(k, -((dateOf(k).getDay() + 6) % 7));
  const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];
  const DRILL_IDEAS = {
    soccer: 'Juggling, wall passes (both feet), dribbling through cones',
    baseball: 'Tee swings, throwing & catching, ground balls',
    basketball: 'Ball-handling drills, free throws, layups (both hands)',
  };
  const blankSportWeek = (goal, id) => ({ practice: [], home: ALL_DAYS.slice(), goal: goal == null ? 15 : goal, drills: DRILL_IDEAS[id] || '' });
  // Current team schedule: soccer Mon/Wed/Sat now, Mon/Tue from the week of Dec 7, 2026.
  function starterWeeks(goals) {
    const thisWeek = weekStart(todayKey());
    const first = thisWeek < '2026-11-09' ? thisWeek : '2026-11-09';
    const wk = {};
    Object.keys(goals).forEach(id => { wk[id] = blankSportWeek(goals[id], id); });
    if (wk.soccer) wk.soccer.practice = [1, 3, 6];
    const weeks = { [first]: wk };
    const dec7 = '2026-12-07';
    if (wk.soccer) {
      const next = JSON.parse(JSON.stringify(wk));
      next.soccer.practice = [1, 2];
      weeks[dec7] = next;
    }
    return weeks;
  }

  // ---------- default data ----------
  function defaults() {
    return {
      version: 3,
      kidName: '',
      pin: '',
      points: { chores: 10, training: 10, perfectDay: 5, extra: 2 },
      chores: [
        { id: uid(), name: 'Make my bed', days: ALL_DAYS.slice() },
        { id: uid(), name: 'Brush teeth (morning & night)', days: ALL_DAYS.slice() },
        { id: uid(), name: 'Put dirty clothes in hamper', days: ALL_DAYS.slice() },
        { id: uid(), name: 'Clear my dishes', days: ALL_DAYS.slice() },
        { id: uid(), name: 'Homework / reading', days: [1, 2, 3, 4, 5] },
        { id: uid(), name: 'Pack my sports bag', days: [1, 2, 3, 4, 5] },
        { id: uid(), name: 'Tidy my room', days: [6] },
      ],
      sports: [
        { id: 'soccer', name: 'Soccer', emoji: '⚽', months: ALL_MONTHS.slice() },
        { id: 'baseball', name: 'Baseball', emoji: '⚾', months: ALL_MONTHS.slice() },
        { id: 'basketball', name: 'Basketball', emoji: '🏀', months: [12, 1, 2] },
      ],
      // Weekly training plans, keyed by the Monday a plan starts. A plan stays in
      // effect for every following week until a later week has its own plan.
      // weeks[monday][sportId] = { practice:[dow], home:[dow], goal:min, drills:'' }
      weeks: starterWeeks({ soccer: 20, baseball: 20, basketball: 20 }),
      rewards: [
        { id: uid(), name: '30 min extra screen time', cost: 30 },
        { id: uid(), name: 'Pick dinner', cost: 50 },
        { id: uid(), name: 'Ice cream trip', cost: 75 },
        { id: uid(), name: 'Stay up 30 min late', cost: 60 },
        { id: uid(), name: 'New sports gear', cost: 300 },
      ],
      days: {},          // 'YYYY-MM-DD' -> { plan:{chores:[id], sports:[{id,goal,practice,drills}]}, chores:{id:true}, practice:{sportId:true}, sessions:[{id,sport,min,ts}] }
      redemptions: [],   // {id, name, cost, date}
      timer: null,       // {sport, start, day}
      celebrated: {},    // 'YYYY-MM-DD' -> {chores:bool, training:bool}
    };
  }

  // ---------- storage ----------
  let state;
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      state = raw ? Object.assign(defaults(), JSON.parse(raw)) : defaults();
    } catch (e) {
      state = defaults();
    }
    migrate();
    if (state.points.extra == null) state.points.extra = 2;
  }
  // v2: soccer and baseball became year-round goals. Only update them if the
  // parent hasn't customized their seasons.
  function migrate() {
    if ((state.version || 1) < 2) {
      const oldSeasons = { soccer: '3,4,5,6,8,9,10,11', baseball: '3,4,5,6,7' };
      state.sports.forEach(s => {
        if (oldSeasons[s.id] && s.months.join(',') === oldSeasons[s.id]) s.months = ALL_MONTHS.slice();
      });
      state.version = 2;
    }
    // v3: weekly plans with team practice days; karate is no longer tracked.
    if (state.version < 3) {
      const goals = {};
      state.sports = state.sports.filter(s => s.id !== 'karate');
      state.sports.forEach(s => { goals[s.id] = s.goal == null ? 15 : s.goal; });
      state.weeks = starterWeeks(goals);
      Object.values(state.weeks).forEach(wk => state.sports.forEach(s => {
        if (s.days) wk[s.id].home = s.days.slice();
      }));
      state.sports.forEach(s => { delete s.goal; delete s.days; });
      if (state.timer && state.timer.sport === 'karate') state.timer = null;
      state.version = 3;
      refreshTodayPlan();
      save();
    }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { toast('Could not save on this device!'); }
  }

  // ---------- plan / scoring ----------
  // The plan in effect for the week containing day k (latest plan starting on/before it).
  function weekPlanKey(k) {
    const ws = weekStart(k);
    const keys = Object.keys(state.weeks).sort();
    let found = keys[0];
    keys.forEach(x => { if (x <= ws) found = x; });
    return found;
  }
  function sportWeek(k, sportId) {
    const key = weekPlanKey(k);
    return (key && state.weeks[key][sportId]) || blankSportWeek(15, sportId);
  }
  // Give week ws its own editable plan (copied from whatever was in effect).
  function ensureWeek(ws) {
    if (!state.weeks[ws]) {
      const src = {};
      state.sports.forEach(s => { src[s.id] = sportWeek(ws, s.id); });
      state.weeks[ws] = JSON.parse(JSON.stringify(src));
    }
    state.sports.forEach(s => { if (!state.weeks[ws][s.id]) state.weeks[ws][s.id] = blankSportWeek(15, s.id); });
    return state.weeks[ws];
  }
  function planFor(k) {
    const d = dateOf(k), dow = d.getDay(), month = d.getMonth() + 1;
    const sports = [];
    state.sports.filter(s => s.months.includes(month)).forEach(s => {
      const w = sportWeek(k, s.id);
      // Team practice outside the house replaces that sport's home goal for the day.
      if (w.practice.includes(dow)) sports.push({ id: s.id, practice: true, goal: 0 });
      else if (w.goal > 0 && w.home.includes(dow)) sports.push({ id: s.id, goal: w.goal, drills: w.drills || '' });
    });
    return { chores: state.chores.filter(c => c.days.includes(dow)).map(c => c.id), sports };
  }
  // Extra training earns bonus points: each extra session of 10+ minutes, up to
  // EXTRA_MAX per day. Time on a sport that already has a home goal that day just
  // counts toward that goal (no double points).
  const EXTRA_MAX = 3, EXTRA_MIN = 10;
  function extraPointSessions(k, plan) {
    const d = state.days[k];
    if (!d) return [];
    plan = plan || d.plan;
    const homeGoal = new Set(plan.sports.filter(p => !p.practice).map(p => p.id));
    return d.sessions.filter(x => x.extra && x.min >= EXTRA_MIN && !homeGoal.has(x.sport)).slice(0, EXTRA_MAX);
  }
  const sessionLabel = x => x.label || sportById(x.sport).name;
  const sessionEmoji = x => x.sport === 'other' ? '🏅' : sportById(x.sport).emoji;

  function sportMet(k, p) {
    const d = state.days[k];
    if (p.practice) return !!(d && d.practice && d.practice[p.id]);
    return minutes(k, p.id) >= p.goal;
  }
  // Each day keeps a snapshot of its plan so changing settings later doesn't rewrite history.
  function day(k, create) {
    let d = state.days[k];
    if (!d && create) {
      d = state.days[k] = { plan: planFor(k), chores: {}, sessions: [] };
    }
    return d;
  }
  // Today's (and future) plans follow the latest settings.
  function refreshTodayPlan() {
    const k = todayKey();
    if (state.days[k]) state.days[k].plan = planFor(k);
  }
  const choreName = id => (state.chores.find(c => c.id === id) || {}).name || '(removed chore)';
  const sportById = id => state.sports.find(s => s.id === id) || { id, name: id === 'other' ? 'Other' : id.charAt(0).toUpperCase() + id.slice(1), emoji: '🏅' };
  function minutes(k, sportId) {
    const d = state.days[k];
    if (!d) return 0;
    return d.sessions.filter(s => s.sport === sportId).reduce((a, s) => a + s.min, 0);
  }
  function status(k) {
    const d = state.days[k];
    const plan = d ? d.plan : planFor(k);
    const choresDoneCount = d ? plan.chores.filter(id => d.chores[id]).length : 0;
    const sportsDoneCount = plan.sports.filter(p => sportMet(k, p)).length;
    const choresDone = plan.chores.length > 0 && choresDoneCount === plan.chores.length;
    const trainingDone = plan.sports.length > 0 && sportsDoneCount === plan.sports.length;
    let pts = 0;
    if (choresDone) pts += state.points.chores;
    if (trainingDone) pts += state.points.training;
    if (choresDone && trainingDone) pts += state.points.perfectDay;
    const extraCount = extraPointSessions(k, plan).length;
    pts += extraCount * state.points.extra;
    const totalMin = d ? d.sessions.reduce((a, s) => a + s.min, 0) : 0;
    return { plan, choresDoneCount, sportsDoneCount, choresDone, trainingDone, pts, totalMin, extraCount };
  }
  function totalEarned() {
    return Object.keys(state.days).reduce((a, k) => a + status(k).pts, 0);
  }
  function balance() {
    return totalEarned() - state.redemptions.reduce((a, r) => a + r.cost, 0);
  }
  // Streak of consecutive days that hit 100%. Days with nothing scheduled are skipped.
  // Today only counts once it's done (so an unfinished today doesn't break the streak).
  function streak(kind) {
    let k = todayKey(), n = 0;
    for (let i = 0; i < 400; i++, k = addDays(k, -1)) {
      const st = status(k);
      const planned = kind === 'chores' ? st.plan.chores.length : st.plan.sports.length;
      const done = kind === 'chores' ? st.choresDone : st.trainingDone;
      if (!planned) continue;
      if (done) n++;
      else if (i === 0) continue;
      else break;
    }
    return n;
  }

  // ---------- ui state ----------
  let tab = 'today';
  let viewDay = todayKey();
  let parentUnlocked = false;
  let parentWeek = weekStart(todayKey());
  let timerTick = null;

  const $view = document.getElementById('view');
  const canEdit = k => parentUnlocked || k === todayKey() || k === addDays(todayKey(), -1);

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.hidden = true; }, 2600);
  }
  function celebrate(emojis) {
    const box = document.getElementById('celebrate');
    for (let i = 0; i < 40; i++) {
      const s = document.createElement('span');
      s.textContent = emojis[i % emojis.length];
      s.style.left = Math.random() * 100 + 'vw';
      s.style.animationDelay = Math.random() * 0.8 + 's';
      box.appendChild(s);
      setTimeout(() => s.remove(), 3200);
    }
  }
  // Fire a celebration the first time a day reaches 100%.
  function checkCelebrate(k) {
    const st = status(k);
    const c = state.celebrated[k] || (state.celebrated[k] = {});
    const name = state.kidName ? state.kidName + ', ' : '';
    if (st.choresDone && !c.chores) {
      c.chores = true;
      celebrate(['⭐', '🎉', '✅', '🌟']);
      toast(`${name}all chores done! +${state.points.chores} points`);
    }
    if (st.trainingDone && !c.training) {
      c.training = true;
      celebrate(['🏆', '⚽', '⚾', '🥋', '🏀', '💪']);
      toast(`${name}training goals smashed! +${state.points.training} points`);
    }
    if (st.choresDone && st.trainingDone && !c.perfect) {
      c.perfect = true;
      setTimeout(() => toast(`PERFECT DAY! Bonus +${state.points.perfectDay} 🏆`), 2700);
    }
    save();
  }

  function render() {
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.getElementById('pointsBalance').textContent = balance();
    document.getElementById('title').textContent = state.kidName ? `${state.kidName}'s Day` : 'My Day';
    clearInterval(timerTick); timerTick = null;
    ({ today: renderToday, rewards: renderRewards, history: renderHistory, parent: renderParent })[tab]();
  }

  // ---------- TODAY ----------
  function renderToday() {
    const k = viewDay;
    const isToday = k === todayKey();
    if (canEdit(k)) day(k, true);
    const st = status(k);
    const d = state.days[k];
    const editable = canEdit(k);
    const dt = dateOf(k);
    const label = isToday ? 'Today' : k === addDays(todayKey(), -1) ? 'Yesterday' : DOW[dt.getDay()];

    let html = `
      <div class="datebar">
        <button class="iconbtn" data-act="prev" aria-label="Previous day">‹</button>
        <div class="date">${label}<small>${dt.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</small></div>
        <button class="iconbtn" data-act="next" aria-label="Next day" ${isToday ? 'disabled' : ''}>›</button>
      </div>
      <div class="summary">
        <div class="stat ${st.choresDone ? 'done' : ''}">
          <div class="label">Chores</div>
          <div class="value">${st.choresDoneCount}/${st.plan.chores.length} ${st.choresDone ? '✅' : ''}</div>
          <div class="label">🔥 ${streak('chores')} day streak</div>
        </div>
        <div class="stat ${st.trainingDone ? 'done' : ''}">
          <div class="label">Training goals</div>
          <div class="value">${st.sportsDoneCount}/${st.plan.sports.length} ${st.trainingDone ? '🏆' : ''}</div>
          <div class="label">🔥 ${streak('training')} day streak</div>
        </div>
      </div>`;

    if (!editable) html += `<p class="muted small">This day is locked. A parent can unlock it in the Parent tab to make changes.</p>`;

    // Chores
    const pct = st.plan.chores.length ? Math.round(st.choresDoneCount / st.plan.chores.length * 100) : 0;
    html += `<section class="card"><h2>🧹 Chores <span class="right">${pct}%</span></h2>
      <div class="progress ${st.choresDone ? 'done' : ''}"><div style="width:${pct}%"></div></div>`;
    if (!st.plan.chores.length) html += `<div class="empty">No chores today. Enjoy! 🎈</div>`;
    st.plan.chores.forEach(id => {
      const on = d && d.chores[id];
      html += `<button class="chore ${on ? 'checked' : ''}" data-act="chore" data-id="${id}" ${editable ? '' : 'disabled'}>
        <span class="box">${on ? '✓' : ''}</span><span class="name">${esc(choreName(id))}</span></button>`;
    });
    if (st.plan.chores.length) {
      html += st.choresDone
        ? `<div class="banner">🌟 100% done! You earned ${state.points.chores} points!</div>`
        : `<div class="banner pending">Finish all ${st.plan.chores.length} chores to earn ${state.points.chores} points ⭐</div>`;
    }
    html += `</section>`;

    // Training
    const planned = st.plan.sports;
    html += `<section class="card"><h2>🏅 Training <span class="right">${fmtMin(st.totalMin)} today</span></h2>`;
    if (!planned.length) html += `<div class="empty">No training goals today.</div>`;
    planned.forEach(p => { html += p.practice ? practiceCard(k, sportById(p.id), editable) : sportCard(k, sportById(p.id), p.goal, editable, p.drills); });
    if (planned.length) {
      html += st.trainingDone
        ? `<div class="banner">🏆 All training goals met! You earned ${state.points.training} points!</div>`
        : `<div class="banner pending">Hit every training goal to earn ${state.points.training} points 💪</div>`;
      html += `<p class="muted small" style="text-align:center;margin:8px 0 0">Do 100% of chores <b>and</b> training for a +${state.points.perfectDay} Perfect Day bonus!</p>`;
    }
    html += `</section>`;
    html += extraHtml(k, st, editable);

    $view.innerHTML = html;
    if (state.timer) startTick();
  }

  // ---------- extra (unscheduled) training, logged by him ----------
  let extraOpen = false;
  let extraForm = { sport: '', label: '', min: 0, note: '' };
  function extraHtml(k, st, editable) {
    const d = state.days[k];
    const list = d ? d.sessions.filter(x => x.extra) : [];
    const earned = extraPointSessions(k).map(x => x.id);
    const t = state.timer && state.timer.extra ? state.timer : null;
    let h = `<section class="card"><h2>🚀 Extra training <span class="right">${fmtMin(list.reduce((a, x) => a + x.min, 0))}</span></h2>
      <p class="muted small" style="margin-top:0">Trained on your own? Log it! Each extra session of ${EXTRA_MIN}+ min earns <b>+${state.points.extra}</b> bonus points (up to ${EXTRA_MAX} a day).</p>`;
    if (t) {
      h += `<div class="sport"><div class="sport-head"><span class="emoji">${esc(t.sport === 'other' ? '🏅' : sportById(t.sport).emoji)}</span>
        <span class="name">${esc(t.label || sportById(t.sport).name)}</span></div>
        ${t.note ? `<div class="drills">${esc(t.note)}</div>` : ''}
        <div class="timer" id="timerClock">0:00</div>
        <div class="actions"><button class="btn stop" data-act="stop">⏹ Stop &amp; save</button><button class="btn" data-act="cancelTimer">Cancel</button></div></div>`;
    } else if (editable && !extraOpen) {
      h += `<button class="btn primary" style="width:100%" data-act="extraOpen">➕ Log extra training</button>`;
    } else if (editable) {
      const f = extraForm;
      const sportChips = state.sports.map(sp => `<button class="chip ${f.sport === sp.id ? 'on' : ''}" data-act="exSport" data-v="${sp.id}">${esc(sp.emoji)} ${esc(sp.name)}</button>`).join('')
        + `<button class="chip ${f.sport === 'other' ? 'on' : ''}" data-act="exSport" data-v="other">🏅 Other…</button>`;
      const minChips = [10, 15, 20, 30, 45, 60].map(m => `<button class="chip ${f.min === m ? 'on' : ''}" data-act="exMin" data-v="${m}">${m} min</button>`).join('');
      const goalToday = f.sport && st.plan.sports.some(p => p.id === f.sport && !p.practice);
      h += `<div class="editor-item">
        <div class="field"><label>1. What sport?</label><div class="chips" style="margin:0">${sportChips}</div></div>
        ${f.sport === 'other' ? `<div class="field"><input type="text" id="exLabel" data-ex="label" value="${esc(f.label)}" placeholder="What did you do? (e.g. running, swimming)"></div>` : ''}
        ${goalToday ? `<p class="muted small" style="margin:0 0 10px">This time will count toward today's ${esc(sportById(f.sport).name)} goal.</p>` : ''}
        <div class="field"><label>2. What did you work on? (optional)</label><input type="text" data-ex="note" value="${esc(f.note)}" placeholder="e.g. 100 juggles, shooting drills"></div>
        <div class="field"><label>3. How long?</label><div class="chips" style="margin:0">${minChips}</div>
          <div class="row" style="margin-top:6px"><input type="number" class="num" min="1" max="600" data-ex="min" value="${f.min || ''}" placeholder="min"><span class="muted small">minutes, or use a timer</span></div></div>
        <div class="actions">
          <button class="btn good" data-act="exSave">✓ Save</button>
          <button class="btn primary" data-act="exTimer" ${k !== todayKey() || state.timer ? 'disabled' : ''}>▶ Start timer</button>
          <button class="btn" data-act="exCancel">Cancel</button>
        </div></div>`;
    }
    if (list.length) {
      h += `<ul class="sessions" style="font-size:.95rem;color:inherit">${list.map(x => `<li><span>${esc(sessionEmoji(x))} <b>${esc(sessionLabel(x))}</b> · ${x.min} min${x.note && x.note !== 'timer' ? ' · ' + esc(x.note) : ''}${earned.includes(x.id) ? ` <span class="tag">+${state.points.extra} ⭐</span>` : ''}</span>
        ${editable ? `<button data-act="delSession" data-id="${x.id}" aria-label="Remove">✕</button>` : ''}</li>`).join('')}</ul>`;
    } else if (!editable) h += `<div class="empty">No extra training this day.</div>`;
    return h + `</section>`;
  }
  // Validates the extra form; returns the activity or null (with a toast).
  function readExtraForm() {
    const f = extraForm;
    if (!f.sport) { toast('Pick a sport first'); return null; }
    if (f.sport === 'other' && !f.label.trim()) { toast('Type what you did'); return null; }
    return { sport: f.sport, label: f.sport === 'other' ? f.label.trim() : '', note: f.note.trim() };
  }

  // Team practice outside the house: checking it off meets that sport's goal for the day.
  function practiceCard(k, s, editable) {
    const d = state.days[k];
    const went = !!(d && d.practice && d.practice[s.id]);
    return `<div class="sport ${went ? 'done' : ''}">
      <div class="sport-head"><span class="emoji">${esc(s.emoji)}</span>
        <span class="name">${esc(s.name)} team practice ${went ? '✅' : ''}</span></div>
      <p class="muted small" style="margin:6px 0">No home ${esc(s.name.toLowerCase())} training today. Going to practice counts as your goal!</p>
      <button class="chore ${went ? 'checked' : ''}" data-act="practice" data-id="${s.id}" ${editable ? '' : 'disabled'} style="margin:0">
        <span class="box">${went ? '✓' : ''}</span><span>I went to ${esc(s.name.toLowerCase())} practice</span></button>
    </div>`;
  }

  function sportCard(k, s, goal, editable, drills) {
    const m = minutes(k, s.id);
    const done = goal > 0 && m >= goal;
    const pct = goal ? Math.min(100, Math.round(m / goal * 100)) : 0;
    const running = state.timer && !state.timer.extra && state.timer.sport === s.id;
    const otherRunning = state.timer && !running;
    const sessions = (state.days[k] ? state.days[k].sessions : []).filter(x => x.sport === s.id);
    return `<div class="sport ${done ? 'done' : ''}">
      <div class="sport-head"><span class="emoji">${esc(s.emoji)}</span>
        <span class="name">${esc(s.name)} ${done ? '✅' : ''}</span>
        <span class="mins">${goal ? `${m} / ${goal} min` : `${m} min`}</span></div>
      ${goal ? `<div class="progress ${done ? 'done' : ''}"><div style="width:${pct}%"></div></div>` : ''}
      ${drills ? `<div class="drills"><b>📋 Drills:</b> ${esc(drills)}</div>` : ''}
      ${running ? `<div class="timer" id="timerClock">0:00</div>` : ''}
      ${editable ? `<div class="actions">
        ${running
          ? `<button class="btn stop" data-act="stop">⏹ Stop &amp; save</button><button class="btn" data-act="cancelTimer">Cancel</button>`
          : `<button class="btn primary" data-act="start" data-sport="${s.id}" ${otherRunning || k !== todayKey() ? 'disabled' : ''}>▶ Start timer</button>`}
        <button class="btn" data-act="add" data-sport="${s.id}" data-min="5">+5</button>
        <button class="btn" data-act="add" data-sport="${s.id}" data-min="15">+15</button>
        <button class="btn" data-act="addCustom" data-sport="${s.id}">+ min…</button>
      </div>` : ''}
      ${sessions.length ? `<ul class="sessions">${sessions.map(x => `<li><span>${new Date(x.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${x.min} min${x.extra ? ' · extra' : ''}${x.note && x.note !== 'timer' ? ' · ' + esc(x.note) : ''}</span>
        ${editable ? `<button data-act="delSession" data-id="${x.id}" aria-label="Remove">✕</button>` : ''}</li>`).join('')}</ul>` : ''}
    </div>`;
  }

  function startTick() {
    const update = () => {
      const el = document.getElementById('timerClock');
      if (el && state.timer) el.textContent = fmtClock(Date.now() - state.timer.start);
    };
    update();
    timerTick = setInterval(update, 1000);
  }

  function addSession(k, sport, min, note, extra) {
    if (!(min > 0)) return;
    const before = extraPointSessions(k).length;
    const x = { id: uid(), sport, min: Math.round(min), ts: Date.now(), note: note || '' };
    if (extra) { x.extra = true; if (extra.label) x.label = extra.label; }
    day(k, true).sessions.push(x);
    save();
    if (extra && extraPointSessions(k).length > before) {
      celebrate(['🚀', '⭐', '💪']);
      toast(`Awesome extra work! +${state.points.extra} bonus points`);
    }
    checkCelebrate(k);
  }

  // ---------- REWARDS ----------
  function renderRewards() {
    const bal = balance();
    let html = `<section class="card" style="text-align:center">
      <div class="muted">Points to spend</div>
      <div style="font-size:3rem;font-weight:800">⭐ ${bal}</div>
      <div class="muted small">Earned all-time: ${totalEarned()} · Spent: ${totalEarned() - bal}</div>
    </section>
    <section class="card"><h2>🎁 Reward shop</h2>`;
    if (!state.rewards.length) html += `<div class="empty">No rewards yet. A parent can add some in the Parent tab.</div>`;
    state.rewards.slice().sort((a, b) => a.cost - b.cost).forEach(r => {
      const can = bal >= r.cost;
      html += `<div class="reward"><div class="grow"><div class="name">${esc(r.name)}</div>
        <div class="bar">${can ? 'You can get this!' : `${r.cost - bal} more points to go`}</div>
        <div class="progress ${can ? 'done' : ''}"><div style="width:${Math.min(100, Math.round(bal / r.cost * 100))}%"></div></div></div>
        <div class="cost">⭐ ${r.cost}</div>
        <button class="btn ${can ? 'good' : ''}" data-act="redeem" data-id="${r.id}" ${can ? '' : 'disabled'}>Get it</button></div>`;
    });
    html += `</section><section class="card"><h2>🧾 Rewards I got</h2>`;
    if (!state.redemptions.length) html += `<div class="empty">Nothing yet. Keep going! 💪</div>`;
    else html += `<table><tr><th>Date</th><th>Reward</th><th class="c">Points</th></tr>
      ${state.redemptions.slice().reverse().map(r => `<tr><td>${dateOf(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td><td>${esc(r.name)}</td><td class="c">${r.cost > 0 ? '-' + r.cost : '+' + (-r.cost)}</td></tr>`).join('')}</table>`;
    html += `</section>
    <section class="card"><h2>How to earn points</h2>
      <p>✅ 100% of chores in a day: <b>+${state.points.chores}</b></p>
      <p>🏅 Every training goal in a day: <b>+${state.points.training}</b></p>
      <p>🏆 Both on the same day (Perfect Day): <b>+${state.points.perfectDay}</b> bonus</p>
      <p>🚀 Extra training on your own (${EXTRA_MIN}+ min, up to ${EXTRA_MAX} a day): <b>+${state.points.extra}</b> each</p>
    </section>`;
    $view.innerHTML = html;
  }

  // ---------- HISTORY ----------
  function renderHistory() {
    const t = todayKey();
    // This week (Sunday start) totals per sport
    const start = weekStart(t);
    const weekTotals = {};
    let weekPts = 0, weekChoreDays = 0, weekTrainDays = 0, weekExtraMin = 0, weekExtraN = 0, otherMin = 0;
    for (let k = start; k <= t; k = addDays(k, 1)) {
      const st = status(k);
      weekPts += st.pts;
      if (st.choresDone) weekChoreDays++;
      if (st.trainingDone) weekTrainDays++;
      state.sports.forEach(s => { weekTotals[s.id] = (weekTotals[s.id] || 0) + minutes(k, s.id); });
      otherMin += minutes(k, 'other');
      (state.days[k] ? state.days[k].sessions : []).forEach(x => { if (x.extra) { weekExtraMin += x.min; weekExtraN++; } });
    }
    if (otherMin) weekTotals.other = otherMin;
    // His extra-training log: most recent first, last 60 days.
    const log = [];
    for (let i = 0; i < 60; i++) {
      const k = addDays(t, -i);
      (state.days[k] ? state.days[k].sessions : []).filter(x => x.extra).slice().reverse().forEach(x => log.push([k, x]));
    }
    const longest = log.reduce((a, [, x]) => Math.max(a, x.min), 0);
    let html = `<section class="card"><h2>📊 This week</h2>
      <div class="summary">
        <div class="stat"><div class="label">Points earned</div><div class="value">⭐ ${weekPts}</div></div>
        <div class="stat"><div class="label">100% chore days</div><div class="value">${weekChoreDays}</div></div>
        <div class="stat"><div class="label">Training goal days</div><div class="value">${weekTrainDays}</div></div>
        <div class="stat"><div class="label">Total training</div><div class="value">${fmtMin(Object.values(weekTotals).reduce((a, b) => a + b, 0))}</div></div>
        <div class="stat"><div class="label">Extra sessions</div><div class="value">🚀 ${weekExtraN}</div></div>
        <div class="stat"><div class="label">Extra training time</div><div class="value">${fmtMin(weekExtraMin)}</div></div>
      </div>
      <table><tr><th>Sport</th><th class="c">Minutes this week</th></tr>
      ${state.sports.map(s => `<tr><td>${esc(s.emoji)} ${esc(s.name)}</td><td class="c">${fmtMin(weekTotals[s.id] || 0)}</td></tr>`).join('')}
      ${otherMin ? `<tr><td>🏅 Other</td><td class="c">${fmtMin(otherMin)}</td></tr>` : ''}</table>
    </section>
    <section class="card"><h2>🚀 My extra training log</h2>
      ${log.length ? `<p class="muted small" style="margin-top:0">${log.length} sessions · ${fmtMin(log.reduce((a, [, x]) => a + x.min, 0))} total · longest ${fmtMin(longest)} (last 60 days)</p>
      <table><tr><th>Day</th><th>Training</th><th class="c">Min</th></tr>
      ${log.slice(0, 40).map(([k, x]) => { const dt = dateOf(k); return `<tr class="clickable" data-act="goto" data-day="${k}"><td>${DOW[dt.getDay()]} ${dt.getMonth() + 1}/${dt.getDate()}</td>
        <td>${esc(sessionEmoji(x))} ${esc(sessionLabel(x))}${x.note ? `<div class="muted small">${esc(x.note)}</div>` : ''}</td><td class="c">${x.min}</td></tr>`; }).join('')}</table>`
      : `<div class="empty">No extra training yet. Tap "Log extra training" on the Today screen!</div>`}
    </section>
    <section class="card"><h2>📅 Last 30 days</h2>
      <p class="muted small">Tap a day to see it.</p>
      <table><tr><th>Day</th><th class="c">Chores</th><th class="c">Training</th><th class="c">Min</th><th class="c">⭐</th></tr>`;
    for (let i = 0; i < 30; i++) {
      const k = addDays(t, -i), st = status(k), dt = dateOf(k);
      const cell = (done, n, total) => total ? (done ? '✅' : `${n}/${total}`) : '–';
      html += `<tr class="clickable" data-act="goto" data-day="${k}">
        <td>${DOW[dt.getDay()]} ${dt.getMonth() + 1}/${dt.getDate()}</td>
        <td class="c">${cell(st.choresDone, st.choresDoneCount, st.plan.chores.length)}</td>
        <td class="c">${cell(st.trainingDone, st.sportsDoneCount, st.plan.sports.length)}</td>
        <td class="c">${st.totalMin || ''}</td>
        <td class="c">${st.pts || ''}</td></tr>`;
    }
    html += `</table></section>`;
    $view.innerHTML = html;
  }

  // ---------- PARENT ----------
  function renderParent() {
    if (state.pin && !parentUnlocked) {
      $view.innerHTML = `<section class="card lock"><h2 style="justify-content:center">🔒 Parent area</h2>
        <p class="muted">Enter the parent PIN</p>
        <input type="password" inputmode="numeric" id="pinIn" autocomplete="off">
        <button class="btn primary" data-act="unlock">Unlock</button></section>`;
      const inp = document.getElementById('pinIn');
      inp.focus();
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') unlock(); });
      return;
    }
    const chips = (arr, all, labels, attr, id) => `<div class="chips">${all.map((v, i) =>
      `<button class="chip ${arr.includes(v) ? 'on' : ''}" data-act="${attr}" data-id="${id}" data-v="${v}">${labels[i]}</button>`).join('')}</div>`;

    let html = `
    <section class="card"><h2>👤 Basics</h2>
      <div class="field"><label>Child's name</label><input type="text" data-set="kidName" value="${esc(state.kidName)}" placeholder="e.g. Max"></div>
      <div class="field"><label>Parent PIN (keeps settings & reward approvals locked; leave blank for none)</label>
        <div class="row"><input type="password" inputmode="numeric" id="newPin" placeholder="${state.pin ? '•••• (set)' : 'No PIN set'}">
        <button class="btn" data-act="setPin">Save PIN</button></div></div>
      ${parentUnlocked && state.pin ? `<button class="btn" data-act="lock">🔒 Lock parent area</button>` : ''}
    </section>

    ${weeklyPlanHtml(chips)}

    <section class="card"><h2>⭐ Points</h2>
      <div class="row">
        <div class="field grow"><label>100% chores</label><input type="number" min="0" data-points="chores" value="${state.points.chores}"></div>
        <div class="field grow"><label>All training goals</label><input type="number" min="0" data-points="training" value="${state.points.training}"></div>
        <div class="field grow"><label>Perfect day bonus</label><input type="number" min="0" data-points="perfectDay" value="${state.points.perfectDay}"></div>
        <div class="field grow"><label>Each extra training</label><input type="number" min="0" data-points="extra" value="${state.points.extra}"></div>
      </div>
      <p class="muted small">Points are only earned when 100% of a day's chores (or training goals) are finished.</p>
    </section>

    <section class="card"><h2>🧹 Chores</h2>
      <p class="muted small">Pick which days each chore shows up.</p>
      ${state.chores.map(c => `<div class="editor-item">
        <div class="row"><input type="text" class="grow" data-chore-name="${c.id}" value="${esc(c.name)}">
        <button class="btn danger" data-act="delChore" data-id="${c.id}" aria-label="Delete">🗑</button></div>
        ${chips(c.days, ALL_DAYS, DOW1, 'choreDay', c.id)}</div>`).join('')}
      <div class="row"><input type="text" class="grow" id="newChore" placeholder="New chore…"><button class="btn primary" data-act="addChore">Add</button></div>
    </section>

    <section class="card"><h2>🏅 Sports & seasons</h2>
      <p class="muted small">Pick the months each sport is in season. Out-of-season sports have no goals but can still be logged as extra practice.</p>
      ${state.sports.map(s => `<div class="editor-item">
        <div class="row">
          <input type="text" class="emoji-in" data-sport-field="emoji" data-id="${s.id}" value="${esc(s.emoji)}" aria-label="Emoji">
          <input type="text" class="grow" data-sport-field="name" data-id="${s.id}" value="${esc(s.name)}" aria-label="Sport name">
          <button class="btn danger" data-act="delSport" data-id="${s.id}" aria-label="Delete">🗑</button>
        </div>
        <div class="muted small" style="margin-top:8px">In season</div>${chips(s.months, ALL_MONTHS, MONTHS, 'sportMonth', s.id)}
      </div>`).join('')}
      <div class="row"><input type="text" class="grow" id="newSport" placeholder="New sport…"><button class="btn primary" data-act="addSport">Add</button></div>
    </section>

    <section class="card"><h2>🎁 Rewards</h2>
      ${state.rewards.map(r => `<div class="editor-item"><div class="row">
        <input type="text" class="grow" data-reward-field="name" data-id="${r.id}" value="${esc(r.name)}">
        <input type="number" class="num" min="1" data-reward-field="cost" data-id="${r.id}" value="${r.cost}" aria-label="Cost">
        <span class="muted small">pts</span>
        <button class="btn danger" data-act="delReward" data-id="${r.id}" aria-label="Delete">🗑</button></div></div>`).join('')}
      <div class="row"><input type="text" class="grow" id="newReward" placeholder="New reward…">
      <input type="number" class="num" id="newRewardCost" placeholder="pts" min="1"><button class="btn primary" data-act="addReward">Add</button></div>
    </section>

    <section class="card"><h2>🎯 Adjust points</h2>
      <p class="muted small">Give bonus points or take some away (e.g. a reward given outside the app).</p>
      <div class="row"><input type="text" class="grow" id="adjNote" placeholder="Reason (e.g. Helped a neighbor)">
      <input type="number" class="num" id="adjPts" placeholder="+/-"><button class="btn primary" data-act="adjust">Apply</button></div>
    </section>

    <section class="card"><h2>💾 Backup</h2>
      <p class="muted small">Data is saved on this device only. Download a backup to keep it safe or move it to another phone/tablet.</p>
      <div class="actions">
        <button class="btn" data-act="export">⬇ Download backup</button>
        <label class="btn">⬆ Restore backup<input type="file" id="importFile" accept="application/json" hidden></label>
        <button class="btn danger" data-act="reset">Reset everything</button>
      </div>
    </section>`;
    $view.innerHTML = html;
  }

  function weeklyPlanHtml(chips) {
    const ws = parentWeek;
    const own = !!state.weeks[ws];
    const keys = Object.keys(state.weeks).sort();
    const srcKey = weekPlanKey(ws);
    const short = k => dateOf(k).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const monthsThisWeek = new Set([0, 6].map(i => dateOf(addDays(ws, i)).getMonth() + 1));
    const dayChips = (arr, act, id) => chips(arr, MON_FIRST, MON_FIRST.map(d => DOW[d].slice(0, 2)), act, id);
    return `<section class="card"><h2>📅 Weekly training plan</h2>
      <div class="weeknav">
        <button class="iconbtn" data-act="weekPrev" aria-label="Previous week">‹</button>
        <div class="date">Week of ${dateOf(ws).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          <small>${short(ws)} – ${short(addDays(ws, 6))}${ws === weekStart(todayKey()) ? ' · this week' : ''}</small></div>
        <button class="iconbtn" data-act="weekNext" aria-label="Next week">›</button>
      </div>
      <p style="text-align:center;margin:4px 0 10px">${own ? '<span class="tag">This week has its own plan</span>'
        : `<span class="muted small">Using the plan from the week of ${short(srcKey)}. Any change here starts a new plan from this week.</span>`}</p>
      <p class="muted small">On a <b>team practice</b> day, going to practice counts as that sport's goal, so there's no home training for it. Changes carry forward to later weeks until a week that has its own plan.</p>
      ${state.sports.map(s => {
        const w = sportWeek(ws, s.id);
        const inSeason = s.months.some(m => monthsThisWeek.has(m));
        return `<div class="editor-item">
          <div class="row"><span style="font-size:1.4rem">${esc(s.emoji)}</span><b class="grow">${esc(s.name)}</b>
            ${inSeason ? '' : '<span class="tag">off-season</span>'}</div>
          <div class="muted small" style="margin-top:8px">🏟 Team practice days (outside the house)</div>${dayChips(w.practice, 'wkPractice', s.id)}
          <div class="muted small" style="margin-top:8px">🏠 Home training days</div>${dayChips(w.home, 'wkHome', s.id)}
          <div class="row" style="margin-top:8px"><span class="muted small">Home goal</span>
            <input type="number" class="num" min="0" data-wk-field="goal" data-id="${s.id}" value="${w.goal}" aria-label="Home goal minutes">
            <span class="muted small">min per day</span></div>
          <div class="field" style="margin:8px 0 0"><label>Home drills / what to work on</label>
            <textarea data-wk-field="drills" data-id="${s.id}" placeholder="e.g. 50 juggles, 10 min wall passes">${esc(w.drills || '')}</textarea></div>
        </div>`;
      }).join('')}
      ${own && keys[0] !== ws ? `<button class="btn" data-act="wkReset">↩ Remove this week's plan (use the one before it)</button>` : ''}
      ${keys.length > 1 || !own ? `<div class="muted small" style="margin-top:10px">Plan changes start on:</div><div class="chips">${keys.map(k =>
        `<button class="chip ${k === ws ? 'on' : ''}" data-act="weekGo" data-v="${k}">${short(k)}</button>`).join('')}</div>` : ''}
    </section>`;
  }

  function unlock() {
    const v = document.getElementById('pinIn').value;
    if (v === state.pin) { parentUnlocked = true; render(); }
    else toast('Wrong PIN');
  }
  function requireParent(then) {
    if (!state.pin || parentUnlocked) return then();
    const v = prompt('Parent PIN needed to approve:');
    if (v === null) return;
    if (v === state.pin) then(); else toast('Wrong PIN');
  }
  const toggle = (arr, v) => { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); arr.sort((a, b) => a - b); };
  const settingsChanged = () => { refreshTodayPlan(); save(); };

  // ---------- events ----------
  document.querySelector('.tabs').addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    tab = b.dataset.tab;
    if (tab === 'today') viewDay = todayKey();
    render();
    window.scrollTo(0, 0);
  });
  document.getElementById('pointsPill').addEventListener('click', () => { tab = 'rewards'; render(); });

  $view.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act, id = el.dataset.id;
    const k = viewDay;
    switch (act) {
      case 'prev': viewDay = addDays(viewDay, -1); break;
      case 'next': if (viewDay < todayKey()) viewDay = addDays(viewDay, 1); break;
      case 'goto': viewDay = el.dataset.day; tab = 'today'; window.scrollTo(0, 0); break;
      case 'chore': {
        const d = day(k, true);
        if (d.chores[id]) delete d.chores[id]; else d.chores[id] = true;
        save(); checkCelebrate(k); break;
      }
      case 'practice': {
        const d = day(k, true);
        d.practice = d.practice || {};
        if (d.practice[id]) delete d.practice[id]; else d.practice[id] = true;
        save(); checkCelebrate(k); break;
      }
      case 'extraOpen': extraOpen = true; extraForm = { sport: '', label: '', min: 0, note: '' }; break;
      case 'exCancel': extraOpen = false; break;
      case 'exSport': extraForm.sport = el.dataset.v; break;
      case 'exMin': extraForm.min = Number(el.dataset.v); break;
      case 'exSave': {
        const a = readExtraForm();
        if (!a) return;
        if (!(extraForm.min > 0 && extraForm.min <= 600)) { toast('How many minutes?'); return; }
        extraOpen = false;
        addSession(k, a.sport, extraForm.min, a.note, { label: a.label });
        break;
      }
      case 'exTimer': {
        const a = readExtraForm();
        if (!a) return;
        state.timer = { sport: a.sport, label: a.label, note: a.note, extra: true, start: Date.now(), day: todayKey() };
        save(); break;
      }
      case 'start':
        state.timer = { sport: el.dataset.sport, start: Date.now(), day: todayKey() };
        save(); break;
      case 'stop': {
        const t = state.timer; state.timer = null;
        const min = Math.max(1, Math.round((Date.now() - t.start) / 60000));
        if (t.extra) { addSession(t.day, t.sport, min, t.note, { label: t.label }); extraOpen = false; }
        else addSession(t.day, t.sport, min, 'timer');
        if (!t.extra) toast(`Saved ${min} min of ${sportById(t.sport).name}!`);
        break;
      }
      case 'cancelTimer':
        if (confirm('Cancel this timer without saving?')) { state.timer = null; save(); }
        break;
      case 'add': addSession(k, el.dataset.sport, Number(el.dataset.min)); break;
      case 'addCustom': {
        const v = prompt(`How many minutes of ${sportById(el.dataset.sport).name}?`);
        if (v === null) return;
        const n = Number(v);
        if (n > 0 && n <= 600) addSession(k, el.dataset.sport, n); else toast('Enter minutes between 1 and 600');
        break;
      }
      case 'delSession': {
        const d = day(k);
        if (d && confirm('Remove this practice time?')) { d.sessions = d.sessions.filter(s => s.id !== id); save(); }
        break;
      }
      case 'redeem': {
        const r = state.rewards.find(x => x.id === id);
        if (!r || balance() < r.cost) return;
        requireParent(() => {
          if (!confirm(`Spend ${r.cost} points on "${r.name}"?`)) return;
          state.redemptions.push({ id: uid(), name: r.name, cost: r.cost, date: todayKey() });
          save(); celebrate(['🎁', '🎉', '⭐']); toast(`Enjoy: ${r.name}!`); render();
        });
        return;
      }
      // parent actions
      case 'unlock': unlock(); return;
      case 'lock': parentUnlocked = false; break;
      case 'setPin': {
        const v = document.getElementById('newPin').value.trim();
        state.pin = v; parentUnlocked = !!v; save();
        toast(v ? 'PIN saved' : 'PIN removed'); break;
      }
      case 'choreDay': toggle(state.chores.find(c => c.id === id).days, Number(el.dataset.v)); settingsChanged(); break;
      case 'wkPractice': case 'wkHome': {
        const w = ensureWeek(parentWeek)[id];
        toggle(act === 'wkPractice' ? w.practice : w.home, Number(el.dataset.v));
        settingsChanged(); break;
      }
      case 'weekPrev': parentWeek = addDays(parentWeek, -7); break;
      case 'weekNext': parentWeek = addDays(parentWeek, 7); break;
      case 'weekGo': parentWeek = el.dataset.v; break;
      case 'wkReset':
        if (confirm("Remove this week's plan? It will go back to the plan from the week before.")) { delete state.weeks[parentWeek]; settingsChanged(); }
        break;
      case 'sportMonth': toggle(state.sports.find(s => s.id === id).months, Number(el.dataset.v)); settingsChanged(); break;
      case 'delChore':
        if (confirm('Delete this chore?')) { state.chores = state.chores.filter(c => c.id !== id); settingsChanged(); }
        break;
      case 'addChore': {
        const v = document.getElementById('newChore').value.trim();
        if (!v) return;
        state.chores.push({ id: uid(), name: v, days: ALL_DAYS.slice() }); settingsChanged(); break;
      }
      case 'delSport':
        if (confirm('Delete this sport? Past practice time is kept in history.')) { state.sports = state.sports.filter(s => s.id !== id); settingsChanged(); }
        break;
      case 'addSport': {
        const v = document.getElementById('newSport').value.trim();
        if (!v) return;
        state.sports.push({ id: uid(), name: v, emoji: '🏅', months: ALL_MONTHS.slice() });
        settingsChanged(); break;
      }
      case 'delReward':
        if (confirm('Delete this reward?')) { state.rewards = state.rewards.filter(r => r.id !== id); save(); }
        break;
      case 'addReward': {
        const name = document.getElementById('newReward').value.trim();
        const cost = Number(document.getElementById('newRewardCost').value);
        if (!name || !(cost > 0)) { toast('Enter a reward and its point cost'); return; }
        state.rewards.push({ id: uid(), name, cost: Math.round(cost) }); save(); break;
      }
      case 'adjust': {
        const n = Math.round(Number(document.getElementById('adjPts').value));
        const note = document.getElementById('adjNote').value.trim() || (n > 0 ? 'Bonus points' : 'Points adjustment');
        if (!n) { toast('Enter a number of points, like 10 or -10'); return; }
        // Stored as a negative/positive "redemption" so balance math stays simple.
        state.redemptions.push({ id: uid(), name: note, cost: -n, date: todayKey() });
        save(); toast(`${n > 0 ? '+' : ''}${n} points`); break;
      }
      case 'export': {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `jump-baby-backup-${todayKey()}.json`;
        a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        return;
      }
      case 'reset':
        if (confirm('Erase ALL data and start over? This cannot be undone.') && confirm('Are you sure?')) {
          state = defaults(); parentUnlocked = false; save();
        }
        break;
      default: return;
    }
    render();
  });

  $view.addEventListener('input', e => {
    const f = e.target.dataset.ex;
    if (!f) return;
    extraForm[f] = f === 'min' ? Math.round(Number(e.target.value) || 0) : e.target.value;
    if (f === 'min') document.querySelectorAll('[data-act=exMin]').forEach(c => c.classList.toggle('on', Number(c.dataset.v) === extraForm.min));
  });

  // Text/number edits in the parent area save on change.
  $view.addEventListener('change', e => {
    const el = e.target;
    if (el.id === 'importFile') {
      const f = el.files[0];
      if (!f) return;
      f.text().then(txt => {
        const data = JSON.parse(txt);
        if (!data || !data.days || !data.chores) throw new Error('bad');
        if (!confirm('Replace the data on this device with this backup?')) return;
        state = Object.assign(defaults(), data); save(); toast('Backup restored'); render();
      }).catch(() => toast('That file is not a valid backup'));
      return;
    }
    if (el.dataset.set === 'kidName') { state.kidName = el.value.trim(); save(); render(); return; }
    if (el.dataset.points) { state.points[el.dataset.points] = Math.max(0, Math.round(Number(el.value) || 0)); save(); render(); return; }
    if (el.dataset.choreName) {
      const c = state.chores.find(x => x.id === el.dataset.choreName);
      if (c && el.value.trim()) { c.name = el.value.trim(); save(); }
      return;
    }
    if (el.dataset.sportField) {
      const s = state.sports.find(x => x.id === el.dataset.id), f = el.dataset.sportField;
      if (!s) return;
      if (el.value.trim()) s[f] = el.value.trim();
      settingsChanged(); render(); return;
    }
    if (el.dataset.wkField) {
      const w = ensureWeek(parentWeek)[el.dataset.id];
      if (el.dataset.wkField === 'goal') w.goal = Math.max(0, Math.round(Number(el.value) || 0));
      else w.drills = el.value.trim();
      settingsChanged(); render(); return;
    }
    if (el.dataset.rewardField) {
      const r = state.rewards.find(x => x.id === el.dataset.id), f = el.dataset.rewardField;
      if (!r) return;
      if (f === 'cost') r.cost = Math.max(1, Math.round(Number(el.value) || 1));
      else if (el.value.trim()) r.name = el.value.trim();
      save(); return;
    }
  });

  // When the app comes back to the foreground on a new day, jump to today.
  let lastToday = todayKey();
  function onWake() {
    if (todayKey() !== lastToday) {
      if (viewDay === lastToday) viewDay = todayKey();
      lastToday = todayKey();
      if (tab !== 'parent') render();
    }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) onWake(); });
  setInterval(onWake, 60000);

  load();
  render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();

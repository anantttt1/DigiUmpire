/* ===== DigiUmpire – Core Logic ===== */

const state = {
  teamA: 'Mumbai Indians',
  teamB: 'Chennai Super Kings',
  totalOvers: 20,
  innings: 1,
  runs: 0,
  wickets: 0,
  balls: 0,
  extras: 0,
  partnership: 0,
  history: [],
  batsmen: [
    { name: 'Rohit Sharma', runs: 0, balls: 0, out: false },
    { name: 'Virat Kohli', runs: 0, balls: 0, out: false }
  ],
  bowlers: [
    { name: 'Jasprit Bumrah', overs: 0, balls: 0, runs: 0, wickets: 0 }
  ],
  strikerIdx: 0,
  nonStrikerIdx: 1,
  currentBowlerIdx: 0,
  undoStack: []
};

let deferredPrompt = null;
let speedStartTime = null;
let cameraStream = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function toast(msg, duration = 2500) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), duration);
}

function getOversText() {
  const overs = Math.floor(state.balls / 6);
  const balls = state.balls % 6;
  return `${overs}.${balls}`;
}

function getRunRate() {
  if (state.balls === 0) return '0.00';
  return ((state.runs / state.balls) * 6).toFixed(2);
}

function getBallsLeft() {
  return Math.max(0, state.totalOvers * 6 - state.balls);
}

function currentBowler() {
  return state.bowlers[state.currentBowlerIdx] || state.bowlers[0];
}

function updateUI() {
  const el = (id) => document.getElementById(id);
  if (el('totalRuns')) el('totalRuns').textContent = state.runs;
  if (el('totalWickets')) el('totalWickets').textContent = state.wickets;
  if (el('oversText')) el('oversText').textContent = getOversText();
  if (el('runRate')) el('runRate').textContent = getRunRate();
  if (el('partnership')) el('partnership').textContent = state.partnership;
  if (el('extras')) el('extras').textContent = state.extras;
  if (el('ballsLeft')) el('ballsLeft').textContent = getBallsLeft();
  if (el('teamAName')) el('teamAName').textContent = state.teamA;
  if (el('teamBName')) el('teamBName').textContent = state.teamB;
  if (el('inningsBadge')) el('inningsBadge').textContent = state.innings === 1 ? '1st Innings' : '2nd Innings';

  const striker = state.batsmen[state.strikerIdx];
  const nonStriker = state.batsmen[state.nonStrikerIdx];
  const bowler = currentBowler();

  if (striker) {
    if (el('strikerName')) el('strikerName').textContent = striker.name;
    if (el('strikerRuns')) el('strikerRuns').textContent = striker.runs;
    if (el('strikerBalls')) el('strikerBalls').textContent = striker.balls;
  }
  if (nonStriker) {
    if (el('nonStrikerName')) el('nonStrikerName').textContent = nonStriker.name;
    if (el('nonStrikerRuns')) el('nonStrikerRuns').textContent = nonStriker.runs;
    if (el('nonStrikerBalls')) el('nonStrikerBalls').textContent = nonStriker.balls;
  }
  if (bowler) {
    if (el('bowlerName')) el('bowlerName').textContent = bowler.name;
    const bOvers = Math.floor(bowler.balls / 6);
    const bBalls = bowler.balls % 6;
    if (el('bowlerOvers')) el('bowlerOvers').textContent = `${bOvers}.${bBalls}`;
    if (el('bowlerRuns')) el('bowlerRuns').textContent = bowler.runs;
    if (el('bowlerWkts')) el('bowlerWkts').textContent = bowler.wickets;
  }

  renderHistory();
  saveState();
}

function pushUndo() {
  state.undoStack.push(JSON.parse(JSON.stringify({
    runs: state.runs,
    wickets: state.wickets,
    balls: state.balls,
    extras: state.extras,
    partnership: state.partnership,
    batsmen: state.batsmen,
    bowlers: state.bowlers,
    strikerIdx: state.strikerIdx,
    nonStrikerIdx: state.nonStrikerIdx,
    history: state.history
  })));
  if (state.undoStack.length > 30) state.undoStack.shift();
}

function addBall(desc, runs = 0, isExtra = false, isWicket = false, legalBall = true) {
  pushUndo();

  state.runs += runs;
  state.partnership += runs;

  if (isExtra) state.extras += runs;

  if (legalBall) {
    state.balls += 1;
    const striker = state.batsmen[state.strikerIdx];
    if (striker) {
      striker.balls += 1;
      if (!isExtra) striker.runs += runs;
    }
    const bowler = currentBowler();
    if (bowler) {
      bowler.balls += 1;
      bowler.runs += runs;
      if (isWicket) bowler.wickets += 1;
    }
  } else {
    const bowler = currentBowler();
    if (bowler) bowler.runs += runs;
    if (!isExtra) {
      const striker = state.batsmen[state.strikerIdx];
      if (striker) striker.runs += runs;
    }
  }

  if (isWicket) {
    state.wickets += 1;
    state.partnership = 0;
    const nextIdx = state.batsmen.findIndex((b, i) => !b.out && i !== state.strikerIdx && i !== state.nonStrikerIdx);
    if (nextIdx !== -1) {
      state.batsmen[state.strikerIdx].out = true;
      state.strikerIdx = nextIdx;
    }
  }

  if (!isWicket && runs % 2 === 1 && (legalBall || desc.includes('Bye'))) {
    [state.strikerIdx, state.nonStrikerIdx] = [state.nonStrikerIdx, state.strikerIdx];
  }

  if (legalBall && state.balls % 6 === 0) {
    [state.strikerIdx, state.nonStrikerIdx] = [state.nonStrikerIdx, state.strikerIdx];
    toast(`Over complete • ${getOversText()}`);
  }

  state.history.unshift({
    over: getOversText(),
    desc,
    runs,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });

  updateUI();
}

$$('.score-btn.run').forEach(btn => {
  btn.addEventListener('click', () => {
    const r = parseInt(btn.dataset.runs);
    const labels = { 0: 'Dot', 1: '1 run', 2: '2 runs', 3: '3 runs', 4: 'FOUR!', 6: 'SIX!' };
    addBall(labels[r] || `${r} runs`, r, false, false, true);
    if (r === 4 || r === 6) toast(labels[r]);
  });
});

$$('.score-btn.extra').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.extra;
    if (type === 'wide') {
      addBall('Wide +1', 1, true, false, false);
      toast('Wide');
    } else if (type === 'bye') {
      addBall('Bye +1', 1, true, false, true);
      toast('Bye');
    } else if (type === 'legbye') {
      addBall('Leg Bye +1', 1, true, false, true);
      toast('Leg Bye');
    }
  });
});

$('.score-btn.wicket')?.addEventListener('click', () => {
  if (state.wickets >= 10) {
    toast('All out!');
    return;
  }
  addBall('WICKET!', 0, false, true, true);
  toast('Wicket!');
});

$('#undoBtn')?.addEventListener('click', () => {
  if (state.undoStack.length === 0) {
    toast('Nothing to undo');
    return;
  }
  const prev = state.undoStack.pop();
  Object.assign(state, prev);
  updateUI();
  toast('Undone');
});

function syncPlayerNamesFromInputs() {
  const batsList = $('#batsmenList');
  const bowlList = $('#bowlersList');
  if (batsList) {
    batsList.querySelectorAll('input[data-type="bat"]').forEach(inp => {
      const idx = parseInt(inp.dataset.idx);
      if (state.batsmen[idx]) {
        state.batsmen[idx].name = (inp.value || '').trim() || `Batsman ${idx + 1}`;
      }
    });
  }
  if (bowlList) {
    bowlList.querySelectorAll('input[data-type="bowl"]').forEach(inp => {
      const idx = parseInt(inp.dataset.idx);
      if (state.bowlers[idx]) {
        state.bowlers[idx].name = (inp.value || '').trim() || `Bowler ${idx + 1}`;
      }
    });
  }
}

function renderPlayers() {
  const batsList = $('#batsmenList');
  const bowlList = $('#bowlersList');
  if (!batsList || !bowlList) return;

  batsList.innerHTML = '';
  bowlList.innerHTML = '';

  state.batsmen.forEach((b, i) => {
    const div = document.createElement('div');
    div.className = 'player-item';
    div.innerHTML = `
      <input type="text" value="${b.name.replace(/"/g, '&quot;')}" data-idx="${i}" data-type="bat" placeholder="Batsman name" />
      <button type="button" class="remove-btn" data-idx="${i}" data-type="bat">✕</button>
    `;
    batsList.appendChild(div);
  });

  state.bowlers.forEach((b, i) => {
    const div = document.createElement('div');
    div.className = 'player-item';
    div.innerHTML = `
      <input type="text" value="${b.name.replace(/"/g, '&quot;')}" data-idx="${i}" data-type="bowl" placeholder="Bowler name" />
      <button type="button" class="remove-btn" data-idx="${i}" data-type="bowl">✕</button>
    `;
    bowlList.appendChild(div);
  });

  batsList.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      if (state.batsmen[idx]) {
        state.batsmen[idx].name = e.target.value.trim() || `Batsman ${idx + 1}`;
      }
    });
  });
  bowlList.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      if (state.bowlers[idx]) {
        state.bowlers[idx].name = e.target.value.trim() || `Bowler ${idx + 1}`;
      }
    });
  });

  batsList.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.batsmen.length <= 2) return toast('Minimum 2 batsmen');
      state.batsmen.splice(parseInt(btn.dataset.idx), 1);
      if (state.strikerIdx >= state.batsmen.length) state.strikerIdx = 0;
      if (state.nonStrikerIdx >= state.batsmen.length) state.nonStrikerIdx = Math.min(1, state.batsmen.length - 1);
      renderPlayers();
    });
  });
  bowlList.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.bowlers.length <= 1) return toast('Minimum 1 bowler');
      state.bowlers.splice(parseInt(btn.dataset.idx), 1);
      if (state.currentBowlerIdx >= state.bowlers.length) state.currentBowlerIdx = 0;
      renderPlayers();
    });
  });
}

$('#addBatsman')?.addEventListener('click', () => {
  state.batsmen.push({ name: `Batsman ${state.batsmen.length + 1}`, runs: 0, balls: 0, out: false });
  renderPlayers();
});
$('#addBowler')?.addEventListener('click', () => {
  state.bowlers.push({ name: `Bowler ${state.bowlers.length + 1}`, overs: 0, balls: 0, runs: 0, wickets: 0 });
  renderPlayers();
});

$('#saveSetup')?.addEventListener('click', () => {
  syncPlayerNamesFromInputs();
  state.teamA = ($('#inputTeamA')?.value || '').trim() || 'Team 1';
  state.teamB = ($('#inputTeamB')?.value || '').trim() || 'Team 2';
  state.totalOvers = parseInt($('#inputOvers')?.value) || 20;
  closePanels();
  updateUI();
  toast('✓ Match setup saved');
});

$('#resetMatch')?.addEventListener('click', () => {
  if (!confirm('Reset entire match?')) return;
  state.runs = 0;
  state.wickets = 0;
  state.balls = 0;
  state.extras = 0;
  state.partnership = 0;
  state.history = [];
  state.undoStack = [];
  state.batsmen.forEach(b => { b.runs = 0; b.balls = 0; b.out = false; });
  state.bowlers.forEach(b => { b.balls = 0; b.runs = 0; b.wickets = 0; });
  state.strikerIdx = 0;
  state.nonStrikerIdx = 1;
  state.currentBowlerIdx = 0;
  updateUI();
  toast('Match reset');
});

function renderHistory() {
  const box = $('#ballHistory');
  if (!box) return;
  box.innerHTML = state.history.slice(0, 50).map((h) => `
    <div class="ball-item">
      <span class="ball-num">${h.over}</span>
      <span class="ball-desc">${h.desc}</span>
      <span class="ball-runs">${h.runs > 0 ? '+' + h.runs : ''}</span>
    </div>
  `).join('') || '<p style="color:var(--text-muted);text-align:center;padding:20px;">No balls yet</p>';
}

$('#clearHistory')?.addEventListener('click', () => {
  state.history = [];
  renderHistory();
});

async function startCamera() {
  stopCamera();
  const video = $('#cameraVideo');
  if (!video) {
    toast('Video element not found');
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast('Camera not supported on this browser');
    return;
  }
  try {
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
    } catch (e1) {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
    }
    cameraStream = stream;
    video.srcObject = stream;
    video.setAttribute('playsinline', true);
    video.muted = true;
    try { await video.play(); } catch (playErr) { console.warn(playErr); }
    $('#startCamera')?.classList.add('hidden');
    $('#stopCamera')?.classList.remove('hidden');
    toast('📷 Camera started');
  } catch (err) {
    console.error('Camera error:', err);
    let msg = 'Camera access failed';
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      msg = 'Camera permission denied. Browser settings se allow karo.';
    } else if (err.name === 'NotFoundError') {
      msg = 'No camera found on this device';
    } else if (err.name === 'NotReadableError') {
      msg = 'Camera already in use by another app';
    } else if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      msg = 'Camera needs HTTPS. Deploy on Vercel first.';
    }
    toast(msg);
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
    cameraStream = null;
  }
  const video = $('#cameraVideo');
  if (video) video.srcObject = null;
  $('#startCamera')?.classList.remove('hidden');
  $('#stopCamera')?.classList.add('hidden');
}

$('#startCamera')?.addEventListener('click', startCamera);
$('#stopCamera')?.addEventListener('click', stopCamera);

$('#speedStart')?.addEventListener('click', () => {
  speedStartTime = performance.now();
  $('#speedStart').disabled = true;
  $('#speedStop').disabled = false;
  $('#speedDisplay').textContent = '...';
  toast('Timing started – STOP when ball reaches batsman');
});

$('#speedStop')?.addEventListener('click', () => {
  if (!speedStartTime) return;
  const elapsed = (performance.now() - speedStartTime) / 1000;
  const distance = 18.5;
  const speedMs = distance / elapsed;
  const speedKmh = Math.round(speedMs * 3.6);
  $('#speedDisplay').textContent = `${speedKmh} km/h`;
  $('#speedStart').disabled = false;
  $('#speedStop').disabled = true;
  speedStartTime = null;
  let label = '';
  if (speedKmh > 145) label = '🚀 Express!';
  else if (speedKmh > 130) label = '🔥 Fast';
  else if (speedKmh > 115) label = '⚡ Medium-Fast';
  else label = '🎯 Medium';
  toast(`${speedKmh} km/h ${label}`);
});

$('#callWide')?.addEventListener('click', () => {
  addBall('Wide +1 (Camera)', 1, true, false, false);
  toast('Wide called');
});

function closePanels() {
  $$('.side-panel').forEach(p => p.classList.add('hidden'));
  $$('.nav-item').forEach(n => n.classList.remove('active'));
  const scoreNav = document.querySelector('.nav-item[data-tab="score"]');
  if (scoreNav) scoreNav.classList.add('active');
  stopCamera();
}

$$('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const tab = item.dataset.tab;
    closePanels();
    item.classList.add('active');
    if (tab === 'players') {
      $('#playersPanel')?.classList.remove('hidden');
      renderPlayers();
      if ($('#inputTeamA')) $('#inputTeamA').value = state.teamA;
      if ($('#inputTeamB')) $('#inputTeamB').value = state.teamB;
      if ($('#inputOvers')) $('#inputOvers').value = state.totalOvers;
    } else if (tab === 'camera') {
      $('#cameraPanel')?.classList.remove('hidden');
    } else if (tab === 'history') {
      $('#historyPanel')?.classList.remove('hidden');
      renderHistory();
    }
  });
});

$$('.close-panel').forEach(btn => {
  btn.addEventListener('click', closePanels);
});

$('#menuBtn')?.addEventListener('click', () => {
  $('#menuOverlay')?.classList.remove('hidden');
});
$$('.close-menu, .menu-overlay').forEach(el => {
  el.addEventListener('click', (e) => {
    if (e.target === el || el.classList.contains('close-menu')) {
      $('#menuOverlay')?.classList.add('hidden');
    }
  });
});

$$('.menu-item[data-action]').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    $('#menuOverlay')?.classList.add('hidden');
    if (action === 'new-innings') {
      state.innings = state.innings === 1 ? 2 : 1;
      state.runs = 0; state.wickets = 0; state.balls = 0; state.extras = 0; state.partnership = 0; state.history = [];
      state.batsmen.forEach(b => { b.runs = 0; b.balls = 0; b.out = false; });
      state.bowlers.forEach(b => { b.balls = 0; b.runs = 0; b.wickets = 0; });
      updateUI();
      toast(`Innings ${state.innings} started`);
    } else if (action === 'export') {
      const text = `${state.teamA} vs ${state.teamB}\n${state.runs}/${state.wickets} (${getOversText()})\nRR: ${getRunRate()}\nExtras: ${state.extras}`;
      navigator.clipboard?.writeText(text).then(() => toast('Scorecard copied!')).catch(() => toast(text));
    } else if (action === 'about') {
      toast('DigiUmpire v1.0 – Smart Cricket Scoring PWA');
    }
  });
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $('#installBanner')?.classList.remove('hidden');
});

$('#installBtn')?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') toast('App installed!');
  deferredPrompt = null;
  $('#installBanner')?.classList.add('hidden');
});

$('#dismissInstall')?.addEventListener('click', () => {
  $('#installBanner')?.classList.add('hidden');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  });
}

function saveState() {
  try {
    localStorage.setItem('digiumpire_state', JSON.stringify({
      teamA: state.teamA, teamB: state.teamB, totalOvers: state.totalOvers,
      innings: state.innings, runs: state.runs, wickets: state.wickets,
      balls: state.balls, extras: state.extras, partnership: state.partnership,
      batsmen: state.batsmen, bowlers: state.bowlers,
      strikerIdx: state.strikerIdx, nonStrikerIdx: state.nonStrikerIdx,
      currentBowlerIdx: state.currentBowlerIdx, history: state.history.slice(0, 100)
    }));
  } catch (e) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem('digiumpire_state');
    if (raw) Object.assign(state, JSON.parse(raw));
  } catch (e) {}
}

loadState();
updateUI();

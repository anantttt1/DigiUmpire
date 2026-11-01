/* DigiUmpire - Mobile Safe */
(function () {
  'use strict';

  var state = {
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

  var deferredPrompt = null;
  var speedStartTime = null;
  var cameraStream = null;

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }
  function el(id) { return document.getElementById(id); }

  function toast(msg, duration) {
    duration = duration || 2500;
    var t = el('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.remove('hidden');
    if (t._timer) clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.add('hidden'); }, duration);
  }

  function getOversText() {
    return Math.floor(state.balls / 6) + '.' + (state.balls % 6);
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
    try {
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

      var striker = state.batsmen[state.strikerIdx];
      var nonStriker = state.batsmen[state.nonStrikerIdx];
      var bowler = currentBowler();

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
        if (el('bowlerOvers')) el('bowlerOvers').textContent = Math.floor(bowler.balls / 6) + '.' + (bowler.balls % 6);
        if (el('bowlerRuns')) el('bowlerRuns').textContent = bowler.runs;
        if (el('bowlerWkts')) el('bowlerWkts').textContent = bowler.wickets;
      }
      renderHistory();
      saveState();
    } catch (e) { console.error('updateUI', e); }
  }

  function pushUndo() {
    try {
      state.undoStack.push(JSON.parse(JSON.stringify({
        runs: state.runs, wickets: state.wickets, balls: state.balls,
        extras: state.extras, partnership: state.partnership,
        batsmen: state.batsmen, bowlers: state.bowlers,
        strikerIdx: state.strikerIdx, nonStrikerIdx: state.nonStrikerIdx,
        history: state.history
      })));
      if (state.undoStack.length > 30) state.undoStack.shift();
    } catch (e) {}
  }

  function addBall(desc, runs, isExtra, isWicket, legalBall) {
    runs = runs || 0;
    isExtra = !!isExtra;
    isWicket = !!isWicket;
    if (legalBall === undefined) legalBall = true;
    pushUndo();
    state.runs += runs;
    state.partnership += runs;
    if (isExtra) state.extras += runs;

    if (legalBall) {
      state.balls += 1;
      var striker = state.batsmen[state.strikerIdx];
      if (striker) {
        striker.balls += 1;
        if (!isExtra) striker.runs += runs;
      }
      var bowler = currentBowler();
      if (bowler) {
        bowler.balls += 1;
        bowler.runs += runs;
        if (isWicket) bowler.wickets += 1;
      }
    } else {
      var bowler2 = currentBowler();
      if (bowler2) bowler2.runs += runs;
      if (!isExtra) {
        var s2 = state.batsmen[state.strikerIdx];
        if (s2) s2.runs += runs;
      }
    }

    if (isWicket) {
      state.wickets += 1;
      state.partnership = 0;
      var nextIdx = -1;
      for (var i = 0; i < state.batsmen.length; i++) {
        if (!state.batsmen[i].out && i !== state.strikerIdx && i !== state.nonStrikerIdx) {
          nextIdx = i; break;
        }
      }
      if (nextIdx !== -1) {
        state.batsmen[state.strikerIdx].out = true;
        state.strikerIdx = nextIdx;
      }
    }

    if (!isWicket && runs % 2 === 1 && (legalBall || (desc && desc.indexOf('Bye') !== -1))) {
      var tmp = state.strikerIdx;
      state.strikerIdx = state.nonStrikerIdx;
      state.nonStrikerIdx = tmp;
    }

    if (legalBall && state.balls % 6 === 0) {
      var tmp2 = state.strikerIdx;
      state.strikerIdx = state.nonStrikerIdx;
      state.nonStrikerIdx = tmp2;
      toast('Over complete • ' + getOversText());
    }

    state.history.unshift({ over: getOversText(), desc: desc, runs: runs });
    updateUI();
  }

  function stopCamera() {
    if (cameraStream) {
      try {
        var tracks = cameraStream.getTracks();
        for (var i = 0; i < tracks.length; i++) tracks[i].stop();
      } catch (e) {}
      cameraStream = null;
    }
    var video = el('cameraVideo');
    if (video) video.srcObject = null;
    if (el('startCamera')) el('startCamera').classList.remove('hidden');
    if (el('stopCamera')) el('stopCamera').classList.add('hidden');
  }

  function closePanels() {
    var panels = $$('.side-panel');
    for (var i = 0; i < panels.length; i++) panels[i].classList.add('hidden');
    var navs = $$('.nav-item');
    for (var j = 0; j < navs.length; j++) navs[j].classList.remove('active');
    var scoreNav = document.querySelector('.nav-item[data-tab="score"]');
    if (scoreNav) scoreNav.classList.add('active');
    stopCamera();
  }

  function renderHistory() {
    var box = el('ballHistory');
    if (!box) return;
    if (!state.history.length) {
      box.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">No balls yet</p>';
      return;
    }
    var html = '';
    var max = Math.min(50, state.history.length);
    for (var i = 0; i < max; i++) {
      var h = state.history[i];
      html += '<div class="ball-item"><span class="ball-num">' + h.over + '</span><span class="ball-desc">' + h.desc + '</span><span class="ball-runs">' + (h.runs > 0 ? '+' + h.runs : '') + '</span></div>';
    }
    box.innerHTML = html;
  }

  function syncPlayerNamesFromInputs() {
    var batsList = el('batsmenList');
    var bowlList = el('bowlersList');
    if (batsList) {
      var inputs = batsList.querySelectorAll('input[data-type="bat"]');
      for (var i = 0; i < inputs.length; i++) {
        var idx = parseInt(inputs[i].getAttribute('data-idx'), 10);
        if (state.batsmen[idx]) {
          var v = (inputs[i].value || '').trim();
          state.batsmen[idx].name = v || ('Batsman ' + (idx + 1));
        }
      }
    }
    if (bowlList) {
      var inputs2 = bowlList.querySelectorAll('input[data-type="bowl"]');
      for (var j = 0; j < inputs2.length; j++) {
        var idx2 = parseInt(inputs2[j].getAttribute('data-idx'), 10);
        if (state.bowlers[idx2]) {
          var v2 = (inputs2[j].value || '').trim();
          state.bowlers[idx2].name = v2 || ('Bowler ' + (idx2 + 1));
        }
      }
    }
  }

  function renderPlayers() {
    var batsList = el('batsmenList');
    var bowlList = el('bowlersList');
    if (!batsList || !bowlList) return;
    batsList.innerHTML = '';
    bowlList.innerHTML = '';

    for (var i = 0; i < state.batsmen.length; i++) {
      (function (idx) {
        var b = state.batsmen[idx];
        var div = document.createElement('div');
        div.className = 'player-item';
        var input = document.createElement('input');
        input.type = 'text';
        input.value = b.name;
        input.setAttribute('data-idx', String(idx));
        input.setAttribute('data-type', 'bat');
        input.placeholder = 'Batsman name';
        input.addEventListener('input', function () {
          state.batsmen[idx].name = (input.value || '').trim() || ('Batsman ' + (idx + 1));
        });
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'remove-btn';
        btn.textContent = '\u2715';
        btn.addEventListener('click', function () {
          if (state.batsmen.length <= 2) { toast('Minimum 2 batsmen'); return; }
          state.batsmen.splice(idx, 1);
          if (state.strikerIdx >= state.batsmen.length) state.strikerIdx = 0;
          if (state.nonStrikerIdx >= state.batsmen.length) state.nonStrikerIdx = Math.min(1, state.batsmen.length - 1);
          renderPlayers();
        });
        div.appendChild(input);
        div.appendChild(btn);
        batsList.appendChild(div);
      })(i);
    }

    for (var j = 0; j < state.bowlers.length; j++) {
      (function (idx) {
        var b = state.bowlers[idx];
        var div = document.createElement('div');
        div.className = 'player-item';
        var input = document.createElement('input');
        input.type = 'text';
        input.value = b.name;
        input.setAttribute('data-idx', String(idx));
        input.setAttribute('data-type', 'bowl');
        input.placeholder = 'Bowler name';
        input.addEventListener('input', function () {
          state.bowlers[idx].name = (input.value || '').trim() || ('Bowler ' + (idx + 1));
        });
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'remove-btn';
        btn.textContent = '\u2715';
        btn.addEventListener('click', function () {
          if (state.bowlers.length <= 1) { toast('Minimum 1 bowler'); return; }
          state.bowlers.splice(idx, 1);
          if (state.currentBowlerIdx >= state.bowlers.length) state.currentBowlerIdx = 0;
          renderPlayers();
        });
        div.appendChild(input);
        div.appendChild(btn);
        bowlList.appendChild(div);
      })(j);
    }
  }

  function startCamera() {
    stopCamera();
    var video = el('cameraVideo');
    if (!video) { toast('Video element not found'); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('Camera not supported'); return;
    }
    var tryConstraints = [
      { video: { facingMode: { ideal: 'environment' } }, audio: false },
      { video: true, audio: false }
    ];
    function tryNext(i) {
      if (i >= tryConstraints.length) {
        toast('Camera access failed. Permission allow karo.');
        return;
      }
      navigator.mediaDevices.getUserMedia(tryConstraints[i]).then(function (stream) {
        cameraStream = stream;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.muted = true;
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
        if (el('startCamera')) el('startCamera').classList.add('hidden');
        if (el('stopCamera')) el('stopCamera').classList.remove('hidden');
        toast('Camera started');
      }).catch(function (err) {
        console.error(err);
        tryNext(i + 1);
      });
    }
    tryNext(0);
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
      var raw = localStorage.getItem('digiumpire_state');
      if (raw) {
        var saved = JSON.parse(raw);
        for (var k in saved) {
          if (saved.hasOwnProperty(k)) state[k] = saved[k];
        }
      }
    } catch (e) {}
  }

  function bindEvents() {
    var runBtns = $$('.score-btn.run');
    for (var i = 0; i < runBtns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var r = parseInt(btn.getAttribute('data-runs'), 10);
          var labels = { 0: 'Dot', 1: '1 run', 2: '2 runs', 3: '3 runs', 4: 'FOUR!', 6: 'SIX!' };
          addBall(labels[r] || (r + ' runs'), r, false, false, true);
          if (r === 4 || r === 6) toast(labels[r]);
        });
      })(runBtns[i]);
    }

    var extraBtns = $$('.score-btn.extra');
    for (var e = 0; e < extraBtns.length; e++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var type = btn.getAttribute('data-extra');
          if (type === 'wide') { addBall('Wide +1', 1, true, false, false); toast('Wide'); }
          else if (type === 'bye') { addBall('Bye +1', 1, true, false, true); toast('Bye'); }
          else if (type === 'legbye') { addBall('Leg Bye +1', 1, true, false, true); toast('Leg Bye'); }
        });
      })(extraBtns[e]);
    }

    var wicketBtn = document.querySelector('.score-btn.wicket');
    if (wicketBtn) {
      wicketBtn.addEventListener('click', function () {
        if (state.wickets >= 10) { toast('All out!'); return; }
        addBall('WICKET!', 0, false, true, true);
        toast('Wicket!');
      });
    }

    var undoBtn = el('undoBtn');
    if (undoBtn) {
      undoBtn.addEventListener('click', function () {
        if (state.undoStack.length === 0) { toast('Nothing to undo'); return; }
        var prev = state.undoStack.pop();
        for (var k in prev) { if (prev.hasOwnProperty(k)) state[k] = prev[k]; }
        updateUI();
        toast('Undone');
      });
    }

    var addBat = el('addBatsman');
    if (addBat) {
      addBat.addEventListener('click', function () {
        state.batsmen.push({ name: 'Batsman ' + (state.batsmen.length + 1), runs: 0, balls: 0, out: false });
        renderPlayers();
      });
    }
    var addBowl = el('addBowler');
    if (addBowl) {
      addBowl.addEventListener('click', function () {
        state.bowlers.push({ name: 'Bowler ' + (state.bowlers.length + 1), overs: 0, balls: 0, runs: 0, wickets: 0 });
        renderPlayers();
      });
    }

    var saveBtn = el('saveSetup');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        syncPlayerNamesFromInputs();
        var ta = el('inputTeamA');
        var tb = el('inputTeamB');
        var ov = el('inputOvers');
        state.teamA = (ta && ta.value ? ta.value.trim() : '') || 'Team 1';
        state.teamB = (tb && tb.value ? tb.value.trim() : '') || 'Team 2';
        state.totalOvers = (ov && parseInt(ov.value, 10)) || 20;
        closePanels();
        updateUI();
        toast('Match setup saved');
      });
    }

    var resetBtn = el('resetMatch');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (!confirm('Reset entire match?')) return;
        state.runs = 0; state.wickets = 0; state.balls = 0; state.extras = 0;
        state.partnership = 0; state.history = []; state.undoStack = [];
        for (var i = 0; i < state.batsmen.length; i++) {
          state.batsmen[i].runs = 0; state.batsmen[i].balls = 0; state.batsmen[i].out = false;
        }
        for (var j = 0; j < state.bowlers.length; j++) {
          state.bowlers[j].balls = 0; state.bowlers[j].runs = 0; state.bowlers[j].wickets = 0;
        }
        state.strikerIdx = 0; state.nonStrikerIdx = 1; state.currentBowlerIdx = 0;
        updateUI();
        toast('Match reset');
      });
    }

    var clearHist = el('clearHistory');
    if (clearHist) {
      clearHist.addEventListener('click', function () {
        state.history = [];
        renderHistory();
      });
    }

    if (el('startCamera')) el('startCamera').addEventListener('click', startCamera);
    if (el('stopCamera')) el('stopCamera').addEventListener('click', stopCamera);

    var speedStart = el('speedStart');
    if (speedStart) {
      speedStart.addEventListener('click', function () {
        speedStartTime = performance.now();
        speedStart.disabled = true;
        if (el('speedStop')) el('speedStop').disabled = false;
        if (el('speedDisplay')) el('speedDisplay').textContent = '...';
        toast('Timing started');
      });
    }
    var speedStop = el('speedStop');
    if (speedStop) {
      speedStop.addEventListener('click', function () {
        if (!speedStartTime) return;
        var elapsed = (performance.now() - speedStartTime) / 1000;
        var speedKmh = Math.round((18.5 / elapsed) * 3.6);
        if (el('speedDisplay')) el('speedDisplay').textContent = speedKmh + ' km/h';
        if (speedStart) speedStart.disabled = false;
        speedStop.disabled = true;
        speedStartTime = null;
        toast(speedKmh + ' km/h');
      });
    }

    if (el('callWide')) {
      el('callWide').addEventListener('click', function () {
        addBall('Wide +1 (Camera)', 1, true, false, false);
        toast('Wide called');
      });
    }

    var navItems = $$('.nav-item');
    for (var n = 0; n < navItems.length; n++) {
      (function (item) {
        item.addEventListener('click', function () {
          var tab = item.getAttribute('data-tab');
          closePanels();
          item.classList.add('active');
          if (tab === 'players') {
            if (el('playersPanel')) el('playersPanel').classList.remove('hidden');
            renderPlayers();
            if (el('inputTeamA')) el('inputTeamA').value = state.teamA;
            if (el('inputTeamB')) el('inputTeamB').value = state.teamB;
            if (el('inputOvers')) el('inputOvers').value = state.totalOvers;
          } else if (tab === 'camera') {
            if (el('cameraPanel')) el('cameraPanel').classList.remove('hidden');
          } else if (tab === 'history') {
            if (el('historyPanel')) el('historyPanel').classList.remove('hidden');
            renderHistory();
          }
        });
      })(navItems[n]);
    }

    var closeBtns = $$('.close-panel');
    for (var c = 0; c < closeBtns.length; c++) {
      closeBtns[c].addEventListener('click', closePanels);
    }

    if (el('menuBtn')) {
      el('menuBtn').addEventListener('click', function () {
        if (el('menuOverlay')) el('menuOverlay').classList.remove('hidden');
      });
    }
    var menuOverlay = el('menuOverlay');
    if (menuOverlay) {
      menuOverlay.addEventListener('click', function (e) {
        if (e.target === menuOverlay || (e.target.classList && e.target.classList.contains('close-menu'))) {
          menuOverlay.classList.add('hidden');
        }
      });
    }
    var menuItems = $$('.menu-item[data-action]');
    for (var m = 0; m < menuItems.length; m++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var action = btn.getAttribute('data-action');
          if (menuOverlay) menuOverlay.classList.add('hidden');
          if (action === 'new-innings') {
            state.innings = state.innings === 1 ? 2 : 1;
            state.runs = 0; state.wickets = 0; state.balls = 0; state.extras = 0;
            state.partnership = 0; state.history = [];
            for (var i = 0; i < state.batsmen.length; i++) {
              state.batsmen[i].runs = 0; state.batsmen[i].balls = 0; state.batsmen[i].out = false;
            }
            for (var j = 0; j < state.bowlers.length; j++) {
              state.bowlers[j].balls = 0; state.bowlers[j].runs = 0; state.bowlers[j].wickets = 0;
            }
            updateUI();
            toast('Innings ' + state.innings + ' started');
          } else if (action === 'export') {
            var text = state.teamA + ' vs ' + state.teamB + '\n' + state.runs + '/' + state.wickets + ' (' + getOversText() + ')';
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(text).then(function () { toast('Scorecard copied!'); }).catch(function () { toast(text); });
            } else { toast(text); }
          } else if (action === 'about') {
            toast('DigiUmpire v1.1');
          }
        });
      })(menuItems[m]);
    }

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      if (el('installBanner')) el('installBanner').classList.remove('hidden');
    });
    if (el('installBtn')) {
      el('installBtn').addEventListener('click', function () {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (result) {
          if (result.outcome === 'accepted') toast('App installed!');
          deferredPrompt = null;
          if (el('installBanner')) el('installBanner').classList.add('hidden');
        });
      });
    }
    if (el('dismissInstall')) {
      el('dismissInstall').addEventListener('click', function () {
        if (el('installBanner')) el('installBanner').classList.add('hidden');
      });
    }
  }

  function init() {
    loadState();
    bindEvents();
    updateUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
})();

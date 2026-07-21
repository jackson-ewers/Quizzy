// ---------- Data ----------
let decadeQuestions = [];
let playerCareerQuestions = [];
let thisOrThatPool = {};
let collegeQuestions = [];
let collegesSearch = [];
let draftQuestions = [];
let playersSearch = [];
let fillBlankBoards = [];
let awardsSeasonQuestions = [];
let trophyCaseQuestions = [];

const TOPIC_ORDER = ["decade", "playerCareer", "thisOrThat", "college", "draft", "fillBlank", "awardsSeason", "trophyCase"];

const TOPIC_META = {
  decade: {
    title: "Decade Team Leader",
    color: "var(--accent)",
    description:
      "You'll get a decade, a team, and a stat category — guess which player led that team in that stat during that decade.",
  },
  playerCareer: {
    title: "Player Career",
    color: "var(--accent-2)",
    description: "You'll see a mystery player's full season-by-season stat line — guess who it is.",
  },
  thisOrThat: {
    title: "This or That",
    color: "var(--accent-3)",
    description:
      "You'll see 3 head-to-head match-ups for a randomly picked career stat, all at once — guess who had more in each, and get all three right to win.",
  },
  college: {
    title: "College",
    color: "var(--accent-4)",
    description: "You'll get a random All-Star's name — guess which college they played for.",
  },
  draft: {
    title: "Draft",
    color: "var(--accent-5)",
    description: "You'll get a draft year, round, pick, and team — guess which player it was.",
  },
  fillBlank: {
    title: "Fill in the Blank",
    color: "var(--accent-6)",
    description:
      "You'll see a Top 5 stat leaderboard — for a season, a career, or the playoffs — with one player blanked out. Guess who's missing.",
  },
  awardsSeason: {
    title: "Awards Season",
    color: "var(--accent-7)",
    description: "You'll get an award and a season — guess who won it.",
  },
  trophyCase: {
    title: "Trophy Case",
    color: "var(--accent-8)",
    description: "You'll see a mystery player's full career accolade resume — guess who it is.",
  },
};

const HINTS = {
  decade: [
    { key: "pos", label: "Position", value: (q) => q.pos },
    { key: "years", label: "Years Active", value: (q) => q.years },
  ],
  playerCareer: [
    { key: "pos", label: "Position (per season)" },
    { key: "awards", label: "Awards (per season)" },
  ],
  thisOrThat: [
    { key: "g", label: "Career Games Played" },
    { key: "mpg", label: "Career Minutes Per Game" },
  ],
  college: [
    { key: "conference", label: "Conference", value: (q) => q.conference },
    { key: "mascot", label: "Mascot", value: (q) => q.mascot },
  ],
  draft: [
    { key: "pos", label: "Position", value: (q) => q.pos },
    { key: "college", label: "College", value: (q) => q.college },
  ],
  fillBlank: [
    { key: "pos", label: "Position", value: (q) => q.pos },
    { key: "team", label: "Team(s)", value: (q) => q.team },
  ],
  awardsSeason: [
    { key: "pos", label: "Position", value: (q) => q.pos },
    { key: "team", label: "Team", value: (q) => q.team },
  ],
  trophyCase: [
    { key: "years", label: "Years Active", value: (q) => q.years },
    { key: "team", label: "Teams", value: (q) => q.team },
  ],
};

const DIFFICULTY_LEVELS = {
  easy: { label: "Easy", description: "2000-Present", cutoffYear: 2000 },
  medium: { label: "Medium", description: "1980-Present", cutoffYear: 1980 },
  hard: { label: "Hard", description: "All-Time", cutoffYear: 0 },
};

const QUESTION_TIME_SECONDS = 60;

// ---------- State ----------
function freshState() {
  return {
    screen: "start",
    gameLength: 5,
    difficulty: "medium",
    totalScore: 0,
    usedWagers: new Set(),
    round: 0,
    history: [],
    usedQuestionIds: {
      decade: new Set(),
      playerCareer: new Set(),
      thisOrThat: new Set(),
      college: new Set(),
      draft: new Set(),
      fillBlank: new Set(),
      awardsSeason: new Set(),
      trophyCase: new Set(),
    },
    wheelRotation: 0,
    showHowToPlay: false,
    showWelcome: false,
    current: {
      topic: null,
      question: null,
      wager: null,
      hintsRevealed: [],
      selectedPlayer: null,
      selectedCollege: null,
      totSelections: [null, null, null],
      totSubmitted: false,
    },
  };
}
let state = freshState();
state.showWelcome = true; // only ever true on the very first page load, not on later resets

// ---------- Timer ----------
let timerInterval = null;
let timerSecondsLeft = QUESTION_TIME_SECONDS;
let timerActiveKey = null;
let timerOnTimeout = null;

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function ensureTimer(key, onTimeout) {
  timerOnTimeout = onTimeout;
  if (timerActiveKey === key) return;
  clearInterval(timerInterval);
  timerActiveKey = key;
  timerSecondsLeft = QUESTION_TIME_SECONDS;
  timerInterval = setInterval(() => {
    timerSecondsLeft -= 1;
    const el = document.getElementById("timerDisplay");
    if (el) el.textContent = formatTimer(Math.max(timerSecondsLeft, 0));
    if (timerSecondsLeft <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      if (timerOnTimeout) timerOnTimeout();
    }
  }, 1000);
}

function resetTimer() {
  timerSecondsLeft = QUESTION_TIME_SECONDS;
  const el = document.getElementById("timerDisplay");
  if (el) el.textContent = formatTimer(timerSecondsLeft);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerActiveKey = null;
}

// ---------- Utilities ----------
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cutoffYear() {
  return DIFFICULTY_LEVELS[state.difficulty].cutoffYear;
}

function pickThisOrThatQuestion() {
  const cutoff = cutoffYear();
  const statKeys = Object.keys(thisOrThatPool);
  const statKey = statKeys[Math.floor(Math.random() * statKeys.length)];
  const fullPool = thisOrThatPool[statKey];

  const eligible = fullPool.pairs
    .map((pair, i) => ({ pair, i }))
    .filter(({ pair }) => pair[0].fromYear >= cutoff && pair[1].fromYear >= cutoff);

  const used = state.usedQuestionIds.thisOrThat;
  let candidates = eligible.filter(({ i }) => !used.has(`${statKey}:${i}`));
  if (candidates.length < 3) {
    used.clear();
    candidates = eligible;
  }
  candidates = shuffle(candidates);

  const chosen = [];
  const usedPlayers = new Set();
  for (const entry of candidates) {
    if (usedPlayers.has(entry.pair[0].id) || usedPlayers.has(entry.pair[1].id)) continue;
    chosen.push(entry);
    usedPlayers.add(entry.pair[0].id);
    usedPlayers.add(entry.pair[1].id);
    if (chosen.length === 3) break;
  }
  for (const entry of candidates) {
    if (chosen.length >= 3) break;
    if (!chosen.some((c) => c.i === entry.i)) chosen.push(entry);
  }

  chosen.forEach(({ i }) => used.add(`${statKey}:${i}`));
  const pairs = chosen.map(({ pair }) => (Math.random() < 0.5 ? [pair[0], pair[1]] : [pair[1], pair[0]]));

  return { statKey, statLabel: fullPool.label, pairs };
}

function pickFillBlankQuestion() {
  const cutoff = cutoffYear();
  // all-time / all-time-playoffs boards are fixed historical facts, so they're
  // not filtered by difficulty - only season-scope boards are
  const eligible = fillBlankBoards.filter((b) => b.scope !== "season" || b.seasonYear >= cutoff);

  const used = state.usedQuestionIds.fillBlank;
  let candidates = eligible.filter((b) => !used.has(b.id));
  if (candidates.length === 0) {
    used.clear();
    candidates = eligible;
  }
  const board = candidates[Math.floor(Math.random() * candidates.length)];
  used.add(board.id);

  const blankIndex = Math.floor(Math.random() * board.players.length);
  const blanked = board.players[blankIndex];
  return {
    ...board,
    blankIndex,
    answerId: blanked.playerId,
    answerName: blanked.name,
    pos: blanked.pos,
    team: blanked.team,
  };
}

function pickQuestion(topic) {
  if (topic === "thisOrThat") return pickThisOrThatQuestion();
  if (topic === "fillBlank") return pickFillBlankQuestion();

  const cutoff = cutoffYear();
  const poolByTopic = {
    decade: decadeQuestions,
    playerCareer: playerCareerQuestions,
    college: collegeQuestions,
    draft: draftQuestions,
    awardsSeason: awardsSeasonQuestions,
    trophyCase: trophyCaseQuestions,
  };
  const fullPool = poolByTopic[topic];
  const pool = fullPool.filter((q) => {
    if (topic === "decade") return q.decade >= cutoff;
    if (topic === "awardsSeason") return q.seasonYear >= cutoff;
    return q.fromYear >= cutoff;
  });

  const used = state.usedQuestionIds[topic];
  let candidates = pool.filter((q) => !used.has(q.id));
  if (candidates.length === 0) {
    used.clear();
    candidates = pool;
  }
  const q = candidates[Math.floor(Math.random() * candidates.length)];
  used.add(q.id);
  return q;
}

const WIN_MULTIPLIER = { 0: 3, 1: 2, 2: 1 };
const LOSS_MULTIPLIER = { 0: 1, 1: 2, 2: 3 };

function computePayout(wager, hintCount, correct) {
  return correct ? wager * WIN_MULTIPLIER[hintCount] : -(wager * LOSS_MULTIPLIER[hintCount]);
}

// Full stakes table for every hint count, so the user can see the whole
// risk/reward trade-off up front instead of just the tier they're currently at.
function renderStakesTable(wager, currentHintCount) {
  const rows = [0, 1, 2]
    .map((n) => {
      const win = computePayout(wager, n, true);
      const lose = computePayout(wager, n, false);
      const isCurrent = n === currentHintCount;
      return `
        <div class="stakes-row${isCurrent ? " stakes-row-current" : ""}">
          <span class="stakes-hints">${n} hint${n === 1 ? "" : "s"}</span>
          <span class="stakes-win score-positive">+${win}</span>
          <span class="stakes-lose score-negative">${lose}</span>
        </div>
      `;
    })
    .join("");
  return `
    <div class="stakes-table">
      <div class="stakes-row stakes-row-head">
        <span class="stakes-hints">Hints used</span>
        <span>Correct</span>
        <span>Wrong</span>
      </div>
      ${rows}
    </div>
  `;
}

function maxWager() {
  return state.gameLength;
}

function availableWagers() {
  const all = [];
  for (let i = 1; i <= maxWager(); i++) if (!state.usedWagers.has(i)) all.push(i);
  return all;
}

function questionText(topic, q) {
  if (topic === "decade") {
    return `In the <span class="hl">${q.decadeLabel}</span>, which player led the <span class="hl">${q.teamName}</span> in <span class="hl">${q.statLabel.toLowerCase()}</span>, with <span class="hl">${q.value.toLocaleString()}</span>?`;
  }
  if (topic === "college") {
    return `Which college did <span class="hl">${q.name}</span> play for?`;
  }
  if (topic === "draft") {
    return `In the <span class="hl">${q.draftYear}</span> draft, round <span class="hl">${q.round}</span>, pick <span class="hl">${q.pick}</span>, the <span class="hl">${q.teamName}</span> selected... who?`;
  }
  if (topic === "fillBlank") {
    if (q.measure === "roster") {
      return `Here's the <span class="hl">${q.statLabel}</span> — one name is missing. Who is it?`;
    }
    return `Here's the <span class="hl">${q.scopeLabel}</span> Top 5 in <span class="hl">${q.statLabel}</span> — one name is missing. Who is it?`;
  }
  if (topic === "awardsSeason") {
    return `Who won <span class="hl">${q.awardLabel}</span> in the <span class="hl">${q.season}</span> season?`;
  }
  if (topic === "trophyCase") {
    const list = q.accolades.map((a) => `${a.count}x ${a.type}`).join(", ");
    return `Here's a mystery player's career accolades: <span class="hl">${list}</span>. Who is it?`;
  }
  return `Here's a mystery player's season-by-season stat line. Who is it?`;
}

function correctAnswerName(topic, q) {
  if (topic === "decade") return q.answerName;
  if (topic === "college") return q.college;
  if (topic === "fillBlank") return q.answerName;
  return q.name;
}

function isCorrectGuess(topic, q, selectedId) {
  if (topic === "college") return selectedId === q.college;
  if (topic === "fillBlank") return selectedId === q.answerId;
  const answerId = topic === "decade" ? q.answerId : q.playerId;
  return selectedId === answerId;
}

function countThisOrThatCorrect(q, selections) {
  return selections.reduce((count, sel, i) => {
    if (sel === null || sel === undefined) return count;
    const pair = q.pairs[i];
    const isCorrect = pair[sel].value === Math.max(pair[0].value, pair[1].value);
    return count + (isCorrect ? 1 : 0);
  }, 0);
}

// ---------- Rendering ----------
const app = document.getElementById("app");

function render() {
  app.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "wrap";
  wrap.appendChild(renderHeader());
  wrap.appendChild(renderScreen());
  app.appendChild(wrap);
  if (state.showHowToPlay) {
    app.appendChild(renderHowToPlayModal());
  }
  if (state.showWelcome) {
    app.appendChild(renderWelcomeModal());
  }
}

function renderWelcomeModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card">
      <button class="modal-close-btn" id="closeWelcomeX" aria-label="Close">&times;</button>
      <h2 class="screen-title">Welcome to Quizzy!</h2>
      <div class="modal-body" style="text-align:center;">
        <p>Spin the wheel across different NBA trivia topics, wager points on how confident you are, and race a 1 minute clock to answer. Hints can help — but they'll cost you, so it's really a bet on yourself. See how high you can score!</p>
      </div>
    </div>
  `;
  const close = () => {
    state.showWelcome = false;
    render();
  };
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector("#closeWelcomeX").addEventListener("click", close);
  return overlay;
}

function renderHeader() {
  const div = document.createElement("div");
  div.className = "app-header";
  div.innerHTML = `
    <button class="how-to-play-btn" id="howToPlayBtn">How to Play</button>
    <div class="brand-row">
      <img class="brand-logo" src="logo.png" alt="Quizzy logo" />
      <h1 class="brand">Quizzy</h1>
    </div>
    <p class="tagline">Wager your NBA knowledge, one round at a time.</p>
    <div class="brand-dots"><span></span><span></span><span></span></div>
  `;
  div.querySelector("#howToPlayBtn").addEventListener("click", () => {
    state.showHowToPlay = true;
    render();
  });
  return div;
}

function renderHowToPlayModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card">
      <button class="modal-close-btn" id="closeHowToPlayX" aria-label="Close">&times;</button>
      <h2 class="screen-title">How to Play</h2>
      <div class="modal-body">
        <p><strong>1. Set up your game.</strong> Choose 5 or 10 questions, and a difficulty: Easy (2000-Present), Medium (1980-Present), or Hard (All-Time).</p>
        <p><strong>2. Spin the wheel.</strong> It lands on one of ${TOPIC_ORDER.length} topics.</p>
        <p><strong>3. Wager on your confidence.</strong> Pick a number from 1 up to your game length — the more sure you are, the more you should bet. Each number can only be used once per game.</p>
        <p><strong>4. Beat the clock.</strong> You get 60 seconds to answer. Revealing a hint resets the clock back to 60. Run out of time and it's scored as a wrong answer.</p>
        <p><strong>5. Hints are a gamble, not a safety net.</strong> Tapping a hint can help you get there — but it shrinks your reward if you're right, and raises your penalty if you're still wrong. Going in on your own knowledge pays the most and costs the least; leaning on hints pays less and costs more. Check the stakes table on each question to see exactly what's on the line before you tap anything.</p>
        <p>Rack up points across every round and see how high you can score!</p>
      </div>
      <button class="btn btn-primary btn-lg" id="closeHowToPlay">Got It</button>
    </div>
  `;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      state.showHowToPlay = false;
      render();
    }
  });
  overlay.querySelector("#closeHowToPlay").addEventListener("click", () => {
    state.showHowToPlay = false;
    render();
  });
  overlay.querySelector("#closeHowToPlayX").addEventListener("click", () => {
    state.showHowToPlay = false;
    render();
  });
  return overlay;
}

function statusBar() {
  const div = document.createElement("div");
  div.className = "status-bar";
  div.innerHTML = `
    <div class="status-pill">Round <strong>${state.round + 1}</strong> / ${state.gameLength}</div>
    <div class="status-pill">Left: <strong>${availableWagers().join(", ") || "—"}</strong></div>
  `;
  return div;
}

function scoreBadge() {
  const div = document.createElement("div");
  div.className = "score-badge";
  const scoreClass = state.totalScore > 0 ? "score-positive" : state.totalScore < 0 ? "score-negative" : "";
  div.innerHTML = `
    <span class="score-badge-label">Score</span>
    <span class="score-badge-value ${scoreClass}">${state.totalScore > 0 ? "+" : ""}${state.totalScore}</span>
  `;
  return div;
}

function progressBar() {
  const div = document.createElement("div");
  div.className = "progress-track";
  const pct = (state.round / state.gameLength) * 100;
  div.innerHTML = `<div class="progress-fill" style="width:${pct}%"></div>`;
  return div;
}

function renderTimer() {
  const el = document.createElement("div");
  el.className = "timer-display";
  el.id = "timerDisplay";
  el.textContent = formatTimer(timerSecondsLeft);
  return el;
}

function renderScreen() {
  switch (state.screen) {
    case "start": return screenStart();
    case "wheel": return screenWheel();
    case "wager": return screenWager();
    case "question": return screenQuestion();
    case "result": return screenResult();
    case "end": return screenEnd();
    default: return document.createElement("div");
  }
}

// ---------- Screens ----------
function screenStart() {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <h2 class="screen-title">How many questions?</h2>
    <div class="choice-row">
      <button class="length-card ${state.gameLength === 5 ? "selected" : ""}" data-len="5">
        <div class="length-num">5</div>
        <div class="length-label">Quick Game</div>
      </button>
      <button class="length-card ${state.gameLength === 10 ? "selected" : ""}" data-len="10">
        <div class="length-num">10</div>
        <div class="length-label">Full Game</div>
      </button>
    </div>
    <h2 class="screen-title">Choose your difficulty</h2>
    <div class="choice-row">
      ${Object.entries(DIFFICULTY_LEVELS)
        .map(
          ([key, d]) => `
        <button class="length-card difficulty-card ${state.difficulty === key ? "selected" : ""}" data-diff="${key}">
          <div class="difficulty-label">${d.label}</div>
          <div class="length-label">${d.description}</div>
        </button>
      `
        )
        .join("")}
    </div>
    <button class="btn btn-primary btn-lg" id="startBtn">Start Game</button>
  `;
  card.querySelectorAll(".length-card[data-len]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.gameLength = Number(btn.dataset.len);
      render();
    });
  });
  card.querySelectorAll(".difficulty-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.difficulty = btn.dataset.diff;
      render();
    });
  });
  card.querySelector("#startBtn").addEventListener("click", () => {
    state.screen = "wheel";
    render();
  });
  return card;
}

function screenWheel() {
  const card = document.createElement("div");
  card.className = "card";

  const segTopics = TOPIC_ORDER.slice();
  const segCount = segTopics.length;
  const segAngle = 360 / segCount;
  const segColorHex = {
    decade: "#ff6b35",
    playerCareer: "#0071e3",
    thisOrThat: "#22a06b",
    college: "#a855f7",
    draft: "#e0357a",
    fillBlank: "#f2b705",
    awardsSeason: "#0891b2",
    trophyCase: "#92400e",
  };
  const gradientStops = segTopics
    .map((t, i) => `${segColorHex[t]} ${i * segAngle}deg ${(i + 1) * segAngle}deg`)
    .join(", ");

  card.innerHTML = `
    <h2 class="screen-title">Spin for your topic</h2>
    <div class="wheel-stage">
      <div class="wheel-pointer"></div>
      <div class="wheel" id="wheel" style="background: conic-gradient(${gradientStops}); transform: rotate(${state.wheelRotation}deg);">
        ${segTopics
          .map((t, i) => {
            const angle = i * segAngle + segAngle / 2;
            const rad = (angle * Math.PI) / 180;
            const radius = window.matchMedia("(max-width: 480px)").matches ? 76 : 108;
            const dx = radius * Math.sin(rad);
            const dy = -radius * Math.cos(rad);
            return `<div class="wheel-label" style="left: calc(50% + ${dx}px); top: calc(50% + ${dy}px);">${TOPIC_META[t].title}</div>`;
          })
          .join("")}
        <div class="wheel-hub"></div>
      </div>
    </div>
    <div class="spin-result" id="spinResult"></div>
    <button class="btn btn-primary btn-lg" id="spinBtn">Spin the Wheel</button>
  `;

  const wheelEl = card.querySelector("#wheel");
  const spinBtn = card.querySelector("#spinBtn");
  const resultEl = card.querySelector("#spinResult");

  spinBtn.addEventListener("click", () => {
    spinBtn.disabled = true;
    const topic = TOPIC_ORDER[Math.floor(Math.random() * TOPIC_ORDER.length)];
    const matchingIdx = segTopics.map((t, i) => (t === topic ? i : -1)).filter((i) => i >= 0);
    const idx = matchingIdx[Math.floor(Math.random() * matchingIdx.length)];
    const jitter = (Math.random() - 0.5) * (segAngle * 0.6);
    const segCenter = idx * segAngle + segAngle / 2 + jitter;
    const extraSpins = 6 * 360;
    const targetWithinCircle = (360 - segCenter + 360) % 360;
    const newRotation = state.wheelRotation - (state.wheelRotation % 360) + extraSpins + targetWithinCircle;

    state.wheelRotation = newRotation;
    wheelEl.style.transform = `rotate(${newRotation}deg)`;

    const WHEEL_SPIN_MS = 4200;
    setTimeout(() => {
      state.current.topic = topic;
      state.current.question = pickQuestion(topic);
      state.current.totSelections = [null, null, null];
      state.current.totSubmitted = false;
      state.current.selectedPlayer = null;
      state.current.selectedCollege = null;
      state.current.hintsRevealed = [];
      resultEl.textContent = `${TOPIC_META[topic].title}!`;
      resultEl.style.color = TOPIC_META[topic].color;
      setTimeout(() => {
        state.screen = "wager";
        render();
      }, 700);
    }, WHEEL_SPIN_MS);
  });

  return card;
}

function screenWager() {
  const card = document.createElement("div");
  card.className = "card";
  card.appendChild(scoreBadge());
  card.appendChild(progressBar());
  card.appendChild(statusBar());

  const topic = state.current.topic;
  const title = document.createElement("h2");
  title.className = "screen-title";
  title.innerHTML = `<span class="topic-badge" style="color:${TOPIC_META[topic].color}">${TOPIC_META[topic].title}</span>`;
  card.appendChild(title);

  const desc = document.createElement("p");
  desc.className = "tagline";
  desc.textContent = TOPIC_META[topic].description;
  card.appendChild(desc);

  const sub = document.createElement("p");
  sub.className = "tagline";
  sub.textContent = "Choose how many points to wager on this round. Each number can only be used once.";
  card.appendChild(sub);

  const grid = document.createElement("div");
  grid.className = "wager-grid";
  for (let i = 1; i <= maxWager(); i++) {
    const btn = document.createElement("button");
    btn.className = "wager-btn";
    btn.textContent = i;
    const used = state.usedWagers.has(i);
    btn.disabled = used;
    if (state.current.wager === i) btn.classList.add("selected");
    btn.addEventListener("click", () => {
      state.current.wager = i;
      render();
    });
    grid.appendChild(btn);
  }
  card.appendChild(grid);

  const confirmBtn = document.createElement("button");
  confirmBtn.className = "btn btn-primary btn-lg";
  confirmBtn.textContent = "Lock In Wager";
  confirmBtn.disabled = state.current.wager === null;
  confirmBtn.addEventListener("click", () => {
    state.usedWagers.add(state.current.wager);
    state.screen = "question";
    render();
  });
  card.appendChild(confirmBtn);

  return card;
}

function screenQuestion() {
  const topic = state.current.topic;
  if (topic === "thisOrThat") return screenThisOrThat();

  const card = document.createElement("div");
  card.className = "card";
  card.appendChild(scoreBadge());
  card.appendChild(progressBar());
  card.appendChild(statusBar());

  const q = state.current.question;

  ensureTimer(`round-${state.round}`, () => {
    const hintCount = state.current.hintsRevealed.length;
    const delta = computePayout(state.current.wager, hintCount, false);
    state.totalScore += delta;
    state.history.push({
      topic,
      wager: state.current.wager,
      hints: hintCount,
      correct: false,
      delta,
      answer: correctAnswerName(topic, q),
      guessed: "(ran out of time)",
    });
    stopTimer();
    state.screen = "result";
    render();
  });

  const badge = document.createElement("div");
  badge.innerHTML = `<span class="topic-badge" style="color:${TOPIC_META[topic].color}">${TOPIC_META[topic].title}</span>`;
  card.appendChild(badge);

  card.appendChild(renderTimer());

  const qBlock = document.createElement("div");
  qBlock.className = "question-block";
  qBlock.innerHTML = `<div class="question-text">${questionText(topic, q)}</div>`;
  card.appendChild(qBlock);

  if (topic === "playerCareer") {
    card.appendChild(renderPlayerCareerTable(q, state.current.hintsRevealed));
  }
  if (topic === "fillBlank") {
    card.appendChild(renderFillBlankBoard(q));
  }

  const reminder = document.createElement("div");
  reminder.className = "wager-reminder";
  reminder.innerHTML = `Wagering <strong>${state.current.wager}</strong> point${state.current.wager === 1 ? "" : "s"}`;
  card.appendChild(reminder);

  const hintRow = document.createElement("div");
  hintRow.className = "hint-row";
  HINTS[topic].forEach((hint) => {
    const btn = document.createElement("button");
    const revealed = state.current.hintsRevealed.includes(hint.key);
    btn.className = "hint-btn" + (revealed ? " revealed" : "");
    if (topic === "playerCareer") {
      btn.innerHTML = revealed
        ? `<span class="hint-label">${hint.label}</span><span class="hint-value">Shown in table</span>`
        : `<span class="hint-label">${hint.label}</span><span class="hint-value">Tap to reveal</span>`;
    } else {
      btn.innerHTML = revealed
        ? `<span class="hint-label">${hint.label}</span><span class="hint-value">${hint.value(q)}</span>`
        : `<span class="hint-label">${hint.label}</span><span class="hint-value">Tap to reveal</span>`;
    }
    btn.addEventListener("click", () => {
      if (!state.current.hintsRevealed.includes(hint.key)) {
        state.current.hintsRevealed.push(hint.key);
        resetTimer();
        render();
      }
    });
    hintRow.appendChild(btn);
  });
  card.appendChild(hintRow);

  const hintCount = state.current.hintsRevealed.length;
  const stakes = document.createElement("div");
  stakes.innerHTML = renderStakesTable(state.current.wager, hintCount);
  card.appendChild(stakes);

  card.appendChild(topic === "college" ? renderCollegeSearch() : renderPlayerSearch());

  const submitBtn = document.createElement("button");
  submitBtn.className = "btn btn-primary btn-lg";
  submitBtn.textContent = "Submit Guess";
  const selectedAnswer = topic === "college" ? state.current.selectedCollege : state.current.selectedPlayer;
  submitBtn.disabled = !selectedAnswer;
  submitBtn.addEventListener("click", () => {
    const guessed = topic === "college" ? state.current.selectedCollege : state.current.selectedPlayer.id;
    const correct = isCorrectGuess(topic, q, guessed);
    const delta = computePayout(state.current.wager, hintCount, correct);
    state.totalScore += delta;
    state.history.push({
      topic,
      wager: state.current.wager,
      hints: hintCount,
      correct,
      delta,
      answer: correctAnswerName(topic, q),
      guessed: topic === "college" ? state.current.selectedCollege : state.current.selectedPlayer.name,
    });
    stopTimer();
    state.screen = "result";
    render();
  });
  card.appendChild(submitBtn);

  return card;
}

function renderPlayerCareerTable(q, hintsRevealed) {
  const showPos = hintsRevealed.includes("pos");
  const showAwards = hintsRevealed.includes("awards");

  const wrap = document.createElement("div");
  wrap.className = "career-table-wrap";

  const headCells = ["Season"];
  if (showPos) headCells.push("Pos");
  headCells.push("Team", "G", "GS", "MPG", "PTS", "REB", "AST");
  if (showAwards) headCells.push("Awards");

  const fmt1 = (v) => (typeof v === "number" ? v.toFixed(1) : v);

  const bodyRows = q.seasons
    .map((s) => {
      const cells = [s.season];
      if (showPos) cells.push(s.pos || "—");
      cells.push(s.team || "—", s.g, s.gs, fmt1(s.mpg), fmt1(s.pts), fmt1(s.trb), fmt1(s.ast));
      if (showAwards) cells.push(s.awards || "—");
      return `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
    })
    .join("");

  wrap.innerHTML = `
    <table class="career-table">
      <thead><tr>${headCells.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;
  return wrap;
}

function renderFillBlankBoard(q) {
  const wrap = document.createElement("div");
  wrap.className = "career-table-wrap fill-blank-wrap";
  const isRoster = q.measure === "roster";

  const rows = q.players
    .map((p, i) => {
      const isBlank = i === q.blankIndex;
      const nameCell = isBlank ? `<span class="fb-blank">???</span>` : p.name;
      const valueCell = isRoster
        ? ""
        : `<td>${q.measure === "perGame" ? p.value.toFixed(1) : p.value.toLocaleString()}</td>`;
      return `<tr${isBlank ? ' class="fb-blank-row"' : ""}><td>${i + 1}</td><td>${nameCell}</td>${valueCell}</tr>`;
    })
    .join("");

  const headCells = isRoster ? `<th>#</th><th>Player</th>` : `<th>Rank</th><th>Player</th><th>${q.statLabel}</th>`;

  wrap.innerHTML = `
    <table class="career-table fill-blank-table">
      <thead><tr>${headCells}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  return wrap;
}

function renderPlayerSearch() {
  const wrap = document.createElement("div");
  wrap.className = "search-wrap";

  if (state.current.selectedPlayer) {
    wrap.innerHTML = `
      <div class="selected-player">
        <span>${state.current.selectedPlayer.name}</span>
        <button id="changePlayerBtn">Change</button>
      </div>
    `;
    wrap.querySelector("#changePlayerBtn").addEventListener("click", () => {
      state.current.selectedPlayer = null;
      render();
    });
    return wrap;
  }

  wrap.innerHTML = `
    <input type="text" class="search-input" id="playerSearchInput" placeholder="Search for a player..." autocomplete="off" />
    <div class="search-results" id="playerSearchResults" style="display:none;"></div>
  `;

  const input = wrap.querySelector("#playerSearchInput");
  const results = wrap.querySelector("#playerSearchResults");

  input.addEventListener("input", () => {
    const term = input.value.trim().toLowerCase();
    if (term.length < 2) {
      results.style.display = "none";
      results.innerHTML = "";
      return;
    }
    const matches = playersSearch.filter((p) => p.name.toLowerCase().includes(term)).slice(0, 8);
    if (matches.length === 0) {
      results.style.display = "none";
      results.innerHTML = "";
      return;
    }
    results.innerHTML = matches
      .map((p) => `<div class="search-result-item" data-id="${p.id}" data-name="${p.name.replace(/"/g, "&quot;")}">${p.name}</div>`)
      .join("");
    results.style.display = "block";
    results.querySelectorAll(".search-result-item").forEach((item) => {
      item.addEventListener("click", () => {
        state.current.selectedPlayer = { id: item.dataset.id, name: item.dataset.name };
        render();
      });
    });
  });

  return wrap;
}

function renderCollegeSearch() {
  const wrap = document.createElement("div");
  wrap.className = "search-wrap";

  if (state.current.selectedCollege) {
    wrap.innerHTML = `
      <div class="selected-player">
        <span>${state.current.selectedCollege}</span>
        <button id="changeCollegeBtn">Change</button>
      </div>
    `;
    wrap.querySelector("#changeCollegeBtn").addEventListener("click", () => {
      state.current.selectedCollege = null;
      render();
    });
    return wrap;
  }

  wrap.innerHTML = `
    <input type="text" class="search-input" id="collegeSearchInput" placeholder="Search for a college..." autocomplete="off" />
    <div class="search-results" id="collegeSearchResults" style="display:none;"></div>
  `;

  const input = wrap.querySelector("#collegeSearchInput");
  const results = wrap.querySelector("#collegeSearchResults");

  input.addEventListener("input", () => {
    const term = input.value.trim().toLowerCase();
    if (term.length < 2) {
      results.style.display = "none";
      results.innerHTML = "";
      return;
    }
    const matches = collegesSearch.filter((c) => c.toLowerCase().includes(term)).slice(0, 8);
    if (matches.length === 0) {
      results.style.display = "none";
      results.innerHTML = "";
      return;
    }
    results.innerHTML = matches
      .map((c) => `<div class="search-result-item" data-college="${c.replace(/"/g, "&quot;")}">${c}</div>`)
      .join("");
    results.style.display = "block";
    results.querySelectorAll(".search-result-item").forEach((item) => {
      item.addEventListener("click", () => {
        state.current.selectedCollege = item.dataset.college;
        render();
      });
    });
  });

  return wrap;
}

function screenThisOrThat() {
  const card = document.createElement("div");
  card.className = "card";
  card.appendChild(scoreBadge());
  card.appendChild(progressBar());
  card.appendChild(statusBar());

  const q = state.current.question;
  const topic = "thisOrThat";
  const revealed = state.current.totSubmitted;

  const hintCount = state.current.hintsRevealed.length;

  if (!revealed) {
    ensureTimer(`round-${state.round}`, () => {
      const correctCount = countThisOrThatCorrect(q, state.current.totSelections);
      const delta = computePayout(state.current.wager, hintCount, false);
      state.totalScore += delta;
      state.history.push({
        topic,
        wager: state.current.wager,
        hints: hintCount,
        correct: false,
        delta,
        statLabel: q.statLabel,
        correctCount,
      });
      stopTimer();
      state.screen = "result";
      render();
    });
  }

  const badge = document.createElement("div");
  badge.innerHTML = `<span class="topic-badge" style="color:${TOPIC_META.thisOrThat.color}">${TOPIC_META.thisOrThat.title}</span>`;
  card.appendChild(badge);

  if (!revealed) card.appendChild(renderTimer());

  const header = document.createElement("div");
  header.className = "question-block";
  header.innerHTML = revealed
    ? `<div class="question-text">Who had more <span class="hl">${q.statLabel}</span>?</div>`
    : `
    <div class="question-text">Who had more <span class="hl">${q.statLabel}</span>? Pick all three, then submit.</div>
    <div class="wager-reminder">Wagering <strong>${state.current.wager}</strong> point${state.current.wager === 1 ? "" : "s"}</div>
  `;
  card.appendChild(header);

  if (!revealed) {
    const hintRow = document.createElement("div");
    hintRow.className = "hint-row";
    HINTS.thisOrThat.forEach((hint) => {
      const btn = document.createElement("button");
      const hintRevealed = state.current.hintsRevealed.includes(hint.key);
      btn.className = "hint-btn" + (hintRevealed ? " revealed" : "");
      btn.innerHTML = hintRevealed
        ? `<span class="hint-label">${hint.label}</span><span class="hint-value">Shown below each name</span>`
        : `<span class="hint-label">${hint.label}</span><span class="hint-value">Tap to reveal</span>`;
      btn.addEventListener("click", () => {
        if (!state.current.hintsRevealed.includes(hint.key)) {
          state.current.hintsRevealed.push(hint.key);
          resetTimer();
          render();
        }
      });
      hintRow.appendChild(btn);
    });
    card.appendChild(hintRow);
  }

  const list = document.createElement("div");
  list.className = "tot-list";

  const hintSuffix = { g: "G", mpg: "MPG" };
  const playerHints = (player) =>
    state.current.hintsRevealed
      .map((key) => `<span class="tot-hint">${player[key === "g" ? "careerG" : "careerMpg"].toLocaleString()} ${hintSuffix[key]}</span>`)
      .join("");

  q.pairs.forEach((pair, i) => {
    const row = document.createElement("div");
    row.className = "tot-row";
    row.innerHTML = `<div class="tot-row-label">Match-up ${i + 1}</div>`;

    const matchup = document.createElement("div");
    matchup.className = "tot-matchup";
    const correctSide = pair[0].value > pair[1].value ? 0 : 1;

    pair.forEach((player, side) => {
      const btn = document.createElement("button");
      btn.className = "tot-choice";
      if (revealed) {
        btn.disabled = true;
        if (side === correctSide) btn.classList.add("tot-choice-correct");
        else if (state.current.totSelections[i] === side) btn.classList.add("tot-choice-wrong");
        btn.innerHTML = `<span class="tot-name">${player.name}</span>${playerHints(player)}<span class="tot-value">${player.value.toLocaleString()}</span>`;
      } else {
        if (state.current.totSelections[i] === side) btn.classList.add("tot-choice-selected");
        btn.innerHTML = `<span class="tot-name">${player.name}</span>${playerHints(player)}`;
        btn.addEventListener("click", () => {
          state.current.totSelections[i] = side;
          render();
        });
      }
      matchup.appendChild(btn);
    });

    const vs = document.createElement("div");
    vs.className = "tot-vs";
    vs.textContent = "VS";
    matchup.appendChild(vs);

    row.appendChild(matchup);
    list.appendChild(row);
  });

  card.appendChild(list);

  if (revealed) {
    const correctCount = countThisOrThatCorrect(q, state.current.totSelections);
    const summary = document.createElement("div");
    summary.className = "result-detail";
    summary.textContent = `You got ${correctCount} of 3 right.`;
    card.appendChild(summary);

    const finishBtn = document.createElement("button");
    finishBtn.className = "btn btn-primary btn-lg";
    finishBtn.textContent = "See Round Result";
    finishBtn.addEventListener("click", () => {
      const allCorrect = correctCount === 3;
      const delta = computePayout(state.current.wager, hintCount, allCorrect);
      state.totalScore += delta;
      state.history.push({
        topic,
        wager: state.current.wager,
        hints: hintCount,
        correct: allCorrect,
        delta,
        statLabel: q.statLabel,
        correctCount,
      });
      state.screen = "result";
      render();
    });
    card.appendChild(finishBtn);
    return card;
  }

  const stakesNote = document.createElement("div");
  stakesNote.className = "tagline";
  stakesNote.style.marginBottom = "-6px";
  stakesNote.textContent = "\"Correct\" = all 3 right. \"Wrong\" = anything else.";
  card.appendChild(stakesNote);

  const stakes = document.createElement("div");
  stakes.innerHTML = renderStakesTable(state.current.wager, hintCount);
  card.appendChild(stakes);

  const allSelected = state.current.totSelections.every((s) => s !== null);
  const submitBtn = document.createElement("button");
  submitBtn.className = "btn btn-primary btn-lg";
  submitBtn.textContent = "Submit All 3";
  submitBtn.disabled = !allSelected;
  submitBtn.addEventListener("click", () => {
    stopTimer();
    state.current.totSubmitted = true;
    render();
  });
  card.appendChild(submitBtn);

  return card;
}

function screenResult() {
  const card = document.createElement("div");
  card.className = "card";
  card.appendChild(scoreBadge());
  card.appendChild(progressBar());
  card.appendChild(statusBar());

  const last = state.history[state.history.length - 1];
  const icon = last.correct ? "🎯" : "❌";
  const titleClass = last.correct ? "correct" : "wrong";

  let detailHtml;
  if (last.topic === "thisOrThat") {
    detailHtml = last.correct
      ? `You went 3-for-3 on <strong>${last.statLabel}</strong>.`
      : `You went ${last.correctCount}/3 on <strong>${last.statLabel}</strong>.`;
  } else if (last.correct) {
    detailHtml = `You guessed <strong>${last.guessed}</strong> — nailed it.`;
  } else if (last.guessed === "(ran out of time)") {
    detailHtml = `Time ran out. The correct answer was <strong>${last.answer}</strong>.`;
  } else {
    detailHtml = `You guessed <strong>${last.guessed}</strong>. The correct answer was <strong>${last.answer}</strong>.`;
  }

  const block = document.createElement("div");
  block.style.display = "flex";
  block.style.flexDirection = "column";
  block.style.alignItems = "center";
  block.style.gap = "14px";
  block.innerHTML = `
    <div class="result-icon">${icon}</div>
    <div class="result-title ${titleClass}">${last.correct ? "Correct!" : "Not Quite"}</div>
    <div class="points-delta ${last.delta >= 0 ? "score-positive" : "score-negative"}">${last.delta > 0 ? "+" : ""}${last.delta}</div>
    <div class="result-detail">${detailHtml}</div>
  `;
  card.appendChild(block);

  const nextBtn = document.createElement("button");
  nextBtn.className = "btn btn-primary btn-lg";
  const isLast = state.round + 1 >= state.gameLength;
  nextBtn.textContent = isLast ? "See Final Results" : "Next Round";
  nextBtn.addEventListener("click", () => {
    state.round += 1;
    state.current = {
      topic: null,
      question: null,
      wager: null,
      hintsRevealed: [],
      selectedPlayer: null,
      selectedCollege: null,
      totSelections: [null, null, null],
      totSubmitted: false,
    };
    if (state.round >= state.gameLength) {
      state.screen = "end";
    } else {
      state.screen = "wheel";
    }
    render();
  });
  card.appendChild(nextBtn);

  return card;
}

function screenEnd() {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<h2 class="screen-title">Game Over</h2>`;

  const scoreEl = document.createElement("div");
  scoreEl.className = "final-score";
  scoreEl.textContent = `${state.totalScore > 0 ? "+" : ""}${state.totalScore}`;
  card.appendChild(scoreEl);

  const history = document.createElement("div");
  history.className = "round-history";
  history.innerHTML = state.history
    .map(
      (h, i) => `
      <div class="round-row">
        <span class="rr-topic">#${i + 1} · ${TOPIC_META[h.topic].title} · wagered ${h.wager}</span>
        <span class="rr-delta ${h.delta >= 0 ? "score-positive" : "score-negative"}">${h.delta > 0 ? "+" : ""}${h.delta}</span>
      </div>`
    )
    .join("");
  card.appendChild(history);

  const again = document.createElement("button");
  again.className = "btn btn-primary btn-lg";
  again.textContent = "Play Again";
  again.addEventListener("click", () => {
    state = freshState();
    render();
  });
  card.appendChild(again);

  return card;
}

// ---------- Boot ----------
async function loadData() {
  const [d, pc, tot, cq, cs, dq, p, fb, as, tc] = await Promise.all([
    fetch("data/decade_questions.json").then((r) => r.json()),
    fetch("data/player_career_questions.json").then((r) => r.json()),
    fetch("data/this_or_that_pool.json").then((r) => r.json()),
    fetch("data/college_questions.json").then((r) => r.json()),
    fetch("data/colleges_search.json").then((r) => r.json()),
    fetch("data/draft_questions.json").then((r) => r.json()),
    fetch("data/players_search.json").then((r) => r.json()),
    fetch("data/fill_blank_boards.json").then((r) => r.json()),
    fetch("data/awards_season_questions.json").then((r) => r.json()),
    fetch("data/trophy_case_questions.json").then((r) => r.json()),
  ]);
  decadeQuestions = d;
  playerCareerQuestions = pc;
  thisOrThatPool = tot;
  collegeQuestions = cq;
  collegesSearch = cs;
  draftQuestions = dq;
  playersSearch = p;
  fillBlankBoards = fb;
  awardsSeasonQuestions = as;
  trophyCaseQuestions = tc;
}

loadData().then(render);

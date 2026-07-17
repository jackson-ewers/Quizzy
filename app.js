// ---------- Data ----------
let decadeQuestions = [];
let playerCareerQuestions = [];
let thisOrThatPool = {};
let playersSearch = [];

const TOPIC_ORDER = ["decade", "playerCareer", "thisOrThat"];

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
      "You'll face 3 head-to-head match-ups, one at a time, for a randomly picked career stat — guess who had more of it, all three times, to win.",
  },
};

const HINTS = {
  decade: [
    { key: "pos", label: "Position", value: (q) => q.pos },
    { key: "years", label: "Years Active", value: (q) => q.years },
  ],
  playerCareer: [
    { key: "pos", label: "Position (per season)" },
    { key: "team", label: "Team (per season)" },
  ],
  thisOrThat: [],
};

// ---------- State ----------
function freshState() {
  return {
    screen: "start",
    gameLength: 5,
    totalScore: 0,
    usedWagers: new Set(),
    round: 0,
    history: [],
    usedQuestionIds: { decade: new Set(), playerCareer: new Set(), thisOrThat: new Set() },
    wheelRotation: 0,
    current: {
      topic: null,
      question: null,
      wager: null,
      hintsRevealed: [],
      selectedPlayer: null,
      totIndex: 0,
      totResults: [],
    },
  };
}
let state = freshState();

// ---------- Utilities ----------
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickThisOrThatQuestion() {
  const statKeys = Object.keys(thisOrThatPool);
  const statKey = statKeys[Math.floor(Math.random() * statKeys.length)];
  const pool = thisOrThatPool[statKey];
  const used = state.usedQuestionIds.thisOrThat;

  let indices = pool.pairs.map((_, i) => i).filter((i) => !used.has(`${statKey}:${i}`));
  if (indices.length < 3) {
    used.clear();
    indices = pool.pairs.map((_, i) => i);
  }
  indices = shuffle(indices);

  const chosen = [];
  const usedPlayers = new Set();
  for (const idx of indices) {
    const [a, b] = pool.pairs[idx];
    if (usedPlayers.has(a.id) || usedPlayers.has(b.id)) continue;
    chosen.push(idx);
    usedPlayers.add(a.id);
    usedPlayers.add(b.id);
    if (chosen.length === 3) break;
  }
  for (const idx of indices) {
    if (chosen.length >= 3) break;
    if (!chosen.includes(idx)) chosen.push(idx);
  }

  chosen.forEach((idx) => used.add(`${statKey}:${idx}`));
  const pairs = chosen.map((idx) => {
    const [a, b] = pool.pairs[idx];
    return Math.random() < 0.5 ? [a, b] : [b, a];
  });

  return { statKey, statLabel: pool.label, pairs };
}

function pickQuestion(topic) {
  if (topic === "thisOrThat") return pickThisOrThatQuestion();

  const pool = topic === "decade" ? decadeQuestions : playerCareerQuestions;
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
  return `Here's a mystery player's season-by-season stat line. Who is it?`;
}

function correctAnswerName(topic, q) {
  return topic === "decade" ? q.answerName : q.name;
}

function isCorrectGuess(topic, q, selectedId) {
  const answerId = topic === "decade" ? q.answerId : q.playerId;
  return selectedId === answerId;
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
}

function renderHeader() {
  const div = document.createElement("div");
  div.style.textAlign = "center";
  div.style.display = "flex";
  div.style.flexDirection = "column";
  div.style.gap = "6px";
  div.innerHTML = `<h1 class="brand">Hoops IQ</h1><p class="tagline">Wager your NBA knowledge, one round at a time.</p>`;
  return div;
}

function statusBar() {
  const div = document.createElement("div");
  div.className = "status-bar";
  const scoreClass = state.totalScore > 0 ? "score-positive" : state.totalScore < 0 ? "score-negative" : "";
  div.innerHTML = `
    <div class="status-pill">Round <strong>${state.round + 1}</strong> / ${state.gameLength}</div>
    <div class="status-pill">Score <strong class="${scoreClass}">${state.totalScore > 0 ? "+" : ""}${state.totalScore}</strong></div>
    <div class="status-pill">Left: <strong>${availableWagers().join(", ") || "—"}</strong></div>
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
    <button class="btn btn-primary btn-lg" id="startBtn">Start Game</button>
  `;
  card.querySelectorAll(".length-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.gameLength = Number(btn.dataset.len);
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

  const cyclesCount = 2;
  const segTopics = [];
  for (let i = 0; i < cyclesCount; i++) segTopics.push(...TOPIC_ORDER);
  const segCount = segTopics.length;
  const segAngle = 360 / segCount;
  const segColorHex = { decade: "#ff6b35", playerCareer: "#0071e3", thisOrThat: "#22a06b" };
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
            return `<div class="wheel-label" style="transform: rotate(${angle}deg);">${TOPIC_META[t].title}</div>`;
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
      state.current.totIndex = 0;
      state.current.totResults = [];
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
  card.appendChild(progressBar());
  card.appendChild(statusBar());

  const q = state.current.question;

  const badge = document.createElement("div");
  badge.innerHTML = `<span class="topic-badge" style="color:${TOPIC_META[topic].color}">${TOPIC_META[topic].title}</span>`;
  card.appendChild(badge);

  const qBlock = document.createElement("div");
  qBlock.className = "question-block";
  qBlock.innerHTML = `<div class="question-text">${questionText(topic, q)}</div>`;
  card.appendChild(qBlock);

  if (topic === "playerCareer") {
    card.appendChild(renderPlayerCareerTable(q, state.current.hintsRevealed));
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
        render();
      }
    });
    hintRow.appendChild(btn);
  });
  card.appendChild(hintRow);

  const hintCount = state.current.hintsRevealed.length;
  const payoutWin = computePayout(state.current.wager, hintCount, true);
  const payoutLose = computePayout(state.current.wager, hintCount, false);
  const payoutPreview = document.createElement("div");
  payoutPreview.className = "payout-preview";
  payoutPreview.innerHTML = `Correct: <strong class="score-positive">+${payoutWin}</strong> &nbsp;·&nbsp; Wrong: <strong class="score-negative">${payoutLose}</strong> &nbsp;<span style="opacity:.6">(${hintCount} hint${hintCount === 1 ? "" : "s"} used)</span>`;
  card.appendChild(payoutPreview);

  card.appendChild(renderPlayerSearch());

  const submitBtn = document.createElement("button");
  submitBtn.className = "btn btn-primary btn-lg";
  submitBtn.textContent = "Submit Guess";
  submitBtn.disabled = !state.current.selectedPlayer;
  submitBtn.addEventListener("click", () => {
    const guessedId = state.current.selectedPlayer.id;
    const correct = isCorrectGuess(topic, q, guessedId);
    const delta = computePayout(state.current.wager, hintCount, correct);
    state.totalScore += delta;
    state.history.push({
      topic,
      wager: state.current.wager,
      hints: hintCount,
      correct,
      delta,
      answer: correctAnswerName(topic, q),
      guessed: state.current.selectedPlayer.name,
    });
    state.screen = "result";
    render();
  });
  card.appendChild(submitBtn);

  return card;
}

function renderPlayerCareerTable(q, hintsRevealed) {
  const showPos = hintsRevealed.includes("pos");
  const showTeam = hintsRevealed.includes("team");

  const wrap = document.createElement("div");
  wrap.className = "career-table-wrap";

  const headCells = ["Season"];
  if (showPos) headCells.push("Pos");
  if (showTeam) headCells.push("Team");
  headCells.push("G", "GS", "PTS", "REB", "AST", "BLK", "STL");

  const bodyRows = q.seasons
    .map((s) => {
      const cells = [s.season];
      if (showPos) cells.push(s.pos || "—");
      if (showTeam) cells.push(s.team || "—");
      cells.push(s.g, s.gs, s.pts.toFixed(1), s.trb.toFixed(1), s.ast.toFixed(1), s.blk.toFixed(1), s.stl.toFixed(1));
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

function screenThisOrThat() {
  const card = document.createElement("div");
  card.className = "card";
  card.appendChild(progressBar());
  card.appendChild(statusBar());

  const q = state.current.question;
  const idx = state.current.totIndex;
  const results = state.current.totResults;

  const badge = document.createElement("div");
  badge.innerHTML = `<span class="topic-badge" style="color:${TOPIC_META.thisOrThat.color}">${TOPIC_META.thisOrThat.title}</span>`;
  card.appendChild(badge);

  const header = document.createElement("div");
  header.className = "question-block";
  header.innerHTML = `
    <div class="question-text">Who had more <span class="hl">${q.statLabel}</span>?</div>
    <div class="wager-reminder">Match-up <strong>${Math.min(idx + 1, 3)}</strong> of 3 &nbsp;·&nbsp; Wagering <strong>${state.current.wager}</strong> point${state.current.wager === 1 ? "" : "s"}</div>
  `;
  card.appendChild(header);

  const dotsRow = document.createElement("div");
  dotsRow.className = "tot-dots";
  dotsRow.innerHTML = [0, 1, 2]
    .map((i) => {
      let cls = "tot-dot";
      if (i < results.length) cls += results[i] ? " tot-dot-correct" : " tot-dot-wrong";
      else if (i === idx) cls += " tot-dot-active";
      return `<span class="${cls}"></span>`;
    })
    .join("");
  card.appendChild(dotsRow);

  if (idx >= 3) {
    // all 3 answered — finalize the round
    const allCorrect = results.every(Boolean);
    const delta = computePayout(state.current.wager, 0, allCorrect);
    const doneBlock = document.createElement("div");
    doneBlock.style.display = "flex";
    doneBlock.style.flexDirection = "column";
    doneBlock.style.alignItems = "center";
    doneBlock.style.gap = "16px";
    doneBlock.innerHTML = `
      <div class="result-detail">${allCorrect ? "You went 3-for-3!" : "You didn't sweep all three match-ups."}</div>
    `;
    const finishBtn = document.createElement("button");
    finishBtn.className = "btn btn-primary btn-lg";
    finishBtn.textContent = "See Round Result";
    finishBtn.addEventListener("click", () => {
      state.totalScore += delta;
      state.history.push({
        topic: "thisOrThat",
        wager: state.current.wager,
        hints: 0,
        correct: allCorrect,
        delta,
        statLabel: q.statLabel,
        correctCount: results.filter(Boolean).length,
      });
      state.screen = "result";
      render();
    });
    doneBlock.appendChild(finishBtn);
    card.appendChild(doneBlock);
    return card;
  }

  const pair = q.pairs[idx];
  const matchup = document.createElement("div");
  matchup.className = "tot-matchup";

  const answered = idx < results.length;

  pair.forEach((player, side) => {
    const btn = document.createElement("button");
    btn.className = "tot-choice";
    btn.innerHTML = `<span class="tot-name">${player.name}</span>`;
    if (answered) {
      btn.disabled = true;
      const isWinner = player.value === Math.max(pair[0].value, pair[1].value);
      if (isWinner) btn.classList.add("tot-choice-correct");
      btn.querySelector(".tot-name").insertAdjacentHTML(
        "afterend",
        `<span class="tot-value">${player.value.toLocaleString()}</span>`
      );
    }
    btn.addEventListener("click", () => {
      if (answered) return;
      const correct = player.value === Math.max(pair[0].value, pair[1].value);
      state.current.totResults.push(correct);
      render();
    });
    matchup.appendChild(btn);
  });

  card.appendChild(matchup);

  if (answered) {
    const nextBtn = document.createElement("button");
    nextBtn.className = "btn btn-primary btn-lg";
    nextBtn.textContent = idx + 1 >= 3 ? "Continue" : "Next Match-Up";
    nextBtn.addEventListener("click", () => {
      state.current.totIndex += 1;
      render();
    });
    card.appendChild(nextBtn);
  } else {
    const vs = document.createElement("div");
    vs.className = "tot-vs";
    vs.textContent = "VS";
    matchup.appendChild(vs);
  }

  return card;
}

function screenResult() {
  const card = document.createElement("div");
  card.className = "card";
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
      totIndex: 0,
      totResults: [],
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
  const [d, pc, tot, p] = await Promise.all([
    fetch("data/decade_questions.json").then((r) => r.json()),
    fetch("data/player_career_questions.json").then((r) => r.json()),
    fetch("data/this_or_that_pool.json").then((r) => r.json()),
    fetch("data/players_search.json").then((r) => r.json()),
  ]);
  decadeQuestions = d;
  playerCareerQuestions = pc;
  thisOrThatPool = tot;
  playersSearch = p;
}

loadData().then(render);

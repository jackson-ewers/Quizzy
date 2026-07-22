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
let teammatesQuestions = [];

const TOPIC_ORDER = ["decade", "playerCareer", "thisOrThat", "college", "draft", "fillBlank", "awardsSeason", "trophyCase", "teammates"];

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
  teammates: {
    title: "Teammates",
    color: "var(--accent-9)",
    description: "You'll see a mystery player's name — guess who they played the most games with as a teammate.",
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
  teammates: [
    { key: "pos", label: "Teammate's Position", value: (q) => q.pos },
    { key: "team", label: "Team(s) Together", value: (q) => q.team },
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
      teammates: new Set(),
    },
    wheelRotation: 0,
    showHowToPlay: false,
    showWelcome: false,
    showPrivacyPolicy: false,
    showTermsOfUse: false,
    isReplay: false,
    replayQueue: null,
    replayLinkExpired: false,
    current: {
      topic: null,
      question: null,
      wager: null,
      hintsRevealed: [],
      pendingHint: null,
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
  const flips = chosen.map(() => Math.random() < 0.5);
  const pairs = chosen.map(({ pair }, k) => (flips[k] ? [pair[1], pair[0]] : [pair[0], pair[1]]));

  // pairIndices/flips let a Challenge link reference these 3 match-ups by a
  // small integer position + a flip bit each, instead of embedding all 6
  // players' full IDs - a big size saving in the shared URL.
  return { statKey, statLabel: fullPool.label, pairs, pairIndices: chosen.map((c) => c.i), flips };
}

const FILL_BLANK_FORMATS = ["season", "decade", "allTime", "team"];

function pickFillBlankQuestion() {
  const cutoff = cutoffYear();
  // all-time boards are fixed historical facts, so they're not filtered by
  // difficulty - season, decade, and team-roster boards all have a real point
  // in time and are filtered by that year
  const eligible = fillBlankBoards.filter((b) => b.format === "allTime" || b.seasonYear >= cutoff);

  // split evenly across the 4 board formats, regardless of how many boards exist
  // within each one (season and team boards vastly outnumber decade and all-time)
  const byFormat = {};
  for (const f of FILL_BLANK_FORMATS) byFormat[f] = eligible.filter((b) => b.format === f);
  const availableFormats = FILL_BLANK_FORMATS.filter((f) => byFormat[f].length > 0);
  const format = availableFormats[Math.floor(Math.random() * availableFormats.length)];
  const pool = byFormat[format];

  const used = state.usedQuestionIds.fillBlank;
  let candidates = pool.filter((b) => !used.has(b.id));
  if (candidates.length === 0) {
    pool.forEach((b) => used.delete(b.id));
    candidates = pool;
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

function poolForTopic(topic) {
  return {
    decade: decadeQuestions,
    playerCareer: playerCareerQuestions,
    college: collegeQuestions,
    draft: draftQuestions,
    awardsSeason: awardsSeasonQuestions,
    trophyCase: trophyCaseQuestions,
    teammates: teammatesQuestions,
  }[topic];
}

function pickQuestion(topic) {
  if (topic === "thisOrThat") return pickThisOrThatQuestion();
  if (topic === "fillBlank") return pickFillBlankQuestion();

  const cutoff = cutoffYear();
  const fullPool = poolForTopic(topic);
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

// A "Challenge a Friend" link has to reproduce the exact same question every
// round, not just the same topic - these capture just enough per-question
// identity to look the same question back up later, and reverse that lookup.
// Kept as small as possible (short keys, indices instead of full IDs for
// This or That) since the whole thing has to fit in a URL that gets pasted
// into texts/tweets - a naive encoding of a 10-round game can run past 2500
// characters, which real messaging apps will truncate or mangle in transit.
function questionReplaySpec(topic, q) {
  if (topic === "thisOrThat") {
    return { t: topic, s: q.statKey, i: q.pairIndices, f: q.flips.map((f) => (f ? 1 : 0)) };
  }
  if (topic === "fillBlank") {
    return { t: topic, i: q.id, b: q.blankIndex };
  }
  return { t: topic, i: q.id };
}

// Returns null (never throws) if the spec can't be resolved against the
// currently-loaded data - e.g. a challenge link made before a data rebuild
// changed a topic's question IDs. Callers treat null as "this link expired."
function pickQuestionFromSpec(spec) {
  try {
    if (spec.t === "thisOrThat") {
      const fullPool = thisOrThatPool[spec.s];
      if (!fullPool) return null;
      const pairs = spec.i.map((idx, k) => {
        const pair = fullPool.pairs[idx];
        if (!pair) throw new Error("missing pair");
        return spec.f[k] ? [pair[1], pair[0]] : [pair[0], pair[1]];
      });
      return { statKey: spec.s, statLabel: fullPool.label, pairs };
    }
    if (spec.t === "fillBlank") {
      const board = fillBlankBoards.find((b) => b.id === spec.i);
      if (!board) return null;
      const blanked = board.players[spec.b];
      if (!blanked) return null;
      return {
        ...board,
        blankIndex: spec.b,
        answerId: blanked.playerId,
        answerName: blanked.name,
        pos: blanked.pos,
        team: blanked.team,
      };
    }
    const pool = poolForTopic(spec.t);
    if (!pool) return null;
    return pool.find((q) => q.id === spec.i) || null;
  } catch {
    return null;
  }
}

// Challenge links get pasted into texts/tweets, and real messaging apps turn
// out to mangle even moderately long query strings - a 5-round game encoded
// as base64'd JSON (672 characters) got split by iMessage's own link
// detection into a truncated tappable link plus a separate inert text
// fragment. So instead of JSON+base64, rounds are packed into a plain
// dot/dash-separated string using only letters, digits, "." and "-" - all
// of them safe, unescaped URL characters that link detectors handle
// natively, with no base64 inflation on top.
const REPLAY_TOPIC_CODES = {
  decade: "d", playerCareer: "p", thisOrThat: "o", college: "c",
  draft: "r", fillBlank: "f", awardsSeason: "a", trophyCase: "x", teammates: "m",
};
const REPLAY_TOPIC_CODES_REV = Object.fromEntries(Object.entries(REPLAY_TOPIC_CODES).map(([k, v]) => [v, k]));
const REPLAY_STAT_CODES = { pts: "p", trb: "r", ast: "a", "3p": "3", dd: "d", td: "t" };
const REPLAY_STAT_CODES_REV = Object.fromEntries(Object.entries(REPLAY_STAT_CODES).map(([k, v]) => [v, k]));
const REPLAY_DIFFICULTY_CODES = { easy: "e", medium: "m", hard: "h" };
const REPLAY_DIFFICULTY_CODES_REV = Object.fromEntries(Object.entries(REPLAY_DIFFICULTY_CODES).map(([k, v]) => [v, k]));

function encodeRoundSpec(spec) {
  const tc = REPLAY_TOPIC_CODES[spec.t];
  if (spec.t === "thisOrThat") {
    const sc = REPLAY_STAT_CODES[spec.s];
    const fields = spec.i.flatMap((idx, k) => [idx, spec.f[k]]);
    return [tc, sc, ...fields].join(".");
  }
  if (spec.t === "fillBlank") {
    return [tc, spec.i, spec.b].join(".");
  }
  return [tc, spec.i].join(".");
}

function parseRoundSpec(str) {
  const parts = str.split(".");
  const topic = REPLAY_TOPIC_CODES_REV[parts[0]];
  if (!topic) return null;
  if (topic === "thisOrThat") {
    const statKey = REPLAY_STAT_CODES_REV[parts[1]];
    const nums = parts.slice(2).map(Number);
    if (!statKey || nums.length !== 6 || nums.some(Number.isNaN)) return null;
    return { t: topic, s: statKey, i: [nums[0], nums[2], nums[4]], f: [nums[1], nums[3], nums[5]] };
  }
  if (topic === "fillBlank") {
    const id = Number(parts[1]);
    const blankIndex = Number(parts[2]);
    if (Number.isNaN(id) || Number.isNaN(blankIndex)) return null;
    return { t: topic, i: id, b: blankIndex };
  }
  const id = Number(parts[1]);
  return Number.isNaN(id) ? null : { t: topic, i: id };
}

function encodeReplayCode(specs, difficulty) {
  return [REPLAY_DIFFICULTY_CODES[difficulty], ...specs.map(encodeRoundSpec)].join("-");
}

function decodeReplayCode(code) {
  try {
    const segments = code.split("-");
    const difficulty = REPLAY_DIFFICULTY_CODES_REV[segments[0]];
    if (!difficulty) return null;
    const q = segments.slice(1).map(parseRoundSpec);
    if (q.length === 0 || q.some((s) => s === null)) return null;
    return { d: difficulty, q };
  } catch {
    return null;
  }
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
  if (topic === "teammates") {
    return `<span class="hl">${q.name}</span> played <span class="hl">${q.sharedGames.toLocaleString()}</span> combined regular-season and playoff games with one teammate more than anyone else in their career. Who was it?`;
  }
  return `Here's a mystery player's season-by-season stat line. Who is it?`;
}

function correctAnswerName(topic, q) {
  if (topic === "decade") return q.answerName;
  if (topic === "college") return q.college;
  if (topic === "fillBlank") return q.answerName;
  if (topic === "teammates") return q.answerName;
  return q.name;
}

function isCorrectGuess(topic, q, selectedId) {
  if (topic === "college") return selectedId === q.college;
  if (topic === "fillBlank") return selectedId === q.answerId;
  const answerId = topic === "decade" || topic === "teammates" ? q.answerId : q.playerId;
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
  wrap.appendChild(renderFooter());
  app.appendChild(wrap);
  if (state.showHowToPlay) {
    app.appendChild(renderHowToPlayModal());
  }
  if (state.showWelcome) {
    app.appendChild(renderWelcomeModal());
  }
  if (state.showPrivacyPolicy) {
    app.appendChild(renderPrivacyPolicyModal());
  }
  if (state.showTermsOfUse) {
    app.appendChild(renderTermsOfUseModal());
  }
  if (state.current.pendingHint) {
    app.appendChild(renderHintConfirmModal());
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

const TWITTER_URL = "https://x.com/QuizzyGame";
const CONTACT_EMAIL = "quizzy@quizzygame.com";

function renderFooter() {
  const footer = document.createElement("div");
  footer.className = "app-footer";
  footer.innerHTML = `
    <span class="footer-copyright">© ${new Date().getFullYear()} Quizzy. All rights reserved.</span>
    <div class="footer-links">
      <button class="footer-link" id="footerPrivacyBtn">Privacy Policy</button>
      <button class="footer-link" id="footerTermsBtn">Terms of Use</button>
    </div>
    <div class="footer-social">
      <a class="footer-icon-link" href="${TWITTER_URL}" target="_blank" rel="noopener noreferrer" aria-label="Quizzy on Twitter/X">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      </a>
      <a class="footer-icon-link" href="mailto:${CONTACT_EMAIL}" aria-label="Email Quizzy">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="M3 6.5l9 6.5 9-6.5"/></svg>
      </a>
    </div>
  `;
  footer.querySelector("#footerPrivacyBtn").addEventListener("click", () => {
    state.showPrivacyPolicy = true;
    render();
  });
  footer.querySelector("#footerTermsBtn").addEventListener("click", () => {
    state.showTermsOfUse = true;
    render();
  });
  return footer;
}

function renderPrivacyPolicyModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card">
      <button class="modal-close-btn" id="closePrivacyX" aria-label="Close">&times;</button>
      <h2 class="screen-title">Privacy Policy</h2>
      <div class="modal-body">
        <p><em>Last updated: July 21, 2026</em></p>
        <p>Quizzy is a free, fan-made NBA trivia game. It doesn't have user accounts, doesn't require you to sign up, and doesn't collect or store any personal information.</p>
        <p>Your score and game progress live only in your browser for the current session — nothing is saved to a server or shared with anyone.</p>
        <p>Quizzy itself doesn't use cookies or analytics/tracking scripts. The site is hosted on GitHub Pages, which may log basic technical access information (like IP address and browser type) as part of its own infrastructure — see <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer">GitHub's Privacy Statement</a> for details on that.</p>
        <p>If you email us, we'll have whatever information you choose to include in that email (like your email address) so we can respond.</p>
        <p>If Quizzy ever adds accounts, ads, or analytics in the future, this policy will be updated to reflect that before it happens.</p>
        <p>Questions? Reach out at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
      </div>
      <button class="btn btn-primary btn-lg" id="closePrivacy">Got It</button>
    </div>
  `;
  const close = () => {
    state.showPrivacyPolicy = false;
    render();
  };
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector("#closePrivacyX").addEventListener("click", close);
  overlay.querySelector("#closePrivacy").addEventListener("click", close);
  return overlay;
}

function renderTermsOfUseModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card">
      <button class="modal-close-btn" id="closeTermsX" aria-label="Close">&times;</button>
      <h2 class="screen-title">Terms of Use</h2>
      <div class="modal-body">
        <p><em>Last updated: July 21, 2026</em></p>
        <p>Quizzy is a free trivia game made for fun by an NBA fan. It is not affiliated with, endorsed by, or sponsored by the NBA, its teams, or any players — player names, stats, and team names appear here purely for trivia purposes.</p>
        <p>Quizzy is provided "as is," with no guarantee that every stat or fact is 100% accurate, and no warranty of any kind. Use it for fun, not as a source of record.</p>
        <p>By using Quizzy, you agree not to misuse the site — for example, by attempting to disrupt it, scrape it at scale, or reverse-engineer it for commercial resale.</p>
        <p>To the fullest extent permitted by law, Quizzy and its creator aren't liable for any damages arising from your use of the site.</p>
        <p>These terms may be updated from time to time; continuing to use Quizzy after a change means you accept the updated terms.</p>
        <p>Questions? Reach out at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
      </div>
      <button class="btn btn-primary btn-lg" id="closeTerms">Got It</button>
    </div>
  `;
  const close = () => {
    state.showTermsOfUse = false;
    render();
  };
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector("#closeTermsX").addEventListener("click", close);
  overlay.querySelector("#closeTerms").addEventListener("click", close);
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
    ${
      state.replayLinkExpired
        ? `<div class="replay-expired-banner">That challenge link isn't valid anymore (it was made before a data update) — here's a fresh game instead!</div>`
        : ""
    }
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
    teammates: "#dc2626",
  };
  const gradientStops = segTopics
    .map((t, i) => `${segColorHex[t]} ${i * segAngle}deg ${(i + 1) * segAngle}deg`)
    .join(", ");

  card.innerHTML = `
    <h2 class="screen-title">Spin for your topic</h2>
    ${state.isReplay ? `<p class="tagline">🎯 Playing a friend's exact quiz</p>` : ""}
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
    const topic = state.isReplay
      ? state.replayQueue[state.round].t
      : TOPIC_ORDER[Math.floor(Math.random() * TOPIC_ORDER.length)];
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
      state.current.question = state.isReplay ? pickQuestionFromSpec(state.replayQueue[state.round]) : pickQuestion(topic);
      state.current.totSelections = [null, null, null];
      state.current.totSubmitted = false;
      state.current.selectedPlayer = null;
      state.current.selectedCollege = null;
      state.current.hintsRevealed = [];
      state.current.pendingHint = null;
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

// Shared hint row for every topic: renders a labeled section so hints read as
// hints (not just plain buttons), and routes every reveal through a confirm
// popup rather than revealing instantly on tap.
function renderHintRow(topic, q, revealedTextFor) {
  const wrap = document.createElement("div");
  wrap.className = "hint-section";

  const label = document.createElement("div");
  label.className = "hint-row-label";
  label.innerHTML = `<span class="hint-icon">💡</span> Hints — tap to reveal (costs you)`;
  wrap.appendChild(label);

  const hintRow = document.createElement("div");
  hintRow.className = "hint-row";
  HINTS[topic].forEach((hint) => {
    const btn = document.createElement("button");
    const revealed = state.current.hintsRevealed.includes(hint.key);
    btn.className = "hint-btn" + (revealed ? " revealed" : "");
    const valueText = revealed ? revealedTextFor(hint, q) : "Tap to reveal";
    btn.innerHTML = `<span class="hint-label">${hint.label}</span><span class="hint-value">${valueText}</span>`;
    btn.disabled = revealed;
    btn.addEventListener("click", () => {
      if (revealed) return;
      state.current.pendingHint = { topic, key: hint.key, label: hint.label };
      render();
    });
    hintRow.appendChild(btn);
  });
  wrap.appendChild(hintRow);
  return wrap;
}

function confirmPendingHint() {
  const pending = state.current.pendingHint;
  if (pending && !state.current.hintsRevealed.includes(pending.key)) {
    state.current.hintsRevealed.push(pending.key);
    resetTimer();
  }
  state.current.pendingHint = null;
  render();
}

function cancelPendingHint() {
  state.current.pendingHint = null;
  render();
}

function renderHintConfirmModal() {
  const pending = state.current.pendingHint;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card hint-confirm-card">
      <h2 class="screen-title">Use this hint?</h2>
      <div class="modal-body" style="text-align:center;">
        <p>Reveal the <strong>${pending.label}</strong> hint? Your timer resets to 60 seconds, and using it shrinks your reward — or raises your penalty — for this round.</p>
      </div>
      <div class="hint-confirm-actions">
        <button class="btn btn-ghost" id="hintCancelBtn">Cancel</button>
        <button class="btn btn-primary" id="hintConfirmBtn">Reveal Hint</button>
      </div>
    </div>
  `;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) cancelPendingHint();
  });
  overlay.querySelector("#hintCancelBtn").addEventListener("click", cancelPendingHint);
  overlay.querySelector("#hintConfirmBtn").addEventListener("click", confirmPendingHint);
  return overlay;
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
      spec: questionReplaySpec(topic, q),
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

  card.appendChild(
    renderHintRow(topic, q, (hint) => (topic === "playerCareer" ? "Shown in table" : hint.value(q)))
  );

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
      spec: questionReplaySpec(topic, q),
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
        spec: questionReplaySpec(topic, q),
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
    card.appendChild(renderHintRow("thisOrThat", q, () => "Shown below each name"));
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
        spec: questionReplaySpec(topic, q),
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
      pendingHint: null,
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

// Tries the native share sheet first (covers "post to Twitter/text a
// friend/etc." in one shot on mobile); falls back to copying the full
// text+link to the clipboard when Web Share isn't available or is cancelled.
async function shareContent(text, url, statusEl) {
  if (navigator.share) {
    try {
      await navigator.share({ text, url });
      return;
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    statusEl.textContent = "Copied to clipboard!";
  } catch (e) {
    statusEl.textContent = "Couldn't share or copy — please copy the link manually.";
  }
  setTimeout(() => {
    statusEl.textContent = "";
  }, 3000);
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

  const shareRow = document.createElement("div");
  shareRow.className = "share-row";
  shareRow.innerHTML = `
    <button class="btn btn-ghost" id="shareResultsBtn">Share Results</button>
    <button class="btn btn-ghost" id="challengeBtn">Challenge a Friend</button>
  `;
  card.appendChild(shareRow);

  const shareStatus = document.createElement("div");
  shareStatus.className = "share-status";
  card.appendChild(shareStatus);

  const scoreText = `${state.totalScore > 0 ? "+" : ""}${state.totalScore}`;
  const siteUrl = `${location.origin}${location.pathname}`;

  shareRow.querySelector("#shareResultsBtn").addEventListener("click", () => {
    const lines = state.history.map(
      (h) => `${TOPIC_META[h.topic].title}: ${h.delta > 0 ? "+" : ""}${h.delta}`
    );
    const text = `My Quizzy score: ${scoreText}\n${lines.join("\n")}`;
    shareContent(text, siteUrl, shareStatus);
  });

  shareRow.querySelector("#challengeBtn").addEventListener("click", () => {
    const specs = state.history.map((h) => h.spec);
    const code = encodeReplayCode(specs, state.difficulty);
    const url = `${siteUrl}?g=${code}`;
    const diffLabel = DIFFICULTY_LEVELS[state.difficulty].label;
    const text = `I scored ${scoreText} on a ${state.history.length}-question Quizzy (${diffLabel}) — take the same one and see if you can top my score.`;
    shareContent(text, url, shareStatus);
  });

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
  const [d, pc, tot, cq, cs, dq, p, fb, as, tc, tm] = await Promise.all([
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
    fetch("data/teammates_questions.json").then((r) => r.json()),
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
  teammatesQuestions = tm;
}

function readReplayCodeFromURL() {
  const code = new URLSearchParams(location.search).get("g");
  return code ? decodeReplayCode(code) : null;
}

// Question data can get rebuilt/rebalanced over time (new topic, a bug fix
// like the decade-boundary one, etc.), which can shift or drop the IDs an
// older Challenge link points to. Rather than silently landing on the
// normal start screen with no explanation (confusing - looks like the link
// just did nothing), a link that can't be fully resolved shows a banner
// explaining it's expired instead.
const pendingReplay = readReplayCodeFromURL();

loadData().then(() => {
  if (pendingReplay) {
    const resolvable = pendingReplay.q.every((spec) => pickQuestionFromSpec(spec) !== null);
    if (resolvable) {
      state.isReplay = true;
      state.replayQueue = pendingReplay.q;
      state.difficulty = pendingReplay.d;
      state.gameLength = pendingReplay.q.length;
      state.showWelcome = false;
      state.screen = "wheel";
    } else {
      state.replayLinkExpired = true;
    }
  }
  render();
});

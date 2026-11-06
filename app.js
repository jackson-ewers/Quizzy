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
let lineupsBoards = [];
let jerseyNumbersQuestions = [];

const TOPIC_ORDER = ["decade", "playerCareer", "thisOrThat", "college", "draft", "fillBlank", "awardsSeason", "trophyCase", "teammates", "lineups", "jerseyNumbers"];

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
      "You'll see a head-to-head match-up for a randomly picked career stat — guess who had more.",
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
      "You'll see a Top 5 stat leaderboard or an All-NBA/All-Defensive team roster — for a season, a decade, or (Hard mode only) an all-time career — with one player blanked out. Guess who's missing.",
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
  lineups: {
    title: "Lineups",
    color: "var(--accent-10)",
    description: "You'll see a team's most common 5-man lineup from a season, with one player missing — guess who it is.",
  },
  jerseyNumbers: {
    title: "Jersey Numbers",
    color: "var(--accent-11)",
    description: "You'll get a player and a team they played for — guess the number they wore.",
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
  college: [
    { key: "conference", label: "Conference", value: (q) => q.conference },
    { key: "mascot", label: "Mascot", value: (q) => q.mascot },
  ],
  draft: [
    { key: "neighbors", label: "Drafted Before/After", value: (q) => q.draftNeighborsHint },
    { key: "college", label: "College", value: (q) => q.college },
  ],
  fillBlank: [
    { key: "pos", label: "Position", value: (q) => q.pos },
    { key: "team", label: (q) => fillBlankTeamHintLabel(q), value: (q) => q.team },
  ],
  awardsSeason: [
    { key: "pos", label: "Position", value: (q) => q.pos },
    { key: "team", label: "Team", value: (q) => q.team },
  ],
  trophyCase: [
    { key: "years", label: "Years Active", value: (q) => q.years },
    { key: "team", label: "Franchise", value: (q) => q.team },
  ],
  teammates: [
    { key: "pos", label: "Teammate's Position", value: (q) => q.pos },
    { key: "team", label: "Teams Together", value: (q) => q.team },
  ],
  lineups: [
    { key: "pos", label: "Position (that season)", value: (q) => q.pos },
    { key: "stats", label: "Season Averages", value: (q) => `${q.mpg} MPG, ${q.ppg} PPG, ${q.rpg} RPG, ${q.apg} APG` },
  ],
  jerseyNumbers: [
    { key: "parity", label: "Odd or Even", value: (q) => (q.answerNumber % 2 === 0 ? "Even" : "Odd") },
    { key: "overUnder", label: "Over/Under", value: (q) => q.overUnderHint },
  ],
};

// Fill in the Blank boards come in 4 time-frame formats (season, decade,
// all-time, and All-NBA/All-Defensive team rosters, which are season-scoped
// like a plain season board). The "team(s)" hint has to say which one it's
// showing, or a career-long player can look like they only ever played for
// whatever team(s) they happened to be on for that one season/decade.
function fillBlankTeamHintLabel(q) {
  if (q.format === "allTime") return "Teams (Full Career)";
  if (q.format === "decade") return "Teams That Decade";
  return "Teams That Season";
}

// This or That hints depend on which stat got picked - most stats hint at
// career games/MPG, but the Career-High Points stat hints at career PPG and
// total career minutes instead (that's what actually helps guess a peak
// single-game number). `field`/`unit` say which player property to show and
// what to label it with once the hint is revealed.
const THIS_OR_THAT_HINTS = {
  default: [
    { key: "g", label: "Career Games Played", field: "careerG", unit: "G" },
    { key: "mpg", label: "Career Minutes Per Game", field: "careerMpg", unit: "MPG" },
  ],
  highPts: [
    { key: "ppg", label: "Career PPG", field: "careerPpg", unit: "PPG" },
    { key: "totalMin", label: "Total Career Minutes", field: "careerTotalMin", unit: "MIN" },
  ],
};
function thisOrThatHints(statKey) {
  return THIS_OR_THAT_HINTS[statKey] || THIS_OR_THAT_HINTS.default;
}

const DIFFICULTY_LEVELS = {
  easy: { label: "Easy", description: "2000-Present", cutoffYear: 2000 },
  medium: { label: "Medium", description: "1980-Present", cutoffYear: 1980 },
  hard: { label: "Hard", description: "All-Time", cutoffYear: 0 },
};

const QUESTION_TIME_SECONDS = 60;

// Room mode runs on its own shared clock, separate from solo/replay's
// mount-relative QUESTION_TIME_SECONDS timer above.
const ROOM_WAGER_SECONDS = 60;
const ROOM_QUESTION_SECONDS = 120;
// Reveal/standings no longer auto-advance on a visible clock - everyone
// clicks "Next" instead. These are just a hidden safety net so a room with a
// disconnected player doesn't wait forever for a click that's never coming.
const ROOM_REVEAL_SECONDS = 45;
const ROOM_STANDINGS_SECONDS = 45;

// ---------- State ----------
function freshState() {
  return {
    screen: "modeSelect",
    gameLength: null,
    difficulty: null,
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
      lineups: new Set(),
      jerseyNumbers: new Set(),
    },
    wheelRotation: 0,
    showHowToPlay: false,
    showWelcome: false,
    showPrivacyPolicy: false,
    showTermsOfUse: false,
    showStartValidation: false,
    isReplay: false,
    replayQueue: null,
    resultsQueue: null,
    replayLinkExpired: false,
    room: null,
    roomJoinError: null,
    roomJoinPrefillCode: null,
    roomHostName: "",
    showStandings: false,
    current: {
      topic: null,
      question: null,
      wager: null,
      hintsRevealed: [],
      pendingHint: null,
      selectedPlayer: null,
      selectedCollege: null,
      selectedNumber: null,
      totSelection: null,
      totSubmitted: false,
      autoSpun: false,
      wagerLocked: false,
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

// ---------- Room phase timer ----------
// A separate singleton from the timer above (never touched by room mode) -
// this one counts down to a shared deadlineMs (derived from the room doc's
// phaseStartedAt) rather than a fixed duration from whenever the screen
// happened to mount, so every player's clock agrees on how much time is
// left, and a mid-phase refresh shows the correct remaining time instead of
// a fresh full countdown.
let roomTimerInterval = null;
let roomTimerActiveKey = null;

function ensureRoomPhaseTimer(key, deadlineMs, onDeadline) {
  const tick = () => {
    const secondsLeft = Math.ceil((deadlineMs - Date.now()) / 1000);
    const el = document.getElementById("timerDisplay");
    if (el) el.textContent = formatTimer(Math.max(secondsLeft, 0));
    if (secondsLeft <= 0) {
      clearInterval(roomTimerInterval);
      roomTimerInterval = null;
      roomTimerActiveKey = null;
      onDeadline();
    }
  };
  if (roomTimerActiveKey === key) {
    // Interval's already running - but every render() call rebuilds the DOM
    // from scratch, and renderTimer() stamps in the *solo* timer's stale
    // seconds-left on mount, clobbering whatever this interval last wrote.
    // Re-tick immediately so the freshly-mounted display shows the correct
    // value right away instead of waiting up to a second for the next tick.
    tick();
    return;
  }
  clearInterval(roomTimerInterval);
  roomTimerActiveKey = key;
  tick();
  roomTimerInterval = setInterval(tick, 1000);
}

function stopRoomPhaseTimer() {
  clearInterval(roomTimerInterval);
  roomTimerInterval = null;
  roomTimerActiveKey = null;
}

// ---------- Room subscription ----------
// render() reruns on every state change (including trivial ones like typing
// in a form field), so a Firestore listener can't be wired up inline inside a
// screen function the way DOM event listeners are - it would resubscribe
// without bound. Guarded the same way the round timer above is: a
// module-level singleton, keyed by room code, torn down explicitly rather
// than left to garbage collection.
let roomUnsubscribe = null;
let roomSubscribedCode = null;

function roomPhaseDurationMs(phase) {
  if (phase === "wager") return ROOM_WAGER_SECONDS * 1000;
  if (phase === "question") return ROOM_QUESTION_SECONDS * 1000;
  if (phase === "reveal") return ROOM_REVEAL_SECONDS * 1000;
  if (phase === "standings") return ROOM_STANDINGS_SECONDS * 1000;
  return null; // lobby/finished have no shared clock
}

function roomIsLastRound() {
  return state.room.roundIndex + 1 >= state.room.gameLength;
}

function freshRoundCurrent() {
  return {
    topic: null,
    question: null,
    wager: null,
    hintsRevealed: [],
    pendingHint: null,
    selectedPlayer: null,
    selectedCollege: null,
    selectedNumber: null,
    totSelection: null,
    totSubmitted: false,
    autoSpun: false,
    wagerLocked: false,
  };
}

// Checks whether the room's current phase is ready to move on (every known
// player has met the phase's condition, or its shared deadline passed) and,
// if so, fire-and-forget attempts the transition. Safe to call redundantly
// from many places/many clients at once - advancePhase() is a
// compare-and-swap, so a call that's already stale (someone else already
// advanced it) just silently no-ops.
function maybeAdvanceRoomPhase() {
  if (!state.room || !state.room.players) return;
  const { code, phase, roundIndex, players, phaseDeadlineMs } = state.room;
  const deadlinePassed = phaseDeadlineMs != null && Date.now() >= phaseDeadlineMs;

  const attempt = (toPhase, toRoundIndex) => {
    window.QuizzyRoom.advancePhase(code, { fromPhase: phase, fromRoundIndex: roundIndex, toPhase, toRoundIndex }).catch(() => {});
  };

  if (phase === "lobby") {
    if (players.length >= 2 && players.every((p) => p.readyToStart)) attempt("wager", 0);
  } else if (phase === "wager") {
    const allWagered = players.every((p) => p.pendingWagerRound === roundIndex);
    if (allWagered || deadlinePassed) attempt("question", roundIndex);
  } else if (phase === "question") {
    const allAnswered = players.every((p) => (p.history?.length || 0) > roundIndex);
    if (allAnswered || deadlinePassed) attempt("reveal", roundIndex);
  } else if (phase === "reveal") {
    // Standings show after every round, not just the last one. Advance once
    // everyone's clicked "Next" - the deadline is just a fallback in case
    // someone's disconnected and never will.
    const allAcked = players.every((p) => p.ackPhase === "reveal" && p.ackRoundIndex === roundIndex);
    if (allAcked || deadlinePassed) attempt("standings", roundIndex);
  } else if (phase === "standings") {
    const allAcked = players.every((p) => p.ackPhase === "standings" && p.ackRoundIndex === roundIndex);
    if (allAcked || deadlinePassed) {
      if (roomIsLastRound()) attempt("finished", roundIndex);
      else attempt("wager", roundIndex + 1);
    }
  }
}

function ensureRoomSubscription(code) {
  if (roomSubscribedCode === code) return;
  teardownRoomSubscription();
  roomSubscribedCode = code;
  roomUnsubscribe = window.QuizzyRoom.subscribeRoom(code, {
    onRoom: (room) => {
      if (!state.room) return;
      const oldPhase = state.room.phase;
      state.room = { ...state.room, ...room };
      const duration = roomPhaseDurationMs(room.phase);
      state.room.phaseDeadlineMs = room.phaseStartedAt && duration != null ? room.phaseStartedAt.toMillis() + duration : null;
      state.round = room.roundIndex;

      if (oldPhase !== room.phase) {
        if (room.phase === "wager") {
          // covers both the very first round (lobby -> wager) and every
          // subsequent round (standings -> wager) - the wheel screen's own
          // local auto-spin is what moves each client on to the wager UI
          // itself once its animation finishes.
          state.current = freshRoundCurrent();
          state.screen = "wheel";
        } else if (room.phase === "question") {
          state.screen = "question";
        } else if (room.phase === "reveal") {
          state.screen = "roomReveal";
        } else if (room.phase === "standings") {
          state.screen = "roomStandings";
        } else if (room.phase === "finished") {
          state.screen = "roomEnd";
        }
      }
      maybeAdvanceRoomPhase();
      // state is kept current either way - only the visual re-render is
      // deferred, so it can't cut the wheel's spin animation short.
      if (!roomSpinInProgress) render();
    },
    onPlayers: (players) => {
      if (!state.room) return;
      state.room.players = players;
      maybeAdvanceRoomPhase();
      if (!roomSpinInProgress) render();
    },
  });
}

function teardownRoomSubscription() {
  if (roomUnsubscribe) roomUnsubscribe();
  roomUnsubscribe = null;
  roomSubscribedCode = null;
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
  if (candidates.length === 0) {
    used.clear();
    candidates = eligible;
  }

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  used.add(`${statKey}:${chosen.i}`);

  const flip = Math.random() < 0.5;
  const pair = flip ? [chosen.pair[1], chosen.pair[0]] : [chosen.pair[0], chosen.pair[1]];

  // pairIndex/flip let a Challenge link reference this match-up by a small
  // integer position + a flip bit, instead of embedding both players' full
  // IDs - a size saving in the shared URL.
  return { statKey, statLabel: fullPool.label, pair, pairIndex: chosen.i, flip };
}

const FILL_BLANK_FORMATS = ["season", "decade", "allTime", "team"];

function pickFillBlankQuestion() {
  const cutoff = cutoffYear();
  // all-time boards span every era, so they only make sense once difficulty
  // has no cutoff at all (Hard) - otherwise a "recent-only" player could show
  // up in an all-time top 5 alongside decades they were never eligible for.
  // season/decade/team-roster boards each have a real point in time and are
  // filtered by that year as usual.
  const eligible = fillBlankBoards.filter((b) => (b.format === "allTime" ? cutoff === 0 : b.seasonYear >= cutoff));

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

function pickLineupsQuestion() {
  const cutoff = cutoffYear();
  const eligible = lineupsBoards.filter((b) => b.seasonYear >= cutoff);

  const used = state.usedQuestionIds.lineups;
  let candidates = eligible.filter((b) => !used.has(b.id));
  if (candidates.length === 0) {
    used.clear();
    candidates = eligible;
  }
  const board = candidates[Math.floor(Math.random() * candidates.length)];
  used.add(board.id);

  // only players who logged 1000+ total minutes that season can be the
  // blanked one - baked in at build time as eligibleBlankIndices
  const indices = board.eligibleBlankIndices;
  const blankIndex = indices[Math.floor(Math.random() * indices.length)];
  const blanked = board.players[blankIndex];
  return {
    ...board,
    blankIndex,
    answerId: blanked.id,
    answerName: blanked.name,
    pos: blanked.pos,
    mpg: blanked.mpg,
    ppg: blanked.ppg,
    rpg: blanked.rpg,
    apg: blanked.apg,
  };
}

// Adds an "over/under" hint value to a Jersey Numbers question, computed
// fresh each time the question is picked (not baked in at build time) so the
// same question can show a different threshold on a future replay. The
// threshold sits 4-8 away from the real number - close enough to actually
// narrow things down, far enough that it doesn't just give the number away -
// and always lands on the side of the answer that keeps 0-99 in bounds.
function addJerseyOverUnderHint(q) {
  const offset = 4 + Math.floor(Math.random() * 5);
  const canGoAbove = q.answerNumber < 99;
  const canGoBelow = q.answerNumber > 0;
  let goAbove = Math.random() < 0.5;
  if (goAbove && !canGoAbove) goAbove = false;
  if (!goAbove && !canGoBelow) goAbove = true;
  const overUnderHint = goAbove
    ? `Under ${Math.min(99, q.answerNumber + offset)}`
    : `Over ${Math.max(0, q.answerNumber - offset)}`;
  return { ...q, overUnderHint };
}

function pickJerseyNumbersQuestion() {
  const cutoff = cutoffYear();
  const pool = jerseyNumbersQuestions.filter((q) => q.fromYear >= cutoff);

  const used = state.usedQuestionIds.jerseyNumbers;
  let candidates = pool.filter((q) => !used.has(q.id));
  if (candidates.length === 0) {
    used.clear();
    candidates = pool;
  }
  const q = candidates[Math.floor(Math.random() * candidates.length)];
  used.add(q.id);
  return addJerseyOverUnderHint(q);
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
  if (topic === "lineups") return pickLineupsQuestion();
  if (topic === "jerseyNumbers") return pickJerseyNumbersQuestion();

  const cutoff = cutoffYear();
  const fullPool = poolForTopic(topic);
  const pool = fullPool.filter((q) => {
    if (topic === "decade") return q.decade >= cutoff;
    if (topic === "awardsSeason") return q.seasonYear >= cutoff;
    // Draft filters on the draft itself, not the player's rookie season -
    // draft-and-stash picks (e.g. international players) can debut a year
    // or more after being drafted, so fromYear alone would let an old draft
    // sneak into a "2000-present" difficulty just because the player's
    // actual NBA debut happened to land in that window.
    if (topic === "draft") return q.draftYear >= cutoff;
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
    return { t: topic, s: q.statKey, i: q.pairIndex, f: q.flip ? 1 : 0 };
  }
  if (topic === "fillBlank" || topic === "lineups") {
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
      const rawPair = fullPool.pairs[spec.i];
      if (!rawPair) return null;
      const pair = spec.f ? [rawPair[1], rawPair[0]] : [rawPair[0], rawPair[1]];
      return { statKey: spec.s, statLabel: fullPool.label, pair, pairIndex: spec.i, flip: !!spec.f };
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
    if (spec.t === "lineups") {
      const board = lineupsBoards.find((b) => b.id === spec.i);
      if (!board) return null;
      const blanked = board.players[spec.b];
      if (!blanked) return null;
      return {
        ...board,
        blankIndex: spec.b,
        answerId: blanked.id,
        answerName: blanked.name,
        pos: blanked.pos,
        mpg: blanked.mpg,
        ppg: blanked.ppg,
        rpg: blanked.rpg,
        apg: blanked.apg,
      };
    }
    if (spec.t === "jerseyNumbers") {
      const q = jerseyNumbersQuestions.find((q) => q.id === spec.i);
      return q ? addJerseyOverUnderHint(q) : null;
    }
    const pool = poolForTopic(spec.t);
    if (!pool) return null;
    return pool.find((q) => q.id === spec.i) || null;
  } catch {
    return null;
  }
}

// A shared room needs every player to get the identical question sequence,
// generated once up front by the host rather than picked lazily round by
// round. Reuses pickQuestion() as-is (it only ever depends on state.difficulty
// and state.usedQuestionIds[topic], both already set correctly at this point,
// right after the host picks the room's settings and before anyone - even the
// host - starts actually playing).
function generateRoomSpecs(count) {
  const specs = [];
  for (let i = 0; i < count; i++) {
    const topic = TOPIC_ORDER[Math.floor(Math.random() * TOPIC_ORDER.length)];
    const q = pickQuestion(topic);
    specs.push(questionReplaySpec(topic, q));
  }
  return specs;
}

// The one shared touch-point between the Challenge-link replay system and
// rooms: both hand every player the same pre-picked question per round
// instead of picking randomly. Everything else about the two systems (how
// scores get compared, what the end screen shows) stays separate - a room's
// spec entries don't carry a delta/wager the way a replayQueue entry does,
// since a room's round results only exist once each player actually finishes
// that round, asynchronously, via Firestore.
function currentQueueSpec() {
  if (state.isReplay) return state.replayQueue[state.round];
  if (state.room) return state.room.specs[state.round];
  return null;
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
  lineups: "l", jerseyNumbers: "j",
};
const REPLAY_TOPIC_CODES_REV = Object.fromEntries(Object.entries(REPLAY_TOPIC_CODES).map(([k, v]) => [v, k]));
const REPLAY_STAT_CODES = { pts: "p", trb: "r", ast: "a", "3p": "3", dd: "d", td: "t", highPts: "h" };
const REPLAY_STAT_CODES_REV = Object.fromEntries(Object.entries(REPLAY_STAT_CODES).map(([k, v]) => [v, k]));
const REPLAY_DIFFICULTY_CODES = { easy: "e", medium: "m", hard: "h" };
const REPLAY_DIFFICULTY_CODES_REV = Object.fromEntries(Object.entries(REPLAY_DIFFICULTY_CODES).map(([k, v]) => [v, k]));

// Topic-identity fields only (no scoring data) - shared by both the
// single-sided challenge format below and the two-sided results format
// further down, so the per-topic field layout only has to be defined once.
function coreFieldsForSpec(spec) {
  const tc = REPLAY_TOPIC_CODES[spec.t];
  if (spec.t === "thisOrThat") {
    return [tc, REPLAY_STAT_CODES[spec.s], spec.i, spec.f];
  }
  if (spec.t === "fillBlank" || spec.t === "lineups") {
    return [tc, spec.i, spec.b];
  }
  return [tc, spec.i];
}

function parseCoreFields(core) {
  const topic = REPLAY_TOPIC_CODES_REV[core[0]];
  if (!topic) return null;
  if (topic === "thisOrThat") {
    const statKey = REPLAY_STAT_CODES_REV[core[1]];
    const idx = Number(core[2]);
    const flip = Number(core[3]);
    if (!statKey || Number.isNaN(idx) || Number.isNaN(flip)) return null;
    return { t: topic, s: statKey, i: idx, f: flip };
  }
  if (topic === "fillBlank" || topic === "lineups") {
    const id = Number(core[1]);
    const blankIndex = Number(core[2]);
    if (Number.isNaN(id) || Number.isNaN(blankIndex)) return null;
    return { t: topic, i: id, b: blankIndex };
  }
  const id = Number(core[1]);
  return Number.isNaN(id) ? null : { t: topic, i: id };
}

// "none" is a reserved token for "timed out, no answer" - safe because it
// can never collide with a real encoded value (player IDs always end in
// digits, jersey/college/this-or-that values are always plain numbers).
function encodeGuessedToken(guessed) {
  return guessed === null || guessed === undefined ? "none" : guessed;
}
function decodeGuessedToken(token) {
  return token === "none" ? null : token;
}

// Every round also carries the challenger's wager, point delta, and raw
// guessed answer for that round (as trailing fields, since "-" is already
// the separator between rounds) - that's what lets a friend's playthrough
// show a live "you vs them" scoreboard after each question, what they
// actually guessed alongside their own answer, and a full breakdown at the
// end instead of only a final total.
function encodeRoundSpec(spec) {
  const core = coreFieldsForSpec(spec);
  const deltaSign = spec.delta < 0 ? 1 : 0;
  return [...core, deltaSign, Math.abs(spec.delta), spec.wager, encodeGuessedToken(spec.guessed)].join(".");
}

function parseRoundSpec(str) {
  const parts = str.split(".");
  const guessed = decodeGuessedToken(parts[parts.length - 1]);
  const wager = Number(parts[parts.length - 2]);
  const deltaAbs = Number(parts[parts.length - 3]);
  const deltaSign = Number(parts[parts.length - 4]);
  if (Number.isNaN(wager) || Number.isNaN(deltaSign) || Number.isNaN(deltaAbs)) return null;
  const core = parseCoreFields(parts.slice(0, -4));
  if (!core) return null;
  return { ...core, delta: deltaSign ? -deltaAbs : deltaAbs, wager, guessed };
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

// "Final Results" links (built by Send Back Result) carry BOTH sides' data
// per round instead of one - the challenger's (the person who sent the
// original challenge) and the opponent's (whoever just finished it). Using
// role names instead of "you"/"them" matters here specifically because
// this link can be opened by a third party who is neither - "you/them" has
// no stable meaning once it's not the same person who built the link.
function encodeResultRoundSpec(spec) {
  const core = coreFieldsForSpec(spec);
  const side = (s) => [s.delta < 0 ? 1 : 0, Math.abs(s.delta), s.wager, encodeGuessedToken(s.guessed)];
  return [...core, ...side(spec.challenger), ...side(spec.opponent)].join(".");
}

function parseResultRoundSpec(str) {
  const parts = str.split(".");
  if (parts.length < 8) return null;
  const parseSide = ([deltaSignStr, deltaAbsStr, wagerStr, guessedToken]) => {
    const deltaSign = Number(deltaSignStr);
    const deltaAbs = Number(deltaAbsStr);
    const wager = Number(wagerStr);
    if (Number.isNaN(deltaSign) || Number.isNaN(deltaAbs) || Number.isNaN(wager)) return null;
    return { delta: deltaSign ? -deltaAbs : deltaAbs, wager, guessed: decodeGuessedToken(guessedToken) };
  };
  const opponent = parseSide(parts.slice(-4));
  const challenger = parseSide(parts.slice(-8, -4));
  if (!opponent || !challenger) return null;
  const core = parseCoreFields(parts.slice(0, -8));
  if (!core) return null;
  return { ...core, challenger, opponent };
}

function encodeResultsCode(specs, difficulty) {
  return [REPLAY_DIFFICULTY_CODES[difficulty], ...specs.map(encodeResultRoundSpec)].join("-");
}

function decodeResultsCode(code) {
  try {
    const segments = code.split("-");
    const difficulty = REPLAY_DIFFICULTY_CODES_REV[segments[0]];
    if (!difficulty) return null;
    const q = segments.slice(1).map(parseResultRoundSpec);
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

// Pushes the round just added to state.history up to Firestore so other
// players in the room can see it live. Fire-and-forget - a dropped write here
// shouldn't block this player's own game from continuing.
function syncRoomRound() {
  if (!state.room) return;
  const h = state.history[state.history.length - 1];
  const isLastRound = state.history.length >= state.gameLength;
  window.QuizzyRoom.submitRoundResult(
    state.room.code,
    state.room.myPlayerId,
    { topic: h.topic, wager: h.wager, delta: h.delta, correct: h.correct, guessed: h.guessed, answer: h.answer, hints: h.hints },
    isLastRound
  ).catch(() => {});
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
  if (topic === "lineups") {
    return `This was the most-used 5-man lineup for the <span class="hl">${q.season}</span> <span class="hl">${q.teamName}</span>, playing <span class="hl">${q.minutesTogether.toLocaleString()}</span> minutes together — but one name is missing. Who is it?`;
  }
  if (topic === "jerseyNumbers") {
    return `What jersey number did <span class="hl">${q.name}</span> wear for the <span class="hl">${q.team}</span>?`;
  }
  return `Here's a mystery player's season-by-season stat line. Who is it?`;
}

function correctAnswerName(topic, q) {
  if (topic === "decade") return q.answerName;
  if (topic === "college") return q.college;
  if (topic === "fillBlank") return q.answerName;
  if (topic === "teammates") return q.answerName;
  if (topic === "lineups") return q.answerName;
  if (topic === "jerseyNumbers") return String(q.answerNumber);
  if (topic === "thisOrThat") return q.pair[0].value >= q.pair[1].value ? q.pair[0].name : q.pair[1].name;
  return q.name;
}

// Resolves a compact "guessedRaw" value (as carried in a Challenge or Final
// Results link) back into display text - the inverse of how it's encoded at
// submit time: player ID -> name, college index -> name, jersey number ->
// string, this-or-that side -> that side's player name. `q` is the
// reconstructed question for this round (from pickQuestionFromSpec), needed
// for this-or-that since the two names aren't looked up elsewhere.
function resolveGuessedDisplay(topic, guessedRaw, q) {
  if (guessedRaw === null || guessedRaw === undefined) return "(ran out of time)";
  if (topic === "college") return collegesSearch[Number(guessedRaw)] ?? "Unknown";
  if (topic === "jerseyNumbers") return String(guessedRaw);
  if (topic === "thisOrThat") return q.pair[Number(guessedRaw)]?.name ?? "Unknown";
  return playersSearch.find((p) => p.id === guessedRaw)?.name ?? "Unknown";
}

function isCorrectGuess(topic, q, selectedId) {
  if (topic === "college") return selectedId === q.college;
  if (topic === "fillBlank") return selectedId === q.answerId;
  if (topic === "lineups") return selectedId === q.answerId;
  if (topic === "jerseyNumbers") return Number(selectedId) === q.answerNumber;
  const answerId = topic === "decade" || topic === "teammates" ? q.answerId : q.playerId;
  return selectedId === answerId;
}

function isThisOrThatCorrect(q, selection) {
  if (selection === null || selection === undefined) return false;
  return q.pair[selection].value === Math.max(q.pair[0].value, q.pair[1].value);
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
  if (state.showStartValidation) {
    app.appendChild(renderStartValidationModal());
  }
  if (state.current.pendingHint) {
    app.appendChild(renderHintConfirmModal());
  }
  if (state.showStandings) {
    app.appendChild(renderStandingsModal());
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

function renderStartValidationModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card">
      <button class="modal-close-btn" id="closeStartValidationX" aria-label="Close">&times;</button>
      <h2 class="screen-title">Almost There!</h2>
      <div class="modal-body" style="text-align:center;">
        <p>You must first choose your question count and quiz difficulty before you can start.</p>
      </div>
      <button class="btn btn-primary btn-lg" id="closeStartValidation">Got It</button>
    </div>
  `;
  const close = () => {
    state.showStartValidation = false;
    render();
  };
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector("#closeStartValidationX").addEventListener("click", close);
  overlay.querySelector("#closeStartValidation").addEventListener("click", close);
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
        <p>Quizzy is a fan-made NBA trivia game. It doesn't have user accounts, doesn't require you to sign up, and doesn't collect or store any personal information.</p>
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
        <p>Quizzy is a trivia game made for fun by an NBA fan. It is not affiliated with, endorsed by, or sponsored by the NBA, its teams, or any players — player names, stats, and team names appear here purely for trivia purposes.</p>
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
  const diff = DIFFICULTY_LEVELS[state.difficulty];
  div.innerHTML = `
    <div class="status-pill">Round <strong>${state.round + 1}</strong> / ${state.gameLength}</div>
    <div class="status-pill" title="${diff.description}">${diff.label}</div>
    <div class="status-pill">Left: <strong>${availableWagers().join(", ") || "—"}</strong></div>
  `;
  return div;
}

// Shown on screens that don't already have the full status-bar (Round X/Y
// implies question count there) - the wheel and end screens still get a
// quiet reminder of the settings this game is being played at.
function gameSettingsLine() {
  const p = document.createElement("p");
  p.className = "tagline game-settings-line";
  p.textContent = `${DIFFICULTY_LEVELS[state.difficulty].label} · ${state.gameLength} Questions`;
  return p;
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

// initialSecondsLeft lets room mode stamp in the correct value right away -
// ensureRoomPhaseTimer's own corrective tick() can't do this itself, since
// it runs before this card is attached to the live document (getElementById
// finds nothing yet), so without this the display would show solo's
// unrelated timerSecondsLeft for up to a second after every re-render.
function renderTimer(initialSecondsLeft) {
  const el = document.createElement("div");
  el.className = "timer-display";
  el.id = "timerDisplay";
  el.textContent = formatTimer(initialSecondsLeft ?? timerSecondsLeft);
  return el;
}

function roomSecondsLeft() {
  return state.room?.phaseDeadlineMs != null ? Math.max(0, Math.ceil((state.room.phaseDeadlineMs - Date.now()) / 1000)) : 0;
}

function renderScreen() {
  switch (state.screen) {
    case "modeSelect": return screenModeSelect();
    case "multiplayerHome": return screenMultiplayerHome();
    case "start": return screenStart();
    case "wheel": return screenWheel();
    case "wager": return screenWager();
    case "question": return screenQuestion();
    case "result": return screenResult();
    case "end": return screenEnd();
    case "resultsView": return screenResultsView();
    case "roomCreate": return screenRoomCreate();
    case "roomJoin": return screenRoomJoin();
    case "roomLobby": return screenRoomLobby();
    case "roomWager": return screenRoomWager();
    case "roomReveal": return screenRoomReveal();
    case "roomStandings": return screenRoomStandings();
    case "roomEnd": return screenRoomEnd();
    default: return document.createElement("div");
  }
}

// ---------- Screens ----------
function screenModeSelect() {
  const card = document.createElement("div");
  card.className = "card";
  const mpReady = window.QuizzyRoom?.isReady;
  const mpUnavailable = window.QuizzyRoom?.isUnavailable;
  const friendDesc = mpUnavailable
    ? "Unavailable right now."
    : mpReady
    ? "Create or join a room and go up against your friends."
    : "Loading…";
  card.innerHTML = `
    ${
      state.replayLinkExpired
        ? `<div class="replay-expired-banner">That challenge link isn't valid anymore (it was made before a data update) — here's a fresh game instead!</div>`
        : ""
    }
    <h2 class="screen-title">Choose a Mode</h2>
    <div class="mode-card-row">
      <button class="mode-card" id="soloModeBtn">
        <div class="mode-card-icon">🎯</div>
        <div class="mode-card-title">Solo</div>
        <div class="mode-card-desc">Play at your own pace and chase a high score.</div>
      </button>
      <button class="mode-card ${!mpReady ? "mode-card-disabled" : ""}" id="friendModeBtn">
        <div class="mode-card-icon">🧑‍🤝‍🧑</div>
        <div class="mode-card-title">Play a Friend</div>
        <div class="mode-card-desc">${friendDesc}</div>
      </button>
      <button class="mode-card mode-card-disabled" id="onlineModeBtn">
        <div class="mode-card-icon">🌐</div>
        <div class="mode-card-title">Online</div>
        <div class="mode-card-desc">Coming soon — get matched with a real opponent.</div>
      </button>
    </div>
  `;
  card.querySelector("#soloModeBtn").addEventListener("click", () => {
    state.screen = "start";
    render();
  });
  card.querySelector("#friendModeBtn").addEventListener("click", () => {
    if (!mpReady) return;
    state.roomJoinError = null;
    state.screen = "multiplayerHome";
    render();
  });
  return card;
}

function screenMultiplayerHome() {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <h2 class="screen-title">Play a Friend</h2>
    <div class="choice-row">
      <button class="length-card" id="createRoomBtn">
        <div class="length-num">➕</div>
        <div class="length-label">Create a Room</div>
      </button>
      <button class="length-card" id="joinRoomBtn">
        <div class="length-num">🔑</div>
        <div class="length-label">Join a Room</div>
      </button>
    </div>
    <button class="btn btn-ghost" id="modeBackBtn">Back</button>
  `;
  card.querySelector("#createRoomBtn").addEventListener("click", () => {
    state.roomJoinError = null;
    state.screen = "roomCreate";
    render();
  });
  card.querySelector("#joinRoomBtn").addEventListener("click", () => {
    state.roomJoinError = null;
    state.screen = "roomJoin";
    render();
  });
  card.querySelector("#modeBackBtn").addEventListener("click", () => {
    state.screen = "modeSelect";
    render();
  });
  return card;
}

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
    <button class="btn btn-primary btn-lg ${!state.gameLength || !state.difficulty ? "btn-look-disabled" : ""}" id="startBtn">Start Game</button>
    <button class="btn btn-ghost" id="modeBackBtn">Back</button>
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
  // Not a real disabled button - stays clickable so a tap before both
  // choices are made can explain what's missing, instead of just doing
  // nothing and leaving the user unsure why.
  card.querySelector("#startBtn").addEventListener("click", () => {
    if (!state.gameLength || !state.difficulty) {
      state.showStartValidation = true;
      render();
      return;
    }
    state.screen = "wheel";
    render();
  });
  card.querySelector("#modeBackBtn").addEventListener("click", () => {
    state.screen = "modeSelect";
    render();
  });
  return card;
}

// A couple of topic titles are long enough that they need a shorter label
// specifically for the tight space inside a wedge - everywhere else in the
// app (topic badge, question screens) still uses the real TOPIC_META title.
const WHEEL_LABEL_OVERRIDES = {
  decade: "Decade Leader",
  fillBlank: "Fill in Blank",
};

// If anything re-renders the app mid-spin (e.g. tapping How to Play), the
// wheel screen gets rebuilt with a fresh, re-enabled Spin button - but the
// in-flight spin's pending setTimeouts aren't tied to that old DOM and keep
// running regardless. Without a guard, a second spin plus the first spin's
// stale completion could both land, with whichever fires last silently
// overwriting the topic/screen the other one set. Each spin gets its own
// token so a stale spin's callbacks become no-ops once superseded.
let activeSpinToken = 0;

// render() tears down and rebuilds the entire DOM, which kills the wheel's
// CSS rotation transition stone dead if it happens mid-spin. In room mode
// that's a real risk - render() fires from the room subscription any time
// any player's data changes (readiness, a wager, an answer), which can
// easily land inside the ~5s spin window. This flag lets the room
// subscription defer those renders until the spin's own final render()
// call, rather than visually cutting the animation short.
let roomSpinInProgress = false;

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
    lineups: "#2563eb",
    jerseyNumbers: "#059669",
  };
  const gradientStops = segTopics
    .map((t, i) => `${segColorHex[t]} ${i * segAngle}deg ${(i + 1) * segAngle}deg`)
    .join(", ");

  // Label size/width are computed from the segment count (not fixed), so a
  // label never needs more horizontal room than its own wedge actually has
  // at the radius it sits at - that mismatch (a fixed-width label wider than
  // the wedge's available arc) was exactly why labels used to overlap once
  // there were this many topics. wheelRadius must track the wheel's actual
  // rendered size (94% of .wheel-stage, set in CSS) for the math to line up.
  const isMobile = window.matchMedia("(max-width: 480px)").matches;
  const wheelRadius = isMobile ? 150 : 216;
  const labelRadius = wheelRadius * 0.58;
  const chordWidth = 2 * labelRadius * Math.sin(((segAngle / 2) * Math.PI) / 180);
  const labelWidth = Math.round(Math.max(46, chordWidth * 0.95));
  const fontSize = segCount <= 6 ? 15 : segCount <= 9 ? 13 : 11;

  card.innerHTML = `
    <h2 class="screen-title">Spin for your topic</h2>
    <p class="tagline game-settings-line">${DIFFICULTY_LEVELS[state.difficulty].label} · ${state.gameLength} Questions</p>
    ${state.isReplay ? `<p class="tagline">🎯 Playing a friend's exact quiz</p>` : ""}
    ${state.room ? `<p class="tagline">🧑‍🤝‍🧑 Room ${state.room.code} — everyone gets the same questions</p>` : ""}
    <div class="wheel-stage">
      <div class="wheel-pointer"></div>
      <div class="wheel" id="wheel" style="background: conic-gradient(${gradientStops}); transform: rotate(${state.wheelRotation}deg);">
        ${segTopics
          .map((t, i) => {
            const angle = i * segAngle + segAngle / 2;
            const rad = (angle * Math.PI) / 180;
            const dx = labelRadius * Math.sin(rad);
            const dy = -labelRadius * Math.cos(rad);
            const label = WHEEL_LABEL_OVERRIDES[t] || TOPIC_META[t].title;
            return `<div class="wheel-label" style="left: calc(50% + ${dx}px); top: calc(50% + ${dy}px); width: ${labelWidth}px; font-size: ${fontSize}px;">${label}</div>`;
          })
          .join("")}
        <div class="wheel-hub"></div>
      </div>
    </div>
    <div class="spin-result" id="spinResult"></div>
    ${state.room ? "" : `<button class="btn btn-primary btn-lg" id="spinBtn">Spin the Wheel</button>`}
  `;

  const wheelEl = card.querySelector("#wheel");
  const spinBtn = card.querySelector("#spinBtn");
  const resultEl = card.querySelector("#spinResult");

  function runSpin() {
    if (spinBtn) spinBtn.disabled = true;
    if (state.room) roomSpinInProgress = true;
    activeSpinToken += 1;
    const mySpinToken = activeSpinToken;
    const topic = state.isReplay || state.room
      ? currentQueueSpec().t
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
      if (mySpinToken !== activeSpinToken) return; // superseded by a later spin - ignore
      state.current.topic = topic;
      state.current.question =
        state.isReplay || state.room ? pickQuestionFromSpec(currentQueueSpec()) : pickQuestion(topic);
      state.current.totSelection = null;
      state.current.totSubmitted = false;
      state.current.selectedPlayer = null;
      state.current.selectedCollege = null;
      state.current.selectedNumber = null;
      state.current.hintsRevealed = [];
      state.current.pendingHint = null;
      resultEl.textContent = `${TOPIC_META[topic].title}!`;
      resultEl.style.color = TOPIC_META[topic].color;
      setTimeout(() => {
        if (mySpinToken !== activeSpinToken) return;
        roomSpinInProgress = false;
        state.screen = state.room ? "roomWager" : "wager";
        render();
      }, 700);
    }, WHEEL_SPIN_MS);
  }

  if (spinBtn) {
    spinBtn.addEventListener("click", runSpin);
  } else if (state.room && !state.current.autoSpun) {
    // Room mode never shows a clickable spin button - the topic is already
    // fixed by the room's shared question list, so every player's wheel just
    // plays the same animation automatically the moment this round begins.
    //
    // The wheel div is still sitting in an unattached `card` at this point
    // (screenWheel() hasn't returned yet, so render() hasn't appended it to
    // the document) - if runSpin() mutated its transform right now, the
    // browser would never get a chance to paint the "at rest" rotation
    // first, so there'd be nothing for the CSS transition to animate from
    // and the wheel would just silently jump straight to its final angle.
    // Wait two animation frames (guaranteeing an actual paint happens in
    // between) before changing the transform. Also flip roomSpinInProgress
    // on immediately, not just once runSpin() itself starts, so a Firestore
    // snapshot landing during this short wait can't sneak in a re-render and
    // wipe out the freshly-mounted wheel before it ever gets to spin.
    state.current.autoSpun = true;
    roomSpinInProgress = true;
    requestAnimationFrame(() => requestAnimationFrame(runSpin));
  }

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

// Room mode's timed, shared-clock counterpart to screenWager() above - kept
// completely separate so solo/replay's untimed screenWager() never needs a
// state.room branch. Every player sees the same wager grid; locking in
// writes to Firestore instead of navigating anywhere - the room's phase
// advancing (once everyone's locked in or the clock runs out) is what
// actually moves every player on to the question screen together.
function screenRoomWager() {
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

  card.appendChild(renderTimer(roomSecondsLeft()));

  const lockInWager = (wager) => {
    state.usedWagers.add(wager);
    state.current.wager = wager;
    state.current.wagerLocked = true;
    window.QuizzyRoom.setPendingWager(state.room.code, state.room.myPlayerId, state.room.roundIndex, wager).catch(() => {});
    render();
  };

  ensureRoomPhaseTimer(`wager-${state.room.roundIndex}`, state.room.phaseDeadlineMs, () => {
    if (!state.current.wagerLocked) {
      const options = availableWagers();
      const fallback = options[Math.floor(Math.random() * options.length)];
      lockInWager(fallback);
    }
  });

  if (state.current.wagerLocked) {
    const players = state.room.players || [];
    const waiting = waitingOnNames(players, (p) => p.pendingWagerRound === state.room.roundIndex, state.room.myPlayerId);
    const confirmEl = document.createElement("p");
    confirmEl.className = "tagline";
    confirmEl.innerHTML = `You wagered <strong>${state.current.wager}</strong>.`;
    card.appendChild(confirmEl);
    const waitEl = document.createElement("p");
    waitEl.className = "tagline";
    waitEl.textContent = waiting.length ? `Waiting on: ${formatWaitingList(waiting)}` : "Everyone's locked in — moving on…";
    card.appendChild(waitEl);
    return card;
  }

  const sub = document.createElement("p");
  sub.className = "tagline";
  sub.textContent = "Choose how many points to wager on this round. Each number can only be used once.";
  card.appendChild(sub);

  const alreadyIn = readyNames(
    state.room.players || [],
    (p) => p.pendingWagerRound === state.room.roundIndex,
    state.room.myPlayerId
  );
  if (alreadyIn.length) {
    const alreadyInEl = document.createElement("p");
    alreadyInEl.className = "tagline";
    alreadyInEl.textContent = `${formatWaitingList(alreadyIn)} ${alreadyIn.length === 1 ? "has" : "have"} already locked in.`;
    card.appendChild(alreadyInEl);
  }

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
  confirmBtn.addEventListener("click", () => lockInWager(state.current.wager));
  card.appendChild(confirmBtn);

  return card;
}

// Shared hint row for every topic: renders a labeled section so hints read as
// hints (not just plain buttons), and routes every reveal through a confirm
// popup rather than revealing instantly on tap.
function renderHintRow(topic, q, hintDefs, revealedTextFor) {
  const wrap = document.createElement("div");
  wrap.className = "hint-section";

  const label = document.createElement("div");
  label.className = "hint-row-label";
  label.innerHTML = `<span class="hint-icon">💡</span> Hints — tap to reveal (costs you)`;
  wrap.appendChild(label);

  const hintRow = document.createElement("div");
  hintRow.className = "hint-row";
  hintDefs.forEach((hint) => {
    const btn = document.createElement("button");
    const revealed = state.current.hintsRevealed.includes(hint.key);
    const labelText = typeof hint.label === "function" ? hint.label(q) : hint.label;
    btn.className = "hint-btn" + (revealed ? " revealed" : "");
    const valueText = revealed ? revealedTextFor(hint, q) : "Tap to reveal";
    btn.innerHTML = `<span class="hint-label">${labelText}</span><span class="hint-value">${valueText}</span>`;
    btn.disabled = revealed;
    btn.addEventListener("click", () => {
      if (revealed) return;
      state.current.pendingHint = { topic, key: hint.key, label: labelText };
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
    // Room mode runs on a shared clock everyone else is also counting down -
    // resetting it for just the player who used a hint would desync them
    // from the room, so only solo/replay's own per-player timer resets here.
    if (!state.room) resetTimer();
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

function renderStandingsModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card">
      <h2 class="screen-title">Live Standings</h2>
      <div class="modal-body" id="standingsModalBody"></div>
      <button class="btn btn-primary btn-lg" id="standingsCloseBtn">Close</button>
    </div>
  `;
  overlay.querySelector("#standingsModalBody").appendChild(renderLeaderboard(state.room?.players || [], { showProgress: true }));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      state.showStandings = false;
      render();
    }
  });
  overlay.querySelector("#standingsCloseBtn").addEventListener("click", () => {
    state.showStandings = false;
    render();
  });
  return overlay;
}

function screenQuestion() {
  const topic = state.current.topic;
  if (topic === "thisOrThat") return screenThisOrThat();

  // This player already submitted/timed out on this round - stay put and
  // show who the room's still waiting on, rather than the question form
  // again. The room's phase advancing (Step 6) is what moves everyone on to
  // the reveal screen together once the room is ready.
  if (state.room && state.history.length > state.round) {
    return roomWaitingCard(state.history[state.round]);
  }

  const card = document.createElement("div");
  card.className = "card";
  card.appendChild(scoreBadge());
  card.appendChild(progressBar());
  card.appendChild(statusBar());

  const q = state.current.question;

  if (state.room) {
    ensureRoomPhaseTimer(`question-${state.room.roundIndex}`, state.room.phaseDeadlineMs, () => {
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
        guessedRaw: null,
        spec: questionReplaySpec(topic, q),
      });
      syncRoomRound();
      stopRoomPhaseTimer();
      render();
    });
  } else {
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
        guessedRaw: null,
        spec: questionReplaySpec(topic, q),
      });
      syncRoomRound();
      stopTimer();
      state.screen = "result";
      render();
    });
  }

  const badge = document.createElement("div");
  badge.innerHTML = `<span class="topic-badge" style="color:${TOPIC_META[topic].color}">${TOPIC_META[topic].title}</span>`;
  card.appendChild(badge);

  card.appendChild(renderTimer(state.room ? roomSecondsLeft() : undefined));

  if (state.room) {
    const alreadyAnswered = readyNames(
      state.room.players || [],
      (p) => (p.history?.length || 0) > state.round,
      state.room.myPlayerId
    );
    if (alreadyAnswered.length) {
      const alreadyEl = document.createElement("p");
      alreadyEl.className = "tagline";
      alreadyEl.textContent = `${formatWaitingList(alreadyAnswered)} ${alreadyAnswered.length === 1 ? "has" : "have"} already answered.`;
      card.appendChild(alreadyEl);
    }
  }

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
  if (topic === "lineups") {
    card.appendChild(renderLineupsBoard(q));
  }

  const reminder = document.createElement("div");
  reminder.className = "wager-reminder";
  reminder.innerHTML = `Wagering <strong>${state.current.wager}</strong> point${state.current.wager === 1 ? "" : "s"}`;
  card.appendChild(reminder);

  card.appendChild(
    renderHintRow(topic, q, HINTS[topic], (hint) => (topic === "playerCareer" ? "Shown in table" : hint.value(q)))
  );

  const hintCount = state.current.hintsRevealed.length;
  const stakes = document.createElement("div");
  stakes.innerHTML = renderStakesTable(state.current.wager, hintCount);
  card.appendChild(stakes);

  const submitBtn = document.createElement("button");
  submitBtn.className = "btn btn-primary btn-lg";
  submitBtn.textContent = "Submit Guess";

  const answerWidget =
    topic === "college"
      ? renderCollegeSearch()
      : topic === "jerseyNumbers"
      ? renderNumberInput((isValid) => {
          submitBtn.disabled = !isValid;
        })
      : renderPlayerSearch();
  card.appendChild(answerWidget);

  const selectedAnswer =
    topic === "college"
      ? state.current.selectedCollege
      : topic === "jerseyNumbers"
      ? state.current.selectedNumber
      : state.current.selectedPlayer;
  submitBtn.disabled = !selectedAnswer;
  submitBtn.addEventListener("click", () => {
    const guessed =
      topic === "college"
        ? state.current.selectedCollege
        : topic === "jerseyNumbers"
        ? state.current.selectedNumber
        : state.current.selectedPlayer.id;
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
      guessed:
        topic === "college"
          ? state.current.selectedCollege
          : topic === "jerseyNumbers"
          ? state.current.selectedNumber
          : state.current.selectedPlayer.name,
      // raw, encodable form of the same guess (an index/number/ID rather
      // than display text) - what actually rides along in a Challenge or
      // Final Results link, since arbitrary text isn't safe to embed there
      guessedRaw:
        topic === "college"
          ? collegesSearch.indexOf(state.current.selectedCollege)
          : topic === "jerseyNumbers"
          ? Number(state.current.selectedNumber)
          : guessed,
      spec: questionReplaySpec(topic, q),
    });
    syncRoomRound();
    if (state.room) {
      stopRoomPhaseTimer();
      render();
    } else {
      stopTimer();
      state.screen = "result";
      render();
    }
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
  headCells.push("Team", "G", "GS", "MPG", "PTS", "REB", "AST", "BLK", "STL");
  if (showAwards) headCells.push("Awards");

  const fmt1 = (v) => (typeof v === "number" ? v.toFixed(1) : v);

  const bodyRows = q.seasons
    .map((s) => {
      const cells = [s.season];
      if (showPos) cells.push(s.pos || "—");
      cells.push(s.team || "—", s.g, s.gs, fmt1(s.mpg), fmt1(s.pts), fmt1(s.trb), fmt1(s.ast), fmt1(s.blk), fmt1(s.stl));
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

function renderLineupsBoard(q) {
  const wrap = document.createElement("div");
  wrap.className = "career-table-wrap fill-blank-wrap";

  const rows = q.players
    .map((p, i) => {
      const isBlank = i === q.blankIndex;
      const nameCell = isBlank ? `<span class="fb-blank">???</span>` : p.name;
      return `<tr${isBlank ? ' class="fb-blank-row"' : ""}><td>${i + 1}</td><td>${nameCell}</td></tr>`;
    })
    .join("");

  wrap.innerHTML = `
    <table class="career-table fill-blank-table">
      <thead><tr><th>#</th><th>Player</th></tr></thead>
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

// Jersey Numbers guesses a plain number instead of searching for a player -
// onValidityChange lets the caller toggle the Submit button directly rather
// than calling render() on every keystroke, which would rebuild the input
// from scratch and kick focus out after every digit typed.
function renderNumberInput(onValidityChange) {
  const wrap = document.createElement("div");
  wrap.className = "search-wrap";
  wrap.innerHTML = `<input type="number" inputmode="numeric" min="0" max="99" class="search-input" id="numberGuessInput" placeholder="Enter jersey number (0-99)" autocomplete="off" />`;

  const input = wrap.querySelector("#numberGuessInput");
  if (state.current.selectedNumber !== null) input.value = state.current.selectedNumber;

  input.addEventListener("input", () => {
    const raw = input.value.trim();
    const isValid = raw !== "" && /^\d{1,2}$/.test(raw) && Number(raw) >= 0 && Number(raw) <= 99;
    state.current.selectedNumber = isValid ? raw : null;
    onValidityChange(isValid);
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
  if (state.room && state.history.length > state.round) {
    return roomWaitingCard(state.history[state.round]);
  }

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
    const onTimeout = () => {
      const delta = computePayout(state.current.wager, hintCount, false);
      state.totalScore += delta;
      state.history.push({
        topic,
        wager: state.current.wager,
        hints: hintCount,
        correct: false,
        delta,
        statLabel: q.statLabel,
        answer: correctAnswerName(topic, q),
        guessed: "(ran out of time)",
        guessedRaw: null,
        spec: questionReplaySpec(topic, q),
      });
      syncRoomRound();
      if (state.room) {
        stopRoomPhaseTimer();
        render();
      } else {
        stopTimer();
        state.screen = "result";
        render();
      }
    };
    if (state.room) {
      ensureRoomPhaseTimer(`question-${state.room.roundIndex}`, state.room.phaseDeadlineMs, onTimeout);
    } else {
      ensureTimer(`round-${state.round}`, onTimeout);
    }
  }

  const badge = document.createElement("div");
  badge.innerHTML = `<span class="topic-badge" style="color:${TOPIC_META.thisOrThat.color}">${TOPIC_META.thisOrThat.title}</span>`;
  card.appendChild(badge);

  if (!revealed) {
    card.appendChild(renderTimer(state.room ? roomSecondsLeft() : undefined));
    if (state.room) {
      const alreadyAnswered = readyNames(
        state.room.players || [],
        (p) => (p.history?.length || 0) > state.round,
        state.room.myPlayerId
      );
      if (alreadyAnswered.length) {
        const alreadyEl = document.createElement("p");
        alreadyEl.className = "tagline";
        alreadyEl.textContent = `${formatWaitingList(alreadyAnswered)} ${alreadyAnswered.length === 1 ? "has" : "have"} already answered.`;
        card.appendChild(alreadyEl);
      }
    }
  }

  const header = document.createElement("div");
  header.className = "question-block";
  header.innerHTML = revealed
    ? `<div class="question-text">Who had more <span class="hl">${q.statLabel}</span>?</div>`
    : `
    <div class="question-text">Who had more <span class="hl">${q.statLabel}</span>? Pick one, then submit.</div>
    <div class="wager-reminder">Wagering <strong>${state.current.wager}</strong> point${state.current.wager === 1 ? "" : "s"}</div>
  `;
  card.appendChild(header);

  const hintDefs = thisOrThatHints(q.statKey);

  if (!revealed) {
    card.appendChild(renderHintRow("thisOrThat", q, hintDefs, () => "Shown below each name"));
  }

  const playerHints = (player) =>
    state.current.hintsRevealed
      .map((key) => {
        const def = hintDefs.find((h) => h.key === key);
        return `<span class="tot-hint">${player[def.field].toLocaleString()} ${def.unit}</span>`;
      })
      .join("");

  const matchup = document.createElement("div");
  matchup.className = "tot-matchup";
  const correctSide = q.pair[0].value > q.pair[1].value ? 0 : 1;

  q.pair.forEach((player, side) => {
    const btn = document.createElement("button");
    btn.className = "tot-choice";
    if (revealed) {
      btn.disabled = true;
      if (side === correctSide) btn.classList.add("tot-choice-correct");
      else if (state.current.totSelection === side) btn.classList.add("tot-choice-wrong");
      btn.innerHTML = `<span class="tot-name">${player.name}</span>${playerHints(player)}<span class="tot-value">${player.value.toLocaleString()}</span>`;
    } else {
      if (state.current.totSelection === side) btn.classList.add("tot-choice-selected");
      btn.innerHTML = `<span class="tot-name">${player.name}</span>${playerHints(player)}`;
      btn.addEventListener("click", () => {
        state.current.totSelection = side;
        render();
      });
    }
    matchup.appendChild(btn);
  });

  const vs = document.createElement("div");
  vs.className = "tot-vs";
  vs.textContent = "VS";
  matchup.appendChild(vs);

  card.appendChild(matchup);

  if (revealed) {
    const correct = isThisOrThatCorrect(q, state.current.totSelection);
    const summary = document.createElement("div");
    summary.className = "result-detail";
    summary.textContent = correct ? "You picked the right side." : "You picked the wrong side.";
    card.appendChild(summary);

    const finishBtn = document.createElement("button");
    finishBtn.className = "btn btn-primary btn-lg";
    finishBtn.textContent = "See Round Result";
    finishBtn.addEventListener("click", () => {
      const delta = computePayout(state.current.wager, hintCount, correct);
      state.totalScore += delta;
      state.history.push({
        topic,
        wager: state.current.wager,
        hints: hintCount,
        correct,
        delta,
        statLabel: q.statLabel,
        answer: correctAnswerName(topic, q),
        guessed: q.pair[state.current.totSelection]?.name,
        guessedRaw: state.current.totSelection,
        spec: questionReplaySpec(topic, q),
      });
      syncRoomRound();
      if (!state.room) state.screen = "result";
      render();
    });
    card.appendChild(finishBtn);
    return card;
  }

  const stakes = document.createElement("div");
  stakes.innerHTML = renderStakesTable(state.current.wager, hintCount);
  card.appendChild(stakes);

  const submitBtn = document.createElement("button");
  submitBtn.className = "btn btn-primary btn-lg";
  submitBtn.textContent = "Submit Guess";
  submitBtn.disabled = state.current.totSelection === null;
  submitBtn.addEventListener("click", () => {
    stopTimer();
    if (state.room) stopRoomPhaseTimer();
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
      ? `You picked the right side on <strong>${last.statLabel}</strong>.`
      : `You picked the wrong side on <strong>${last.statLabel}</strong>.`;
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

  if (state.isReplay) {
    // state.totalScore is already this player's cumulative score through the
    // round just finished; the challenger's matching cumulative score is a sum
    // of their per-round deltas riding along in state.replayQueue up to here.
    const theirCumulative = state.replayQueue.slice(0, state.round + 1).reduce((sum, r) => sum + r.delta, 0);
    const yourText = `${state.totalScore > 0 ? "+" : ""}${state.totalScore}`;
    const theirText = `${theirCumulative > 0 ? "+" : ""}${theirCumulative}`;
    const scoreCard = document.createElement("div");
    scoreCard.className = "replay-scorecard";
    scoreCard.innerHTML = `
      <div class="replay-scorecard-title">Score After Round ${state.round + 1}</div>
      <div class="replay-scorecard-row">
        <span>You</span>
        <span class="${state.totalScore >= 0 ? "score-positive" : "score-negative"}">${yourText}</span>
      </div>
      <div class="replay-scorecard-row">
        <span>Them</span>
        <span class="${theirCumulative >= 0 ? "score-positive" : "score-negative"}">${theirText}</span>
      </div>
    `;
    card.appendChild(scoreCard);
  }

  if (state.room) {
    const standingsBtn = document.createElement("button");
    standingsBtn.className = "btn btn-ghost";
    standingsBtn.textContent = "🏆 Standings";
    standingsBtn.addEventListener("click", () => {
      state.showStandings = true;
      render();
    });
    card.appendChild(standingsBtn);
  }

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
      selectedNumber: null,
      totSelection: null,
      totSubmitted: false,
      autoSpun: false,
      wagerLocked: false,
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

// navigator.share's OS-level sheet doesn't reliably offer "post to X" on
// desktop (it's Messages/Notes/Mail-type targets instead) - this opens X's
// own tweet-compose intent link directly, pre-filled, in a new tab.
function postToX(text, url) {
  const params = new URLSearchParams({ text, url });
  window.open(`https://twitter.com/intent/tweet?${params.toString()}`, "_blank", "noopener,noreferrer");
}

function closeSharePopover() {
  document.querySelectorAll(".share-popover").forEach((el) => el.remove());
}

// One button, one small menu - covers "post to X directly" plus "anywhere
// else" (native share sheet for installed apps, or a copied link that works
// literally anywhere) without needing a second button on-screen per action.
function openSharePopover(anchorBtn, getPayload, statusEl, copyLabel = "Copy Link") {
  closeSharePopover();
  const { text, url } = getPayload();

  const rect = anchorBtn.getBoundingClientRect();
  const pop = document.createElement("div");
  pop.className = "share-popover";
  pop.style.top = `${rect.bottom + 8}px`;
  pop.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 216))}px`;
  pop.innerHTML = `
    <button class="share-popover-item" id="sharePopX">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      Post to X
    </button>
    <button class="share-popover-item" id="sharePopCopy">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
      ${copyLabel}
    </button>
    ${
      navigator.share
        ? `<button class="share-popover-item" id="sharePopMore">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.5l6.8-3.9M8.6 13.5l6.8 3.9"/></svg>
      More Options
    </button>`
        : ""
    }
  `;
  document.body.appendChild(pop);

  pop.querySelector("#sharePopX").addEventListener("click", () => {
    closeSharePopover();
    postToX(text, url);
  });
  pop.querySelector("#sharePopCopy").addEventListener("click", async () => {
    closeSharePopover();
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      statusEl.textContent = "Copied to clipboard!";
    } catch {
      statusEl.textContent = "Couldn't copy — please copy the link manually.";
    }
    setTimeout(() => {
      statusEl.textContent = "";
    }, 3000);
  });
  const moreBtn = pop.querySelector("#sharePopMore");
  if (moreBtn) {
    moreBtn.addEventListener("click", async () => {
      closeSharePopover();
      try {
        await navigator.share({ text, url });
      } catch {
        // AbortError (user cancelled the native sheet) or any other failure - nothing to do
      }
    });
  }

  // deferred so the same click that opened the popover doesn't immediately
  // count as an "outside click" and close it again
  setTimeout(() => {
    document.addEventListener("click", function onDocClick(e) {
      // this popover may have already been replaced by a newer one (e.g. the
      // same click that's bubbling here also opened a different share
      // button's popover) - bail out instead of nuking that newer popover
      if (!document.body.contains(pop)) {
        document.removeEventListener("click", onDocClick);
        return;
      }
      if (!pop.contains(e.target) && e.target !== anchorBtn) {
        closeSharePopover();
        document.removeEventListener("click", onDocClick);
      }
    });
  }, 0);
}

function screenEnd() {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<h2 class="screen-title">Game Over</h2>`;
  card.appendChild(gameSettingsLine());

  const scoreEl = document.createElement("div");
  scoreEl.className = "final-score";
  scoreEl.textContent = `${state.totalScore > 0 ? "+" : ""}${state.totalScore}`;
  card.appendChild(scoreEl);

  // the original challenger's per-round deltas ride along in state.replayQueue
  // (see parseRoundSpec) - summing them gives their final score with no extra
  // lookup needed, so a friend playing the link can see who actually won.
  const originalTotal = state.isReplay ? state.replayQueue.reduce((sum, r) => sum + r.delta, 0) : null;
  if (state.isReplay) {
    const outcome = state.totalScore > originalTotal ? "won" : state.totalScore < originalTotal ? "lost" : "tied";
    const outcomeLabel = outcome === "won" ? "You Won! 🎉" : outcome === "lost" ? "You Lost" : "It's a Tie!";
    const outcomeClass = outcome === "won" ? "score-positive" : outcome === "lost" ? "score-negative" : "";
    const banner = document.createElement("div");
    banner.className = "replay-outcome";
    banner.innerHTML = `
      <div class="replay-outcome-title ${outcomeClass}">${outcomeLabel}</div>
      <div class="replay-outcome-compare">You <strong>${state.totalScore > 0 ? "+" : ""}${state.totalScore}</strong> · Them <strong>${originalTotal > 0 ? "+" : ""}${originalTotal}</strong></div>
    `;
    card.appendChild(banner);
  }

  const history = document.createElement("div");
  history.className = "round-history";
  history.innerHTML = state.isReplay
    ? state.history
        .map((h, i) => {
          const theirs = state.replayQueue[i];
          const theirQ = pickQuestionFromSpec(theirs);
          const theirGuess = resolveGuessedDisplay(h.topic, theirs.guessed, theirQ);
          const side = (who, wager, delta, guessText) => `
            <div class="rrr-side">
              <div class="rrr-side-main">
                <span class="rrr-who">${who}</span>
                <span class="rrr-wager">wagered ${wager}</span>
                <span class="rrr-delta ${delta >= 0 ? "score-positive" : "score-negative"}">${delta > 0 ? "+" : ""}${delta}</span>
              </div>
              <div class="rrr-guess">${guessText}</div>
            </div>`;
          return `
          <div class="round-row-replay">
            <div class="rrr-topic">#${i + 1} · ${TOPIC_META[h.topic].title}</div>
            ${side("You", h.wager, h.delta, h.guessed)}
            ${side("Them", theirs.wager, theirs.delta, theirGuess)}
          </div>`;
        })
        .join("")
    : state.history
        .map(
          (h, i) => `
      <div class="round-row">
        <div class="rr-main">
          <span class="rr-topic">#${i + 1} · ${TOPIC_META[h.topic].title} · wagered ${h.wager}</span>
          <span class="rr-delta ${h.delta >= 0 ? "score-positive" : "score-negative"}">${h.delta > 0 ? "+" : ""}${h.delta}</span>
        </div>
        <div class="rr-guess">${h.correct ? `Answer: ${h.answer}` : `Your guess: ${h.guessed} · Answer: ${h.answer}`}</div>
      </div>`
    )
    .join("");
  card.appendChild(history);

  const scoreText = `${state.totalScore > 0 ? "+" : ""}${state.totalScore}`;
  const siteUrl = `${location.origin}${location.pathname}`;

  // each action's share text/link built once so both the generic Share
  // button and its dedicated "post to X" icon button send the same content
  const sendResultPayload = () => {
    const originalText = `${originalTotal > 0 ? "+" : ""}${originalTotal}`;
    // the challenger's already-decoded per-round data (wager/delta/guessed)
    // rides along in state.replayQueue since the challenge link carried it -
    // combine it with this playthrough's own state.history to build a link
    // that shows the complete round-by-round breakdown to whoever opens it,
    // with no gameplay required on their end
    const specs = state.history.map((h, i) => ({
      ...h.spec,
      challenger: { delta: state.replayQueue[i].delta, wager: state.replayQueue[i].wager, guessed: state.replayQueue[i].guessed },
      opponent: { delta: h.delta, wager: h.wager, guessed: h.guessedRaw },
    }));
    const resultsCode = encodeResultsCode(specs, state.difficulty);
    const resultsUrl = `${siteUrl}?res=${resultsCode}`;
    let text;
    if (state.totalScore > originalTotal) {
      text = `I beat your Quizzy challenge! Final score: me ${scoreText}, you ${originalText}. Click the link to see the full results.`;
    } else if (state.totalScore < originalTotal) {
      text = `You got me on your Quizzy challenge. Final score: you ${originalText}, me ${scoreText}. Click the link to see the full results.`;
    } else {
      text = `We tied on your Quizzy challenge — we both scored ${scoreText}. Click the link to see the full results.`;
    }
    return { text, url: resultsUrl };
  };
  const shareResultsPayload = () => {
    const lines = state.history.map((h) => `${TOPIC_META[h.topic].title}: ${h.delta > 0 ? "+" : ""}${h.delta}`);
    return { text: `My Quizzy score: ${scoreText}\n${lines.join("\n")}`, url: siteUrl };
  };
  const challengePayload = () => {
    // carry each round's own wager, point delta, and guessed answer along
    // with its question identity, so whoever opens this link can see a live
    // "you vs them" score as they play, what each side actually guessed,
    // and a full breakdown at the end
    const specs = state.history.map((h) => ({ ...h.spec, delta: h.delta, wager: h.wager, guessed: h.guessedRaw }));
    const code = encodeReplayCode(specs, state.difficulty);
    const diffDesc = DIFFICULTY_LEVELS[state.difficulty].description;
    return {
      text: `I challenge you to this ${state.history.length}-question, ${diffDesc}, Quizzy.`,
      url: `${siteUrl}?g=${code}`,
    };
  };

  // A friend playing someone else's challenge shouldn't see "Share Results"
  // or "Challenge a Friend" - re-sharing or re-challenging from inside
  // someone else's game is confusing, and the only thing that actually makes
  // sense here is reporting the outcome back to whoever sent the challenge.
  const shareRow = document.createElement("div");
  shareRow.className = "share-row";
  shareRow.innerHTML = state.isReplay
    ? `<button class="btn btn-ghost" id="sendResultBtn">Send Back Result</button>`
    : `
    <button class="btn btn-ghost" id="shareResultsBtn">Share Results</button>
    <button class="btn btn-ghost" id="challengeBtn">Challenge a Friend</button>
  `;
  card.appendChild(shareRow);

  const shareStatus = document.createElement("div");
  shareStatus.className = "share-status";
  card.appendChild(shareStatus);

  if (state.isReplay) {
    const btn = shareRow.querySelector("#sendResultBtn");
    btn.addEventListener("click", () => openSharePopover(btn, sendResultPayload, shareStatus));
  } else {
    const shareBtn = shareRow.querySelector("#shareResultsBtn");
    shareBtn.addEventListener("click", () => openSharePopover(shareBtn, shareResultsPayload, shareStatus, "Copy Results"));

    const challengeBtn = shareRow.querySelector("#challengeBtn");
    challengeBtn.addEventListener("click", () => openSharePopover(challengeBtn, challengePayload, shareStatus));
  }

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

// A read-only recap opened from a "Send Back Result" link. Unlike screenEnd
// (which is always about "your" own just-finished game), whoever opens this
// link is neither guaranteed to be the original challenger nor the person
// who played it back - so sides are labeled by role ("Challenger" /
// "Opponent") instead of "You"/"Them", which would be wrong for a third
// party or even the challenger themselves (their own data would show up
// under "Them" from the sender's perspective otherwise).
function screenResultsView() {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<h2 class="screen-title">Final Results</h2>`;
  card.appendChild(gameSettingsLine());

  const queue = state.resultsQueue;
  const challengerTotal = queue.reduce((sum, r) => sum + r.challenger.delta, 0);
  const opponentTotal = queue.reduce((sum, r) => sum + r.opponent.delta, 0);
  const outcome = opponentTotal > challengerTotal ? "opponent" : challengerTotal > opponentTotal ? "challenger" : "tied";
  const outcomeLabel =
    outcome === "tied" ? "It's a Tie!" : outcome === "opponent" ? "Opponent Won! 🎉" : "Challenger Won! 🎉";

  const banner = document.createElement("div");
  banner.className = "replay-outcome";
  banner.innerHTML = `
    <div class="replay-outcome-title">${outcomeLabel}</div>
    <div class="replay-outcome-compare">Challenger <strong>${challengerTotal > 0 ? "+" : ""}${challengerTotal}</strong> · Opponent <strong>${opponentTotal > 0 ? "+" : ""}${opponentTotal}</strong></div>
  `;
  card.appendChild(banner);

  const history = document.createElement("div");
  history.className = "round-history";
  history.innerHTML = queue
    .map((r, i) => {
      const q = pickQuestionFromSpec(r);
      const challengerGuess = resolveGuessedDisplay(r.t, r.challenger.guessed, q);
      const opponentGuess = resolveGuessedDisplay(r.t, r.opponent.guessed, q);
      const side = (who, s, guessText) => `
        <div class="rrr-side">
          <div class="rrr-side-main">
            <span class="rrr-who">${who}</span>
            <span class="rrr-wager">wagered ${s.wager}</span>
            <span class="rrr-delta ${s.delta >= 0 ? "score-positive" : "score-negative"}">${s.delta > 0 ? "+" : ""}${s.delta}</span>
          </div>
          <div class="rrr-guess">${guessText}</div>
        </div>`;
      return `
      <div class="round-row-replay">
        <div class="rrr-topic">#${i + 1} · ${TOPIC_META[r.t].title}</div>
        ${side("Challenger", r.challenger, challengerGuess)}
        ${side("Opponent", r.opponent, opponentGuess)}
      </div>`;
    })
    .join("");
  card.appendChild(history);

  const playBtn = document.createElement("button");
  playBtn.className = "btn btn-primary btn-lg";
  playBtn.textContent = "Play Quizzy Yourself";
  playBtn.addEventListener("click", () => {
    state = freshState();
    render();
  });
  card.appendChild(playBtn);

  return card;
}

// Resets every field that carries progress from a previous game in this same
// browser tab (score, history, used wagers/questions) - needed because
// creating or joining a room reuses state.gameLength/state.difficulty/etc.
// directly rather than going through freshState(), so a leftover solo game
// played earlier in the session would otherwise bleed into the room game.
function resetGameProgress() {
  state.totalScore = 0;
  state.history = [];
  state.usedWagers = new Set();
  state.round = 0;
  state.usedQuestionIds = freshState().usedQuestionIds;
}

function screenRoomCreate() {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <h2 class="screen-title">Create a Room</h2>
    <div class="form-field">
      <input type="text" class="search-input" id="roomHostName" placeholder="Your name" autocomplete="off" maxlength="20" value="${state.roomHostName.replace(/"/g, "&quot;")}" />
    </div>
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
    ${state.roomJoinError ? `<div class="replay-expired-banner">${state.roomJoinError}</div>` : ""}
    <button class="btn btn-primary btn-lg" id="createRoomSubmitBtn">Create Room</button>
    <button class="btn btn-ghost" id="roomBackBtn">Back</button>
  `;
  // the picker buttons below call render() on click, which rebuilds this
  // whole card from scratch - the name input has to be backed by state (like
  // gameLength/difficulty already are) or a click on either picker would
  // wipe out whatever the user had already typed.
  card.querySelector("#roomHostName").addEventListener("input", (e) => {
    state.roomHostName = e.target.value;
  });
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
  card.querySelector("#roomBackBtn").addEventListener("click", () => {
    state.roomJoinError = null;
    state.screen = "multiplayerHome";
    render();
  });
  card.querySelector("#createRoomSubmitBtn").addEventListener("click", async () => {
    const name = state.roomHostName.trim();
    if (!name) {
      state.roomJoinError = "Please enter your name.";
      render();
      return;
    }
    if (!state.gameLength || !state.difficulty) {
      state.roomJoinError = "Please choose a question count and difficulty.";
      render();
      return;
    }
    const btn = card.querySelector("#createRoomSubmitBtn");
    btn.disabled = true;
    btn.textContent = "Creating…";
    resetGameProgress();
    const specs = generateRoomSpecs(state.gameLength);
    try {
      const { code, playerId } = await window.QuizzyRoom.createRoom({
        hostName: name,
        difficulty: state.difficulty,
        gameLength: state.gameLength,
        specs,
      });
      state.room = {
        code,
        myPlayerId: playerId,
        isHost: true,
        specs,
        difficulty: state.difficulty,
        gameLength: state.gameLength,
        phase: "lobby",
        roundIndex: 0,
        phaseDeadlineMs: null,
        players: [],
      };
      state.roomJoinError = null;
      ensureRoomSubscription(code);
      state.screen = "roomLobby";
      render();
    } catch {
      state.roomJoinError = "Couldn't create the room — please try again.";
      render();
    }
  });
  return card;
}

function screenRoomJoin() {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <h2 class="screen-title">Join a Room</h2>
    <div class="form-field">
      <input type="text" class="search-input room-code-input" id="roomCodeInput" placeholder="Room code" autocomplete="off" maxlength="5" value="${state.roomJoinPrefillCode || ""}" />
    </div>
    <div class="form-field">
      <input type="text" class="search-input" id="roomNameInput" placeholder="Your name" autocomplete="off" maxlength="20" />
    </div>
    ${state.roomJoinError ? `<div class="replay-expired-banner">${state.roomJoinError}</div>` : ""}
    <button class="btn btn-primary btn-lg" id="joinRoomSubmitBtn">Join Room</button>
    <button class="btn btn-ghost" id="roomBackBtn">Back</button>
  `;
  card.querySelector("#roomBackBtn").addEventListener("click", () => {
    state.roomJoinError = null;
    state.roomJoinPrefillCode = null;
    state.screen = "multiplayerHome";
    render();
  });
  card.querySelector("#joinRoomSubmitBtn").addEventListener("click", async () => {
    const code = card.querySelector("#roomCodeInput").value.trim().toUpperCase();
    const name = card.querySelector("#roomNameInput").value.trim();
    if (!code || !name) {
      state.roomJoinError = "Please enter a room code and your name.";
      render();
      return;
    }
    const btn = card.querySelector("#joinRoomSubmitBtn");
    btn.disabled = true;
    btn.textContent = "Joining…";
    const result = await window.QuizzyRoom.joinRoom({ code, name }).catch(() => ({ error: "unknown" }));
    if (result.error) {
      state.roomJoinError =
        result.error === "not_found"
          ? "That room code wasn't found."
          : result.error === "in_progress"
          ? "That room already started — ask the host for a new one."
          : "Couldn't join that room — please try again.";
      render();
      return;
    }
    resetGameProgress();
    state.difficulty = result.room.difficulty;
    state.gameLength = result.room.gameLength;
    state.room = {
      code,
      myPlayerId: result.playerId,
      isHost: false,
      specs: result.room.specs,
      difficulty: result.room.difficulty,
      gameLength: result.room.gameLength,
      phase: result.room.phase,
      roundIndex: result.room.roundIndex,
      phaseDeadlineMs: null,
      players: [],
    };
    state.roomJoinError = null;
    state.roomJoinPrefillCode = null;
    ensureRoomSubscription(code);
    state.screen = "roomLobby";
    render();
  });
  return card;
}

// Shared by the lobby ready-check and the wager/question waiting states -
// everywhere a player needs to see who the room is still waiting on.
function waitingOnNames(players, isReadyFn, myPlayerId) {
  return players.filter((p) => p.id !== myPlayerId && !isReadyFn(p)).map((p) => p.name);
}

// The inverse - who's already locked in/answered, shown alongside the
// interactive wager/question form itself (not just after this player has
// submitted) so nobody's left wondering whether anyone else has moved yet.
function readyNames(players, isReadyFn, myPlayerId) {
  return players.filter((p) => p.id !== myPlayerId && isReadyFn(p)).map((p) => p.name);
}

// Shared by the reveal/standings screens - a "Next" button that writes this
// player's own ack for the given phase/round, or (once clicked) a "waiting
// on X" line, exactly like the lobby's ready-button pattern. Nobody needs a
// countdown to know when to move on - the room moves on the moment everyone
// still connected has clicked.
function roomAckControls(phase, roundIndex) {
  const players = state.room.players || [];
  const isAcked = (p) => p.ackPhase === phase && p.ackRoundIndex === roundIndex;
  const me = players.find((p) => p.id === state.room.myPlayerId);
  const iHaveAcked = !!me && isAcked(me);
  const waiting = waitingOnNames(players, isAcked, state.room.myPlayerId);

  const wrap = document.createElement("div");
  wrap.className = "room-ack-controls";
  if (iHaveAcked) {
    const p = document.createElement("p");
    p.className = "tagline";
    p.textContent = waiting.length ? `Waiting on: ${formatWaitingList(waiting)}` : "Everyone's ready — moving on…";
    wrap.appendChild(p);
  } else {
    const btn = document.createElement("button");
    btn.className = "btn btn-primary btn-lg";
    btn.textContent = "Next";
    btn.addEventListener("click", () => {
      window.QuizzyRoom.setRoomAck(state.room.code, state.room.myPlayerId, phase, roundIndex).catch((e) => {
        // Swallowed everywhere else in room mode, but this one's worth a
        // console trace - a silently-rejected ack write looks, from the
        // player's side, exactly like a broken "Next" button (it just sits
        // there until the hidden fallback timer eventually bails everyone
        // out). The most likely cause is the live Firestore rules not
        // matching firestore.rules - e.g. a permission-denied here almost
        // always means the console rules haven't been updated to allow the
        // ackPhase/ackRoundIndex fields.
        console.error("[Quizzy] setRoomAck failed - \"Next\" will silently do nothing until the room's hidden fallback timer advances it:", e);
      });
    });
    wrap.appendChild(btn);
  }
  return wrap;
}

// Shared leaderboard look for the standings screen and the final room
// results - ranked rows with a medal for the top 3, the current player
// called out, and the leader highlighted.
function renderLeaderboard(players, { showProgress = false } = {}) {
  const sorted = players.slice().sort((a, b) => b.totalScore - a.totalScore);
  const list = document.createElement("div");
  list.className = "leaderboard";
  list.innerHTML = sorted
    .map((p, i) => {
      const rank = i + 1;
      const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank;
      const isMe = p.id === state.room.myPlayerId;
      const progress = showProgress
        ? `<span class="lb-progress">${p.history?.length || 0}/${state.room.gameLength}</span>`
        : "";
      return `
        <div class="lb-row${rank === 1 ? " lb-row-first" : ""}${isMe ? " lb-row-me" : ""}">
          <span class="lb-rank">${medal}</span>
          <span class="lb-name">${p.name}${p.isHost ? " · Host" : ""}${isMe ? " · You" : ""}</span>
          ${progress}
          <span class="lb-score ${p.totalScore >= 0 ? "score-positive" : "score-negative"}">${p.totalScore > 0 ? "+" : ""}${p.totalScore}</span>
        </div>`;
    })
    .join("");
  return list;
}

function formatWaitingList(names) {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

// Shown in place of the question/this-or-that form once this player has
// already submitted or timed out for the current round - the room's phase
// advancing to "reveal" (once everyone's answered or the clock runs out) is
// what moves everyone on together, not anything this player does here.
function roomWaitingCard(lastEntry) {
  stopRoomPhaseTimer(); // defensive - every path into this card should have already stopped it itself
  const card = document.createElement("div");
  card.className = "card";
  card.appendChild(scoreBadge());
  card.appendChild(progressBar());
  card.appendChild(statusBar());

  const title = document.createElement("h2");
  title.className = "screen-title";
  title.textContent = "Answer Locked In";
  card.appendChild(title);

  const resultLine = document.createElement("p");
  resultLine.className = "tagline";
  resultLine.textContent =
    lastEntry.guessed === "(ran out of time)" ? "⏰ Time ran out." : lastEntry.correct ? "✅ Correct!" : "❌ Not quite.";
  card.appendChild(resultLine);

  const players = state.room.players || [];
  const waiting = waitingOnNames(players, (p) => (p.history?.length || 0) > state.round, state.room.myPlayerId);
  const waitLine = document.createElement("p");
  waitLine.className = "tagline";
  waitLine.textContent = waiting.length ? `Waiting on: ${formatWaitingList(waiting)}` : "Everyone's answered — moving on…";
  card.appendChild(waitLine);

  return card;
}

function screenRoomLobby() {
  const card = document.createElement("div");
  card.className = "card";
  const players = state.room.players || [];
  const me = players.find((p) => p.id === state.room.myPlayerId);
  const iAmReady = !!me?.readyToStart;
  const enoughPlayers = players.length >= 2;
  const waiting = waitingOnNames(players, (p) => p.readyToStart, state.room.myPlayerId);
  const siteUrl = `${location.origin}${location.pathname}`;
  const inviteUrl = `${siteUrl}?room=${state.room.code}`;
  card.innerHTML = `
    <h2 class="screen-title">Room Lobby</h2>
    <p class="tagline game-settings-line">${DIFFICULTY_LEVELS[state.room.difficulty].label} · ${state.room.gameLength} Questions</p>
    <div class="room-code-display">${state.room.code}</div>
    <button class="btn btn-ghost" id="shareInviteBtn">Share Invite</button>
    <h2 class="screen-title">Players (${players.length})</h2>
    <div class="room-player-list">
      ${players
        .map(
          (p) => `
        <div class="room-player-row">
          <span>${p.name}${p.isHost ? " · Host" : ""}</span>
          ${p.readyToStart ? `<span class="score-positive">Ready</span>` : ""}
        </div>`
        )
        .join("")}
    </div>
    ${
      !enoughPlayers
        ? `<p class="tagline">Waiting for a friend to join…</p>`
        : iAmReady
        ? `<p class="tagline">${waiting.length ? `Waiting on: ${formatWaitingList(waiting)}` : "Everyone's ready — starting…"}</p>`
        : `<button class="btn btn-primary btn-lg" id="readyBtn">I'm Ready</button>`
    }
  `;
  const shareStatus = document.createElement("div");
  shareStatus.className = "share-status";
  card.appendChild(shareStatus);

  card.querySelector("#shareInviteBtn").addEventListener("click", () => {
    openSharePopover(
      card.querySelector("#shareInviteBtn"),
      () => ({ text: `Join my Quizzy room! Room code: ${state.room.code}`, url: inviteUrl }),
      shareStatus,
      "Copy Invite"
    );
  });

  card.querySelector("#readyBtn")?.addEventListener("click", () => {
    window.QuizzyRoom.setReady(state.room.code, state.room.myPlayerId).catch(() => {});
  });

  return card;
}

// Shared by screenRoomEnd's N-player round breakdown - same shape as the
// 2-party "side" row template duplicated inline in screenEnd/screenResultsView,
// generalized to take a pending flag (a player who hasn't reached this round
// yet has no entry to show a wager/delta for) and an optional hints count.
function roundSideHtml(who, wager, delta, guessText, pending, hints) {
  const hintsText = !pending && hints ? ` · ${hints} hint${hints === 1 ? "" : "s"} used` : "";
  return `
    <div class="rrr-side">
      <div class="rrr-side-main">
        <span class="rrr-who">${who}</span>
        <span class="rrr-wager">${pending ? "" : `wagered ${wager}`}</span>
        <span class="rrr-delta ${pending ? "" : delta >= 0 ? "score-positive" : "score-negative"}">${pending ? "…" : `${delta > 0 ? "+" : ""}${delta}`}</span>
      </div>
      <div class="rrr-guess">${guessText}${hintsText}</div>
    </div>`;
}

// Live-updating per-round breakdown, shown to the whole room together right
// after everyone's answered (or the question clock ran out) - the reveal
// counterpart to the wager/question waiting screens, generalizing
// screenRoomEnd's "every round, every player" table down to just this round.
function screenRoomReveal() {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<h2 class="screen-title">Round Results</h2>`;
  card.appendChild(gameSettingsLine());

  const roundIndex = state.room.roundIndex;
  const spec = state.room.specs[roundIndex];
  const q = pickQuestionFromSpec(spec);
  const answer = q ? correctAnswerName(spec.t, q) : "—";

  const answerLine = document.createElement("p");
  answerLine.className = "tagline";
  answerLine.innerHTML = `#${roundIndex + 1} · <span class="topic-badge" style="color:${TOPIC_META[spec.t].color}">${TOPIC_META[spec.t].title}</span> — the answer was <strong>${answer}</strong>`;
  card.appendChild(answerLine);

  const players = (state.room.players || []).slice().sort((a, b) => b.totalScore - a.totalScore);
  const sidesHtml = players
    .map((p) => {
      const entry = p.history?.[roundIndex];
      if (!entry) return roundSideHtml(p.name, null, 0, "Not answered", true);
      const guessText = entry.correct ? `Answer: ${entry.answer}` : `Guessed ${entry.guessed} — Answer: ${entry.answer}`;
      return roundSideHtml(p.name, entry.wager, entry.delta, guessText, false, entry.hints);
    })
    .join("");
  const roundBlock = document.createElement("div");
  roundBlock.className = "round-row-replay";
  roundBlock.innerHTML = sidesHtml;
  card.appendChild(roundBlock);

  card.appendChild(roomAckControls("reveal", roundIndex));

  // Not shown anywhere in the UI - purely a background safety net so a room
  // with a disconnected player doesn't wait forever for a "Next" click that
  // will never come. See ROOM_REVEAL_SECONDS.
  ensureRoomPhaseTimer(`reveal-${roundIndex}`, state.room.phaseDeadlineMs, () => {
    maybeAdvanceRoomPhase();
  });

  return card;
}

// Auto-advancing standings screen between rounds (or before the final
// results) - promotes renderStandingsModal's content from a manually-opened
// modal into a real screen the whole room sees together for a fixed beat.
function screenRoomStandings() {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<h2 class="screen-title">Standings</h2>`;
  card.appendChild(gameSettingsLine());

  card.appendChild(renderLeaderboard(state.room.players || [], { showProgress: true }));

  card.appendChild(roomAckControls("standings", state.room.roundIndex));

  // Not shown anywhere in the UI - purely a background safety net so a room
  // with a disconnected player doesn't wait forever for a "Next" click that
  // will never come. See ROOM_STANDINGS_SECONDS.
  ensureRoomPhaseTimer(`standings-${state.room.roundIndex}`, state.room.phaseDeadlineMs, () => {
    maybeAdvanceRoomPhase();
  });

  return card;
}

// Live-updating leaderboard + round-by-round breakdown for a room game.
// Stays on the still-open room subscription (started back in
// screenRoomCreate/screenRoomJoin, torn down only on "Play Again" below), so
// scores keep updating here even after this player reaches this screen -
// they can watch everyone else finish live.
function screenRoomEnd() {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<h2 class="screen-title">Room Results</h2>`;
  card.appendChild(gameSettingsLine());

  const players = (state.room.players || []).slice().sort((a, b) => b.totalScore - a.totalScore);

  const maxScore = players.length ? Math.max(...players.map((p) => p.totalScore)) : 0;
  const winners = players.filter((p) => p.totalScore === maxScore);
  const outcomeLabel = winners.length > 1 ? "It's a Tie!" : `${winners[0].name} Wins! 🎉`;
  const banner = document.createElement("div");
  banner.className = "replay-outcome";
  banner.innerHTML = `<div class="replay-outcome-title">${outcomeLabel}</div>`;
  card.appendChild(banner);

  card.appendChild(renderLeaderboard(players, {}));

  const history = document.createElement("div");
  history.className = "round-history";
  history.innerHTML = state.room.specs
    .map((spec, i) => {
      const q = pickQuestionFromSpec(spec);
      const answer = q ? correctAnswerName(spec.t, q) : "—";
      const rows = players
        .map((p) => {
          const entry = p.history?.[i];
          if (!entry) return `<div class="rr-guess-row"><span>${p.name}</span><span class="score-negative">No answer</span></div>`;
          const cls = entry.correct ? "score-positive" : "score-negative";
          return `<div class="rr-guess-row"><span>${p.name}</span><span class="${cls}">${entry.guessed}</span></div>`;
        })
        .join("");
      return `
      <div class="round-row-replay">
        <div class="rrr-topic">#${i + 1} · ${TOPIC_META[spec.t].title}</div>
        <div class="rrr-answer">Answer: ${answer}</div>
        ${rows}
      </div>`;
    })
    .join("");
  card.appendChild(history);

  const again = document.createElement("button");
  again.className = "btn btn-primary btn-lg";
  again.textContent = "Play Again";
  again.addEventListener("click", () => {
    teardownRoomSubscription();
    state = freshState();
    render();
  });
  card.appendChild(again);

  return card;
}

// ---------- Boot ----------
async function loadData() {
  const [d, pc, tot, cq, cs, dq, p, fb, as, tc, tm, lu, jn] = await Promise.all([
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
    fetch("data/lineups_boards.json").then((r) => r.json()),
    fetch("data/jersey_numbers_questions.json").then((r) => r.json()),
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
  lineupsBoards = lu;
  jerseyNumbersQuestions = jn;
}

function readReplayCodeFromURL() {
  const code = new URLSearchParams(location.search).get("g");
  return code ? decodeReplayCode(code) : null;
}

function readResultsCodeFromURL() {
  const code = new URLSearchParams(location.search).get("res");
  return code ? decodeResultsCode(code) : null;
}

function readRoomCodeFromURL() {
  return new URLSearchParams(location.search).get("room");
}

// Question data can get rebuilt/rebalanced over time (new topic, a bug fix
// like the decade-boundary one, etc.), which can shift or drop the IDs an
// older Challenge/Results link points to. Rather than silently landing on
// the normal start screen with no explanation (confusing - looks like the
// link just did nothing), a link that can't be fully resolved shows a
// banner explaining it's expired instead.
const pendingResults = readResultsCodeFromURL();
const pendingReplay = pendingResults ? null : readReplayCodeFromURL();
const pendingRoomCode = pendingResults || pendingReplay ? null : readRoomCodeFromURL();

loadData().then(() => {
  if (pendingRoomCode) {
    state.roomJoinPrefillCode = pendingRoomCode.toUpperCase();
    state.showWelcome = false;
    state.screen = "roomJoin";
  } else if (pendingResults) {
    const resolvable = pendingResults.q.every((spec) => pickQuestionFromSpec(spec) !== null);
    if (resolvable) {
      state.resultsQueue = pendingResults.q;
      state.difficulty = pendingResults.d;
      state.gameLength = pendingResults.q.length;
      state.showWelcome = false;
      state.screen = "resultsView";
    } else {
      state.replayLinkExpired = true;
    }
  } else if (pendingReplay) {
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

// firebase-room.js finishes initializing independently of loadData() above
// (and can take a moment for the anonymous sign-in round trip) - if the mode
// select screen already rendered its "loading multiplayer..." state before
// that resolves, this re-renders once it's actually ready or definitely isn't.
window.addEventListener("quizzyroomready", () => {
  if (state.screen === "modeSelect") render();
});

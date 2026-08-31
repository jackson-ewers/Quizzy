// Shared-room multiplayer backend. This is the only external dependency in
// the whole project - loaded as its own ES module (index.html) so app.js can
// stay a plain classic script and just call window.QuizzyRoom.* like any
// other global, without needing a bundler.
import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  arrayUnion,
  increment,
  serverTimestamp,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously,
  setPersistence,
  browserSessionPersistence,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L - read aloud & typed on phones
const ROOM_CODE_LENGTH = 5;

const QuizzyRoom = {
  isReady: false,
  isUnavailable: false,
};
window.QuizzyRoom = QuizzyRoom;

let db = null;
let auth = null;

// Always read the live signed-in uid rather than caching it once - it costs
// nothing and closes off a whole class of staleness bugs if the session ever
// changes underneath us.
function currentUid() {
  return auth.currentUser.uid;
}

function generateRoomCode() {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}
QuizzyRoom.generateRoomCode = generateRoomCode;

async function createRoom({ hostName, difficulty, gameLength, specs }) {
  const uid = currentUid();
  // small retry loop in case of a code collision - vanishingly unlikely at
  // this alphabet/length, but cheap to guard against
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    const roomRef = doc(db, "rooms", code);
    const existing = await getDoc(roomRef);
    if (existing.exists()) continue;

    await setDoc(roomRef, {
      hostId: uid,
      hostName,
      difficulty,
      gameLength,
      specs,
      phase: "lobby",
      roundIndex: 0,
      phaseStartedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, "rooms", code, "players", uid), {
      name: hostName,
      isHost: true,
      history: [],
      totalScore: 0,
      joinedAt: serverTimestamp(),
      finishedAt: null,
      readyToStart: false,
      pendingWager: null,
      pendingWagerRound: -1,
    });
    return { code, playerId: uid };
  }
  throw new Error("Couldn't create a room right now - please try again.");
}
QuizzyRoom.createRoom = createRoom;

async function peekRoom(code) {
  const snap = await getDoc(doc(db, "rooms", code));
  return snap.exists() ? { code, ...snap.data() } : null;
}
QuizzyRoom.peekRoom = peekRoom;

async function joinRoom({ code, name }) {
  const uid = currentUid();
  const room = await peekRoom(code);
  if (!room) return { error: "not_found" };
  if (room.phase !== "lobby") return { error: "in_progress" };

  await setDoc(doc(db, "rooms", code, "players", uid), {
    name,
    isHost: false,
    history: [],
    totalScore: 0,
    joinedAt: serverTimestamp(),
    finishedAt: null,
    readyToStart: false,
    pendingWager: null,
    pendingWagerRound: -1,
  });
  return { room, playerId: uid };
}
QuizzyRoom.joinRoom = joinRoom;

function subscribeRoom(code, { onRoom, onPlayers }) {
  const unsubRoom = onSnapshot(doc(db, "rooms", code), (snap) => {
    if (snap.exists()) onRoom({ code, ...snap.data() });
  });
  const unsubPlayers = onSnapshot(query(collection(db, "rooms", code, "players")), (snap) => {
    const players = [];
    snap.forEach((d) => players.push({ id: d.id, ...d.data() }));
    onPlayers(players);
  });
  return () => {
    unsubRoom();
    unsubPlayers();
  };
}
QuizzyRoom.subscribeRoom = subscribeRoom;

async function setReady(code, playerId) {
  await updateDoc(doc(db, "rooms", code, "players", playerId), { readyToStart: true });
}
QuizzyRoom.setReady = setReady;

async function setPendingWager(code, playerId, roundIndex, wager) {
  await updateDoc(doc(db, "rooms", code, "players", playerId), {
    pendingWager: wager,
    pendingWagerRound: roundIndex,
  });
}
QuizzyRoom.setPendingWager = setPendingWager;

// Every phase transition goes through here rather than a plain updateDoc, so
// that any number of clients racing to advance the same transition (e.g. the
// last two players finish answering within milliseconds of each other) can't
// double-advance the room - the transaction only commits if phase/roundIndex
// still match what this call expects to be leaving, so a client whose view
// of the room is already stale just silently no-ops instead of clobbering
// whatever the winning client already wrote.
async function advancePhase(code, { fromPhase, fromRoundIndex, toPhase, toRoundIndex }) {
  const roomRef = doc(db, "rooms", code);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.phase !== fromPhase || data.roundIndex !== fromRoundIndex) return;
    tx.update(roomRef, { phase: toPhase, roundIndex: toRoundIndex, phaseStartedAt: serverTimestamp() });
  });
}
QuizzyRoom.advancePhase = advancePhase;

async function submitRoundResult(code, playerId, entry, isLastRound) {
  const update = {
    history: arrayUnion(entry),
    totalScore: increment(entry.delta),
  };
  if (isLastRound) update.finishedAt = serverTimestamp();
  await updateDoc(doc(db, "rooms", code, "players", playerId), update);
}
QuizzyRoom.submitRoundResult = submitRoundResult;

(async function init() {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    // Session-scoped, not the Firebase default (local/IndexedDB) - a room
    // identity has no reason to persist across tabs or browser restarts (we
    // don't support resuming a room after a refresh anyway), and local
    // persistence would otherwise silently merge every tab of this origin
    // into one shared anonymous identity, e.g. two tabs open on the same
    // computer would collide as "the same player" in a room.
    await setPersistence(auth, browserSessionPersistence);
    await signInAnonymously(auth);
    QuizzyRoom.isReady = true;
  } catch (err) {
    // Firebase not configured yet, CDN blocked, offline, etc. - multiplayer
    // just stays unavailable rather than throwing into app.js's click handlers.
    console.warn("Quizzy multiplayer unavailable:", err.message);
    QuizzyRoom.isUnavailable = true;
  }
  // app.js may already have rendered the start screen before this resolves -
  // this lets it know to re-render once multiplayer is actually usable (or
  // definitely isn't), without app.js needing to poll for readiness.
  window.dispatchEvent(new Event("quizzyroomready"));
})();

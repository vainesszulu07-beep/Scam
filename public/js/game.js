import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://eimecuiixwgmpfpedxpr.supabase.co",
  "sb_publishable_yFjk-cShSqVzlQye7DqRdg_F3AJ39ou"
);

const els = {
  statusEl: document.getElementById("status"),
  statusBox: document.getElementById("statusBox"),
  meInfo: document.getElementById("meInfo"),
  gameInfo: document.getElementById("gameInfo"),
  turnInfo: document.getElementById("turnInfo"),
  winnerInfo: document.getElementById("winnerInfo"),
  boardEl: document.getElementById("board"),
  exitBtn: document.getElementById("exitBtn"),
  clearUiBtn: document.getElementById("clearUiBtn")
};

const state = {
  userId: null,
  currentGame: null,
  boardTemplate: ["", "", "", "", "", "", "", "", ""],
  realtimeChannel: null,
  cleanupTimer: null,
  cleanupDoneForGameId: null
};

const urlParams = new URLSearchParams(window.location.search);
const urlGameId = urlParams.get("gameId");

async function rpcSingle(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data;
}

async function rpcRows(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return Array.isArray(data) ? data : data ? [data] : [];
}

function createEmptyBoard() {
  return ["", "", "", "", "", "", "", "", ""];
}

function isBoardArray(value) {
  return Array.isArray(value) && value.length === 9;
}

function setStatus(text, mode = "") {
  els.statusEl.textContent = text;
  els.statusEl.className = "status-pill" + (mode ? ` ${mode}` : "");
  els.statusBox.textContent = text;
}

function showRawError(context, err) {
  const raw =
    err && typeof err === "object"
      ? JSON.stringify(err, Object.getOwnPropertyNames(err), 2)
      : String(err);

  const message = err?.message ? err.message : String(err);
  setStatus(`${context}\n${message}\n\nRAW ERROR:\n${raw}`, "finished");
  console.error(context, err);
}

async function getUser() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session || !session.user) throw new Error("Not logged in");
  state.userId = session.user.id;
  return state.userId;
}

function renderBoard(board) {
  const safeBoard = isBoardArray(board) ? board : createEmptyBoard();

  for (let i = 0; i < 9; i++) {
    const el = document.getElementById(`cell${i}`);
    if (!el) continue;

    const value = safeBoard[i] || "";
    el.textContent = value;
    el.className = "cell";
    if (value === "X") el.classList.add("x", "filled");
    if (value === "O") el.classList.add("o", "filled");
  }
}

function updateMeta(game) {
  els.meInfo.textContent = state.userId || "—";

  if (!game) {
    els.gameInfo.textContent = "—";
    els.turnInfo.textContent = "—";
    els.winnerInfo.textContent = "—";
    return;
  }

  const role =
    game.player_x === state.userId ? "X" :
    game.player_o === state.userId ? "O" :
    "Viewer";

  els.gameInfo.textContent = `${game.id} (${role})`;
  els.turnInfo.textContent = game.turn || "—";
  els.winnerInfo.textContent = game.winner_user || game.winner || "—";

  if (game.status === "playing") {
    setStatus("Live game", "live");
  } else if (game.status === "waiting") {
    setStatus("Waiting for opponent", "waiting");
  } else if (game.status === "finished") {
    setStatus("Game finished", "finished");
  } else {
    setStatus("Idle", "");
  }
}

async function loadBoardInfo(gameId) {
  const rows = await rpcRows("get_game_board_info", { p_game_id: gameId });
  const info = rows[0] || null;
  if (info && isBoardArray(info.board_template)) {
    state.boardTemplate = info.board_template;
  } else {
    state.boardTemplate = createEmptyBoard();
  }
  return info;
}

async function syncCurrentGame(game) {
  state.currentGame = game || null;

  if (game?.game_type_id) {
    await loadBoardInfo(game.id).catch(() => null);
  } else {
    state.boardTemplate = createEmptyBoard();
  }

  renderBoard(game?.board_state || state.boardTemplate);
  updateMeta(game);
}

function subscribeToGameRealtime(gameId) {
  if (state.realtimeChannel) {
    supabase.removeChannel(state.realtimeChannel);
    state.realtimeChannel = null;
  }

  if (!gameId) return;

  state.realtimeChannel = supabase
    .channel(`tic-tac-toe-${gameId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` },
      async (payload) => {
        await syncCurrentGame(payload.new);

        if (payload.new?.status === "finished") {
          scheduleFinishedCleanup();
        }
      }
    )
    .subscribe();
}

async function openCurrentGame() {
  await getUser();

  let game = null;

  if (urlGameId) {
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .eq("id", urlGameId)
      .maybeSingle();

    if (error) throw error;
    if (data && (data.player_x === state.userId || data.player_o === state.userId)) {
      game = data;
    }
  }

  if (!game) {
    game = await rpcSingle("get_active_playing_game").catch(() => null);
  }

  if (!game) {
    state.currentGame = null;
    state.boardTemplate = createEmptyBoard();
    renderBoard(state.boardTemplate);
    updateMeta(null);
    setStatus("No active game", "");
    return;
  }

  await syncCurrentGame(game);
  subscribeToGameRealtime(game.id);

  if (game.status === "finished") {
    scheduleFinishedCleanup();
  }
}

async function makeMove(index) {
  if (!state.currentGame || state.currentGame.status !== "playing") return;

  try {
    const updated = await rpcSingle("make_move", {
      p_game_id: state.currentGame.id,
      p_cell_index: index
    });

    await syncCurrentGame(updated);

    if (updated.status === "finished") {
      scheduleFinishedCleanup();
    }
  } catch (err) {
    showRawError("Could not make move", err);
  }
}

async function leaveCurrentGame() {
  if (!state.currentGame) return;

  try {
    const updated = await rpcSingle("leave_game", { p_game_id: state.currentGame.id });
    state.cleanupDoneForGameId = updated?.id || null;
    await syncCurrentGame(updated);
  } catch (err) {
    showRawError("Could not leave game", err);
  }
}

function scheduleFinishedCleanup() {
  if (!state.currentGame || state.cleanupDoneForGameId === state.currentGame.id) return;

  if (state.cleanupTimer) clearTimeout(state.cleanupTimer);

  const gameId = state.currentGame.id;
  state.cleanupTimer = setTimeout(async () => {
    try {
      if (state.cleanupDoneForGameId === gameId) return;
      state.cleanupDoneForGameId = gameId;

      const reset = await rpcSingle("leave_game", { p_game_id: gameId });
      await syncCurrentGame(reset);
    } catch (err) {
      showRawError("Could not auto-reset finished game", err);
    }
  }, 1200);
}

function setupBoardClicks() {
  for (let i = 0; i < 9; i++) {
    const cell = document.getElementById(`cell${i}`);
    if (cell) cell.onclick = () => makeMove(i);
  }
}

els.exitBtn.onclick = leaveCurrentGame;
els.clearUiBtn.onclick = () => {
  els.winnerInfo.textContent = state.currentGame?.winner_user || state.currentGame?.winner || "—";
};

async function init() {
  setupBoardClicks();
  await openCurrentGame();
}

init();

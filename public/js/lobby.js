import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://eimecuiixwgmpfpedxpr.supabase.co",
  "sb_publishable_yFjk-cShSqVzlQye7DqRdg_F3AJ39ou"
);

const PLACEHOLDER_IMAGE = "https://via.placeholder.com/600x400?text=Game";

const els = {
  panelBtn: document.getElementById("panelBtn"),
  drawerOverlay: document.getElementById("drawerOverlay"),
  drawerCloseBtn: document.getElementById("drawerCloseBtn"),
  statusEl: document.getElementById("status"),
  statusBox: document.getElementById("statusBox"),
  meInfo: document.getElementById("meInfo"),
  gameInfo: document.getElementById("gameInfo"),
  turnInfo: document.getElementById("turnInfo"),
  winnerInfo: document.getElementById("winnerInfo"),
  exitBtn: document.getElementById("exitBtn"),
  gameTypesListEl: document.getElementById("gameTypesList"),
  waitingSessionsEl: document.getElementById("waitingSessions"),
  selectedTypeName: document.getElementById("selectedTypeName"),
  selectedTypeMeta: document.getElementById("selectedTypeMeta")
};

const state = {
  userId: null,
  personalGame: null,
  currentGame: null,
  currentGameType: null,
  selectedGameType: null,
  boardTemplate: ["", "", "", "", "", "", "", "", ""],
  inGame: false,
  realtimeChannel: null,
  gameTypesChannel: null,
  drawerOpen: false
};

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

function createEmptyBoard() {
  return ["", "", "", "", "", "", "", "", ""];
}

function isBoardArray(value) {
  return Array.isArray(value) && value.length === 9;
}

function setDrawer(open) {
  state.drawerOpen = open;
  els.drawerOverlay.classList.toggle("open", open);
  els.drawerOverlay.setAttribute("aria-hidden", open ? "false" : "true");
}

function setInGameUI(isInGame) {
  state.inGame = isInGame;
  els.panelBtn.disabled = isInGame;
  els.panelBtn.style.opacity = isInGame ? ".35" : "1";
  els.exitBtn.style.display = isInGame ? "inline-grid" : "none";
  if (isInGame) setDrawer(false);
}

function updateSelectedTypePanel() {
  if (!state.selectedGameType) {
    els.selectedTypeName.textContent = "No game selected";
    els.selectedTypeMeta.textContent = "Tap a game type in the panel.";
    return;
  }

  els.selectedTypeName.textContent = state.selectedGameType.name || "Selected game";
  els.selectedTypeMeta.textContent =
    `Type ID: ${state.selectedGameType.id || "—"} · Board: ${state.selectedGameType.board_type || "unknown"} · File: ${state.selectedGameType.file_type || "unknown"}`;
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

  if (game.winner_user) {
    els.winnerInfo.textContent = game.winner_user;
  } else if (game.winner) {
    els.winnerInfo.textContent = game.winner;
  } else {
    els.winnerInfo.textContent = "—";
  }

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

async function loadGameTypes() {
  const rows = await rpcRows("list_game_types");
  els.gameTypesListEl.innerHTML = "";

  if (!rows.length) {
    els.gameTypesListEl.innerHTML = `<div class="small">No game types yet.</div>`;
    return;
  }

  rows.forEach((gameType) => {
    const card = document.createElement("div");
    card.className = "type-card";
    card.innerHTML = `
      <img class="type-image" src="${gameType.image_url || PLACEHOLDER_IMAGE}" alt="${gameType.name || "Game"}">
      <div class="type-body">
        <div class="type-name">${gameType.name || "Unnamed Game"}</div>
        <p class="type-meta">Board type: ${gameType.board_type || "unknown"}</p>
        <div class="pill">${gameType.file_type || "no file"}</div>
      </div>
    `;
    card.onclick = () => selectGameType(gameType);
    els.gameTypesListEl.appendChild(card);
  });
}

async function loadWaitingGames(gameTypeId) {
  const rows = await rpcRows("list_waiting_games", { p_game_type_id: gameTypeId });
  els.waitingSessionsEl.innerHTML = "";

  if (!rows.length) {
    els.waitingSessionsEl.innerHTML = `<div class="small">No waiting sessions for this type.</div>`;
    return;
  }

  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "game-item";
    item.innerHTML = `
      <strong>${row.host_name || "Host"}</strong>
      <div class="small">Game ID: ${row.game_id}</div>
      <div class="small">Status: ${row.status}</div>
      <button class="join-btn" type="button">Join Game</button>
    `;

    item.querySelector(".join-btn").onclick = async () => {
      try {
        const joined = await rpcSingle("join_waiting_game", { p_game_id: row.game_id });
        await afterGameChanged(joined);
      } catch (err) {
        showRawError("Could not join waiting game", err);
      }
    };

    els.waitingSessionsEl.appendChild(item);
  });
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
  state.currentGameType = null;

  if (game?.game_type_id) {
    const info = await loadBoardInfo(game.id).catch(() => null);
    if (info) state.currentGameType = info;
  } else {
    state.boardTemplate = createEmptyBoard();
  }

  updateMeta(game);
  updateSelectedTypePanel();
  setInGameUI(!!game && (game.status === "playing" || game.status === "finished"));
}

async function redirectToGame(game) {
  if (!game?.game_type_id) return;

  const gameType = state.selectedGameType && state.selectedGameType.id === game.game_type_id
    ? state.selectedGameType
    : await rpcRows("list_game_types").then(rows => rows.find(x => x.id === game.game_type_id) || null);

  if (!gameType) return;

  const file = gameType.file_type;
  if (!file) return;

  const fileName = file.endsWith(".html") ? file : `${file}.html`;
  window.location.href = `/games/${fileName}?gameId=${encodeURIComponent(game.id)}`;
}

async function selectGameType(gameType) {
  try {
    state.selectedGameType = gameType;
    updateSelectedTypePanel();
    await loadWaitingGames(gameType.id);
  } catch (err) {
    showRawError("Could not select game type", err);
  }
}

async function openGameFromUrlOrActive() {
  await getUser();
  await rpcSingle("get_or_create_personal_game");

  let game = await rpcSingle("get_active_playing_game").catch(() => null);

  if (game && game.status === "playing") {
    await redirectToGame(game);
    return;
  }

  state.currentGame = null;
  state.currentGameType = null;
  state.selectedGameType = null;
  state.boardTemplate = createEmptyBoard();
  updateMeta(null);
  updateSelectedTypePanel();
  setInGameUI(false);
}

function subscribeToGameTypesRealtime() {
  if (state.gameTypesChannel) {
    supabase.removeChannel(state.gameTypesChannel);
    state.gameTypesChannel = null;
  }

  state.gameTypesChannel = supabase
    .channel("game-types-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "game_types" },
      async () => {
        await loadGameTypes().catch((err) => showRawError("Could not reload game types", err));
        if (state.selectedGameType) {
          await loadWaitingGames(state.selectedGameType.id).catch(() => {});
        }
      }
    )
    .subscribe();
}

function subscribeToGameRealtime() {
  if (state.realtimeChannel) {
    supabase.removeChannel(state.realtimeChannel);
    state.realtimeChannel = null;
  }

  state.realtimeChannel = supabase
    .channel("games-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "games" },
      async (payload) => {
        const updated = payload.new;
        if (!updated) return;

        if (updated.status === "playing" && (updated.player_x === state.userId || updated.player_o === state.userId)) {
          await redirectToGame(updated);
          return;
        }

        if (updated.player_x === state.userId || updated.player_o === state.userId) {
          if (state.selectedGameType?.id && updated.game_type_id === state.selectedGameType.id) {
            await loadWaitingGames(updated.game_type_id).catch(() => {});
          }
        }
      }
    )
    .subscribe();
}

async function afterGameChanged(updatedGame) {
  await syncCurrentGame(updatedGame);

  if (updatedGame?.game_type_id) {
    state.selectedGameType = await rpcRows("list_game_types").then(rows =>
      rows.find((g) => g.id === updatedGame.game_type_id) || state.selectedGameType
    );
    await loadWaitingGames(updatedGame.game_type_id).catch(() => {});
  }

  if (updatedGame?.status === "finished") {
    await rpcSingle("leave_game", { p_game_id: updatedGame.id }).catch(() => {});
    const reset = await rpcSingle("get_or_create_personal_game").catch(() => null);
    if (reset) {
      state.currentGame = null;
      setInGameUI(false);
      updateMeta(null);
      updateSelectedTypePanel();
    }
  }

  if (updatedGame?.status === "playing") {
    setInGameUI(true);
    setDrawer(false);
    await redirectToGame(updatedGame);
  }
}

async function leaveCurrentGame() {
  if (!state.currentGame) return;

  try {
    const updated = await rpcSingle("leave_game", { p_game_id: state.currentGame.id });
    state.currentGame = updated;
    await syncCurrentGame(updated);
    setInGameUI(false);
    setDrawer(false);
  } catch (err) {
    showRawError("Could not leave game", err);
  }
}

els.panelBtn.onclick = () => {
  if (state.inGame) return;
  setDrawer(true);
};

els.drawerCloseBtn.onclick = () => setDrawer(false);
els.drawerOverlay.addEventListener("click", (e) => {
  if (e.target === els.drawerOverlay) setDrawer(false);
});

els.exitBtn.onclick = leaveCurrentGame;
els.clearUiBtn.onclick = () => {
  if (state.currentGame?.winner) {
    els.winnerInfo.textContent = state.currentGame.winner_user || state.currentGame.winner;
  } else {
    els.winnerInfo.textContent = "—";
  }
};

async function init() {
  await getUser();
  await loadGameTypes();
  await openGameFromUrlOrActive();
  subscribeToGameTypesRealtime();
  subscribeToGameRealtime();
  setInGameUI(!!state.currentGame && state.currentGame.status === "playing");
  setDrawer(false);
}

init();

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

export const supabase = createClient(
  "https://eimecuiixwgmpfpedxpr.supabase.co",
  "sb_publishable_yFjk-cShSqVzlQye7DqRdg_F3AJ39ou"
);

export const PLACEHOLDER_IMAGE = "https://via.placeholder.com/600x400?text=Game";

export const els = {
  statusEl: document.getElementById("status"),
  gameTypesListEl: document.getElementById("gameTypesList"),
  sheetOverlay: document.getElementById("sheetOverlay"),
  sheetInner: document.getElementById("sheetInner"),
  sheetCloseBtn: document.getElementById("sheetCloseBtn"),
  sheetModeBtn: document.getElementById("sheetModeBtn"),
  sheetThumb: document.getElementById("sheetThumb"),
  sheetName: document.getElementById("sheetName"),
  sheetMeta: document.getElementById("sheetMeta"),
  selectedInfoTitle: document.getElementById("selectedInfoTitle"),
  selectedInfoMeta: document.getElementById("selectedInfoMeta"),
  waitingSessionsEl: document.getElementById("waitingSessions"),
  sheetPlayBtn: document.getElementById("sheetPlayBtn"),
  sheetExitBtn: document.getElementById("sheetExitBtn"),
  gameCodeInput: document.getElementById("gameCodeInput"),
  joinByCodeBtn: document.getElementById("joinByCodeBtn"),
  joinCodeStatus: document.getElementById("joinCodeStatus")
};

export const state = {
  userId: null,
  myGame: null,
  selectedGameType: null,
  selectedGameTypeId: null,
  selectedSheetMode: "players",
  gameTypesChannel: null,
  selectedTypeGamesChannel: null,
  channel: null,
  bootInProgress: false,
  bootSessionUserId: null,
  redirectInProgress: false
};

export function setStatus(text, mode = "") {
  els.statusEl.innerText = text;
  els.statusEl.className = mode ? mode : "";
}

export function showRawError(context, err) {
  const raw =
    err && typeof err === "object"
      ? JSON.stringify(err, Object.getOwnPropertyNames(err), 2)
      : String(err);

  const message = err?.message ? err.message : String(err);
  els.statusEl.innerText = `${context}\n${message}\n\nRAW ERROR:\n${raw}`;
  console.error(context, err);
}

export function resetLobbyState() {
  if (state.gameTypesChannel) {
    supabase.removeChannel(state.gameTypesChannel);
    state.gameTypesChannel = null;
  }

  if (state.selectedTypeGamesChannel) {
    supabase.removeChannel(state.selectedTypeGamesChannel);
    state.selectedTypeGamesChannel = null;
  }

  if (state.channel) {
    supabase.removeChannel(state.channel);
    state.channel = null;
  }

  state.myGame = null;
  state.selectedGameType = null;
  state.selectedGameTypeId = null;
  state.selectedSheetMode = "players";
  state.redirectInProgress = false;

  els.gameCodeInput.value = "";
  els.joinCodeStatus.textContent = "";
  els.waitingSessionsEl.innerHTML = "";
  els.sheetOverlay.classList.remove("open");
  els.sheetOverlay.setAttribute("aria-hidden", "true");
  setStatus("Loading...");
}

export function setSheetMode(mode) {
  state.selectedSheetMode = mode;
  els.sheetInner.classList.toggle("code-mode", mode === "code");
  els.sheetModeBtn.textContent = mode === "code" ? "👥" : "🔑";
}

export function toggleSheetMode() {
  setSheetMode(state.selectedSheetMode === "players" ? "code" : "players");
}

export async function getUser() {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error || !session || !session.user) {
    throw new Error("Not logged in");
  }

  state.userId = session.user.id;
  return state.userId;
}

export function getInitialBoard(boardType) {
  if (boardType === "tictactoe") {
    return ["", "", "", "", "", "", "", "", ""];
  }
  return null;
}

export async function getGameTypeById(gameTypeId) {
  const { data, error } = await supabase
    .from("game_types")
    .select("*")
    .eq("id", gameTypeId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getActivePlayingGame() {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .or(`player_x.eq.${state.userId},player_o.eq.${state.userId}`)
    .eq("status", "playing")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export async function createGameIfNeeded() {
  if (!state.userId) throw new Error("User not loaded");

  const { data, error } = await supabase
    .from("games")
    .select("*")
    .or(`player_x.eq.${state.userId},player_o.eq.${state.userId}`)
    .in("status", ["idle", "waiting", "playing"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;

  if (data && data[0]) {
    state.myGame = data[0];
    return state.myGame;
  }

  const { data: created, error: createError } = await supabase
    .from("games")
    .insert({
      player_x: state.userId,
      status: "idle",
      game_type_id: null,
      turn: "X",
      board_state: null
    })
    .select()
    .single();

  if (createError) throw createError;

  state.myGame = created;
  return created;
}

export async function loadProfilesByIds(ids) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))];
  if (uniqueIds.length === 0) return {};

  const { data, error } = await supabase
    .from("profile")
    .select("id, full_name, avatar_url")
    .in("id", uniqueIds);

  if (error) throw error;

  const map = {};
  (data || []).forEach((row) => {
    map[row.id] = row;
  });
  return map;
}

export function updateSelectedInfo(gameType, game) {
  if (!gameType) {
    els.selectedInfoTitle.textContent = "—";
    els.selectedInfoMeta.textContent = "Tap a game type to start.";
    return;
  }

  els.selectedInfoTitle.textContent = gameType.name || "Selected game";

  if (game) {
    const lines = [];
    lines.push(`Your game: ${game.id}`);
    lines.push(`Status: ${game.status}`);
    lines.push(`Game type ID: ${game.game_type_id || "none"}`);
    if (game.player_x) lines.push(`Player X: ${game.player_x}`);
    if (game.player_o) lines.push(`Player O: ${game.player_o || "empty"}`);
    els.selectedInfoMeta.textContent = lines.join(" · ");
  } else {
    els.selectedInfoMeta.textContent = `Board type: ${gameType.board_type || "unknown"} · Game type ID: ${gameType.id}`;
  }
}

export function updateExitButtonVisibility(game) {
  const shouldShow =
    !!game &&
    game.status === "playing" &&
    (game.player_x === state.userId || game.player_o === state.userId);

  els.sheetExitBtn.style.display = shouldShow ? "block" : "none";
}

export function updateMyGameUI(game) {
  if (!game) {
    els.sheetPlayBtn.textContent = "Play This Game";
    els.sheetPlayBtn.disabled = false;
    updateExitButtonVisibility(null);
    return;
  }

  if (game.status === "idle") {
    els.sheetPlayBtn.textContent = "Play This Game";
    els.sheetPlayBtn.disabled = false;
  } else if (game.status === "waiting") {
    els.sheetPlayBtn.textContent = "Waiting...";
    els.sheetPlayBtn.disabled = false;
  } else if (game.status === "playing") {
    els.sheetPlayBtn.textContent = "Playing...";
    els.sheetPlayBtn.disabled = true;
  } else {
    els.sheetPlayBtn.textContent = "Play This Game";
    els.sheetPlayBtn.disabled = true;
  }

  updateExitButtonVisibility(game);
}

export function redirectToGame(game) {
  if (!game) return;
  if (state.redirectInProgress) return;

  state.redirectInProgress = true;

  getGameTypeById(game.game_type_id)
    .then((gameType) => {
      if (!gameType) {
        throw new Error("Game type not found");
      }

      const file = gameType.file_type;
      if (!file) {
        throw new Error("No file_type set in game_types");
      }

      const fileName = file.endsWith(".html") ? file : `${file}.html`;
      window.location.href = `/games/${fileName}?gameId=${encodeURIComponent(game.id)}`;
    })
    .catch((err) => {
      state.redirectInProgress = false;
      showRawError("Redirect failed", err);
    });
}

export async function syncMyGameToSelectedType(gameType) {
  if (!state.myGame) throw new Error("No game available to sync");

  const typeChanged = state.myGame.game_type_id !== gameType.id;

  const updatePayload = {
    game_type_id: gameType.id,
    status: "waiting"
  };

  if (typeChanged) {
    updatePayload.player_o = null;
    updatePayload.turn = "X";
    updatePayload.winner = null;
    updatePayload.board_state = getInitialBoard(gameType.board_type);
  }

  const { data, error } = await supabase
    .from("games")
    .update(updatePayload)
    .eq("id", state.myGame.id)
    .select()
    .single();

  if (error) throw error;
  state.myGame = data;
  return state.myGame;
}

export async function joinWaitingGame(gameId, hostId) {
  try {
    await getUser();

    if (!state.selectedGameType) {
      setStatus("⚠️ Select a game type first.");
      return;
    }

    if (hostId === state.userId) {
      setStatus("⚠️ You cannot join your own game.");
      return;
    }

    const { error } = await supabase
      .from("games")
      .update({
        player_o: state.userId,
        status: "playing"
      })
      .eq("id", gameId)
      .eq("game_type_id", state.selectedGameTypeId)
      .is("player_o", null)
      .eq("status", "waiting");

    if (error) throw error;

    const { data: joinedGame, error: joinedError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .maybeSingle();

    if (joinedError) throw joinedError;
    if (!joinedGame) throw new Error("Joined game not found after update");

    state.myGame = joinedGame;
    updateSelectedInfo(state.selectedGameType, state.myGame);
    updateMyGameUI(state.myGame);

    setStatus(`🎮 Joined game\nID: ${gameId}`);
    return joinedGame;
  } catch (err) {
    showRawError("Could not join that game", err);
    return null;
  }
}

export async function joinByCode() {
  try {
    await getUser();

    if (!state.selectedGameType) {
      els.joinCodeStatus.textContent = "Select a game type first.";
      return;
    }

    const code = els.gameCodeInput.value.trim();
    if (!code) {
      els.joinCodeStatus.textContent = "Enter a game code first.";
      return;
    }

    els.joinCodeStatus.textContent = "Checking code...";

    const { data: targetGame, error } = await supabase
      .from("games")
      .select("*")
      .eq("id", code)
      .maybeSingle();

    if (error) throw error;
    if (!targetGame) {
      els.joinCodeStatus.textContent = "Game code not found.";
      return;
    }

    const targetGameType = await getGameTypeById(targetGame.game_type_id);

    if (!targetGameType) {
      els.joinCodeStatus.textContent = "Game type not found.";
      return;
    }

    state.selectedGameType = targetGameType;
    state.selectedGameTypeId = targetGameType.id;
    els.sheetThumb.src = targetGameType.image_url || PLACEHOLDER_IMAGE;
    els.sheetName.textContent = targetGameType.name || "Game";
    els.sheetMeta.textContent = `Board type: ${targetGameType.board_type || "unknown"}`;
    updateSelectedInfo(state.selectedGameType, state.myGame);

    if (targetGame.status !== "waiting" || targetGame.player_o) {
      els.joinCodeStatus.textContent = "That game is not available.";
      return;
    }

    await joinWaitingGame(targetGame.id, targetGame.player_x);
    els.joinCodeStatus.textContent = "Joined.";
    setSheetMode("players");
  } catch (err) {
    showRawError("Could not join by code", err);
    els.joinCodeStatus.textContent = `Could not join by code.\n${err?.message || String(err)}`;
  }
}

export async function playCurrentType() {
  try {
    await getUser();

    if (!state.selectedGameType) return;

    if (!state.myGame) {
      state.myGame = await createGameIfNeeded();
    }

    state.myGame = await syncMyGameToSelectedType(state.selectedGameType);

    setStatus(`⏳ Your game is now waiting\nID: ${state.myGame.id}`);
    updateSelectedInfo(state.selectedGameType, state.myGame);
    updateMyGameUI(state.myGame);
  } catch (err) {
    showRawError("Could not update your game", err);
  }
}

export async function exitCurrentGame() {
  try {
    await getUser();

    if (!state.myGame || state.myGame.status !== "playing") {
      els.sheetExitBtn.style.display = "none";
      return;
    }

    const isHost = state.myGame.player_x === state.userId;

    const update = isHost
      ? {
          status: "idle",
          player_o: null,
          game_type_id: null,
          turn: null,
          board_state: null,
          winner: null
        }
      : { status: "waiting", player_o: null };

    const { data, error } = await supabase
      .from("games")
      .update(update)
      .eq("id", state.myGame.id)
      .select()
      .single();

    if (error) throw error;

    state.myGame = data;
    updateSelectedInfo(state.selectedGameType, state.myGame);
    updateMyGameUI(state.myGame);

    if (isHost) {
      setStatus(`🚪 Game exited and reset to idle\nID: ${state.myGame.id}`);
    } else {
      setStatus(`🚪 You left the game\nID: ${state.myGame.id}`);
    }
  } catch (err) {
    showRawError("Could not exit game", err);
  }
}

export function closeSheet() {
  els.sheetOverlay.classList.remove("open");
  els.sheetOverlay.setAttribute("aria-hidden", "true");
  state.selectedGameType = null;
  state.selectedGameTypeId = null;
  state.myGame = null;
  els.waitingSessionsEl.innerHTML = "";
  els.joinCodeStatus.textContent = "";

  if (state.selectedTypeGamesChannel) {
    supabase.removeChannel(state.selectedTypeGamesChannel);
    state.selectedTypeGamesChannel = null;
  }
}

async function refreshAfterGamesChange(deps) {
  try {
    const activePlayingGame = await getActivePlayingGame();

    if (activePlayingGame) {
      state.myGame = activePlayingGame;
      const activeGameType = await getGameTypeById(activePlayingGame.game_type_id);

      if (activeGameType) {
        redirectToGame(activePlayingGame);
        return;
      }
    }

    if (state.selectedGameType && typeof deps.openGameTypeSheet === "function") {
      await deps.openGameTypeSheet(state.selectedGameType, state.myGame);
      return;
    }

    updateSelectedInfo(null, null);
    updateMyGameUI(state.myGame);
  } catch (err) {
    showRawError("Failed to refresh from games table", err);
  }
}

export async function subscribeToMyGameChanges(deps) {
  if (state.channel) {
    await supabase.removeChannel(state.channel);
    state.channel = null;
  }

  if (!state.userId) return;

  state.channel = supabase
    .channel(`games-live-${state.userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "games",
        filter: `player_x=eq.${state.userId}`
      },
      async () => {
        await refreshAfterGamesChange(deps);
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "games",
        filter: `player_o=eq.${state.userId}`
      },
      async () => {
        await refreshAfterGamesChange(deps);
      }
    )
    .subscribe();

  return state.channel;
}

async function boot(session, deps) {
  if (!session?.user) {
    resetLobbyState();
    els.statusEl.innerText = "❌ Not logged in";
    return;
  }

  const nextUserId = session.user.id;
  if (state.bootInProgress && state.bootSessionUserId === nextUserId) return;

  state.bootInProgress = true;
  state.bootSessionUserId = nextUserId;

  try {
    resetLobbyState();
    state.userId = nextUserId;

    await createGameIfNeeded();
    await subscribeToMyGameChanges(deps);

    const activePlayingGame = await getActivePlayingGame();
    if (activePlayingGame) {
      state.myGame = activePlayingGame;
      const activeGameType = await getGameTypeById(activePlayingGame.game_type_id);

      if (activeGameType) {
        redirectToGame(activePlayingGame);
        return;
      }
    }

    await deps.loadGameTypes();
    await deps.subscribeToGameTypes();

    updateSelectedInfo(null, null);
    updateMyGameUI(state.myGame);

    setStatus("Idle");
    els.statusEl.innerText = "Tap a game type to open it.";
  } catch (err) {
    showRawError("Failed to load lobby", err);
  } finally {
    state.bootInProgress = false;
  }
}

export async function initApp(deps) {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  await boot(session, deps);

  supabase.auth.onAuthStateChange(async (_event, session) => {
    await boot(session, deps);
  });
}

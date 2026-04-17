import {
  supabase,
  state,
  els,
  PLACEHOLDER_IMAGE,
  setStatus,
  showRawError,
  loadProfilesByIds,
  updateSelectedInfo,
  updateMyGameUI,
  createGameIfNeeded,
  syncMyGameToSelectedType,
  getGameTypeById,
  setSheetMode
} from "./create_game.js";

export async function loadGameTypes() {
  const { data, error } = await supabase
    .from("game_types")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const types = data || [];
  els.gameTypesListEl.innerHTML = "";

  if (types.length === 0) {
    els.gameTypesListEl.innerHTML = `<div class="empty-state">No game types yet.</div>`;
    return;
  }

  types.forEach((gameType) => {
    const card = document.createElement("div");
    card.className = "type-card";
    card.innerHTML = `
      <img class="type-image" src="${gameType.image_url || PLACEHOLDER_IMAGE}" alt="${gameType.name || "Game"}">
      <div class="type-body">
        <div class="type-name">${gameType.name || "Unnamed Game"}</div>
        <p class="type-meta">Tap to open</p>
        <div class="pill">${gameType.board_type || "unknown"}</div>
      </div>
    `;

    card.onclick = () => openGameTypeSheet(gameType);
    els.gameTypesListEl.appendChild(card);
  });
}

export async function loadWaitingGamesForType(gameTypeId) {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("game_type_id", gameTypeId)
    .eq("status", "waiting")
    .is("player_o", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const waitingGames = data || [];
  const hostIds = waitingGames.map(g => g.player_x);
  const profiles = await loadProfilesByIds(hostIds);

  els.waitingSessionsEl.innerHTML = "";

  if (waitingGames.length === 0) {
    els.waitingSessionsEl.innerHTML = `<div class="empty-state">No waiting sessions for this game type yet.</div>`;
    return;
  }

  waitingGames.forEach((game) => {
    const hostProfile = profiles[game.player_x] || {};
    const hostName = hostProfile.full_name || game.player_x || "Host";
    const avatar = hostProfile.avatar_url || PLACEHOLDER_IMAGE;

    const item = document.createElement("div");
    item.className = "game-item";
    item.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <img class="avatar" src="${avatar}" alt="">
        <div style="flex:1;min-width:0;">
          <strong>${hostName}</strong>
          <div class="small">Game ID: ${game.id}</div>
          <div class="small">Status: ${game.status}</div>
        </div>
      </div>
      <div class="small" style="margin-top:8px;">Tap to paste code and join.</div>
      <button class="join-btn" type="button">Use Code</button>
    `;

    item.querySelector(".join-btn").onclick = () => {
      els.gameCodeInput.value = game.id;
      setSheetMode("code");
    };

    item.onclick = (e) => {
      if (e.target && e.target.classList && e.target.classList.contains("join-btn")) return;
      els.gameCodeInput.value = game.id;
      setSheetMode("code");
    };

    els.waitingSessionsEl.appendChild(item);
  });
}

export async function subscribeToGameTypes() {
  if (state.gameTypesChannel) {
    await supabase.removeChannel(state.gameTypesChannel);
  }

  state.gameTypesChannel = supabase
    .channel("game-types-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "game_types" },
      () => {
        loadGameTypes().catch((err) => showRawError("Failed to reload game types", err));
      }
    )
    .subscribe();
}

export async function subscribeToSelectedTypeGames(gameTypeId) {
  if (state.selectedTypeGamesChannel) {
    await supabase.removeChannel(state.selectedTypeGamesChannel);
  }

  state.selectedTypeGamesChannel = supabase
    .channel(`games-${gameTypeId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "games",
        filter: `game_type_id=eq.${gameTypeId}`
      },
      async () => {
        if (!state.selectedGameType) return;
        await refreshSelectedTypeState();
      }
    )
    .subscribe();
}

export async function refreshSelectedTypeState() {
  if (!state.selectedGameTypeId || !state.selectedGameType) return;

  const { data: refreshed, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", state.myGame?.id || "")
    .maybeSingle();

  if (error) throw error;

  if (refreshed) state.myGame = refreshed;
  updateSelectedInfo(state.selectedGameType, state.myGame);
  updateMyGameUI(state.myGame);
  await loadWaitingGamesForType(state.selectedGameTypeId);
}

export async function openGameTypeSheet(gameType, existingGame = null) {
  state.selectedGameType = gameType;
  state.selectedGameTypeId = gameType.id;

  els.sheetThumb.src = gameType.image_url || PLACEHOLDER_IMAGE;
  els.sheetName.textContent = gameType.name || "Game";
  els.sheetMeta.textContent = `Board type: ${gameType.board_type || "unknown"}`;

  els.joinCodeStatus.textContent = "";
  els.gameCodeInput.value = "";

  els.sheetOverlay.classList.add("open");
  els.sheetOverlay.setAttribute("aria-hidden", "false");
  setSheetMode("players");

  setStatus(`Loading ${gameType.name || "game"}...`);

  try {
    if (existingGame) {
      state.myGame = existingGame;
    } else {
      if (!state.myGame) {
        state.myGame = await createGameIfNeeded();
      }
      state.myGame = await syncMyGameToSelectedType(gameType);
    }

    updateSelectedInfo(state.selectedGameType, state.myGame);
    updateMyGameUI(state.myGame);

    await loadWaitingGamesForType(gameType.id);
    await subscribeToSelectedTypeGames(gameType.id);

    setStatus(`Selected: ${gameType.name || "Game"}\nID: ${gameType.id}`);
  } catch (err) {
    showRawError("Could not open selected game type", err);
  }
      }

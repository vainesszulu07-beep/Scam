// js/list_games.js

export async function loadGameTypes(supabase) {
  const { data, error } = await supabase
    .from("game_types")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data || [];
}

export function renderGameTypes(gameTypes, container, onSelect, placeholderImage = "https://via.placeholder.com/600x400?text=Game") {
  if (!container) throw new Error("Missing container element");

  container.innerHTML = "";

  if (!gameTypes || gameTypes.length === 0) {
    container.innerHTML = `<div class="empty-state">No game types yet.</div>`;
    return;
  }

  gameTypes.forEach((gameType) => {
    const card = document.createElement("div");
    card.className = "type-card";
    card.innerHTML = `
      <img class="type-image" src="${gameType.image_url || placeholderImage}" alt="${gameType.name || "Game"}">
      <div class="type-body">
        <div class="type-name">${gameType.name || "Unnamed Game"}</div>
        <p class="type-meta">Tap to open</p>
        <div class="pill">${gameType.board_type || "unknown"}</div>
      </div>
    `;

    card.onclick = () => {
      if (typeof onSelect === "function") onSelect(gameType);
    };

    container.appendChild(card);
  });
}

export async function loadAndRenderGameTypes(supabase, container, onSelect, placeholderImage) {
  const gameTypes = await loadGameTypes(supabase);
  renderGameTypes(gameTypes, container, onSelect, placeholderImage);
  return gameTypes;
}

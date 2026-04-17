// js/create_game.js

export async function getUserId(supabase) {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) throw error;
  if (!session?.user) throw new Error("Not logged in");

  return session.user.id;
}

export async function createGameIfNeeded(supabase, userId) {
  if (!userId) throw new Error("Missing userId");

  const { data, error } = await supabase
    .from("games")
    .select("*")
    .or(`player_x.eq.${userId},player_o.eq.${userId}`)
    .in("status", ["idle", "waiting", "playing"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;

  if (data && data[0]) {
    return data[0];
  }

  const { data: created, error: insertError } = await supabase
    .from("games")
    .insert({
      player_x: userId,
      status: "idle",
      game_type_id: null,
      turn: null,
      board_state: null
    })
    .select()
    .single();

  if (insertError) throw insertError;

  return created;
}

export async function ensureIdleGame(supabase) {
  const userId = await getUserId(supabase);
  const game = await createGameIfNeeded(supabase, userId);

  if (game.status !== "idle") {
    const { data, error } = await supabase
      .from("games")
      .update({ status: "idle" })
      .eq("id", game.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  return game;
}

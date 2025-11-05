import { supabaseBrowser } from "./supabase";
import type { Story } from "./models";

type StoryRow = {
  id: string;
  title: string;
  root_id: string;
  nodes: any;
  updated_at?: string | null;
  created_at?: string | null;
};

export function isSupabaseConfigured(): boolean {
  try {
    // Creating the client will throw if env vars are missing at build-time
    const client = supabaseBrowser();
    return !!client;
  } catch {
    return false;
  }
}

function getClient() {
  try {
    return supabaseBrowser();
  } catch (e) {
    return null;
  }
}

export async function saveStory(story: Story): Promise<{ id: string } | { error: string }> {
  const client = getClient();
  if (!client) return { error: "Supabase not configured" };
  const row: StoryRow = {
    id: story.id,
    title: story.title,
    root_id: story.rootId,
    nodes: story.nodes,
  };
  const { error } = await client.from("stories").upsert(row, { onConflict: "id" });
  if (error) return { error: error.message };
  return { id: story.id };
}

export async function loadStory(id: string): Promise<Story | null> {
  const client = getClient();
  if (!client) return null;
  const { data, error } = await client
    .from("stories")
    .select("id,title,root_id,nodes,updated_at")
    .eq("id", id)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as StoryRow;
  return { id: row.id, title: row.title, rootId: row.root_id, nodes: row.nodes as Story["nodes"] };
}

export async function listStories(): Promise<Array<{ id: string; title: string; updatedAt: string | null }>> {
  const client = getClient();
  if (!client) return [];
  const { data } = await client
    .from("stories")
    .select("id,title,updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((r: any) => ({ id: r.id, title: r.title, updatedAt: r.updated_at ?? null }));
}

export async function deleteStory(id: string): Promise<{ ok: true } | { error: string }> {
  const client = getClient();
  if (!client) return { error: "Supabase not configured" };
  const { error } = await client.from("stories").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}


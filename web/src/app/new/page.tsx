"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { GENRES, randomSeedForGenre } from "@/lib/genres";
import { createEmptyStory } from "@/lib/storyGraph";
import type { Story, StoryNode } from "@/lib/models";
import { useRouter } from "next/navigation";

export default function NewStoryPage() {
  const router = useRouter();

  const [genre, setGenre] = useState<string>(GENRES[0]);
  const [customGenre, setCustomGenre] = useState<string>("");
  const [seed, setSeed] = useState<string>(() => randomSeedForGenre(GENRES[0]));
  const userEditedSeed = useRef(false);
  const [busy, setBusy] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const effectiveCategory = useMemo(
    () =>
      genre === "Other / Custom" && customGenre.trim() ? customGenre.trim() : genre,
    [genre, customGenre]
  );

  useEffect(() => {
    if (!userEditedSeed.current) setSeed(randomSeedForGenre(effectiveCategory));
  }, [effectiveCategory]);

  async function onGenerate() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: effectiveCategory,
          seed,
        }),
      });
      const isJSON = res.headers.get("content-type")?.toLowerCase().includes("application/json");
      const json = isJSON ? await res.json().catch(() => ({})) : {};
      if (!res.ok) throw new Error((json as any)?.error ? String((json as any).error) : `HTTP ${res.status}`);

      const s = createEmptyStory("My Story");
      const root: StoryNode = {
        id: s.rootId,
        title: json.title ?? "Chapter 1",
        content: json.content ?? "",
        choices: (json.choices ?? []).map((text: string) => ({ id: crypto.randomUUID(), text })),
      };
      const story: Story = { ...s, nodes: { [root.id]: root } };
      try {
        localStorage.setItem("mw_current_story", JSON.stringify(story));
      } catch {}
      router.push("/editor");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to generate first scene");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid gap-4">
      <h1 className="text-xl font-medium">Start a New Story</h1>

      {err && (
        <div className="rounded border border-red-800 bg-red-950/40 p-2 text-sm text-red-300">{err}</div>
      )}

      <section className="grid gap-3 rounded-2xl border border-neutral-800 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <label htmlFor="genre" className="text-sm text-neutral-300">
              Genre
            </label>
            <select
              id="genre"
              className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
              value={genre}
              onChange={(e) => {
                setGenre(e.target.value);
                userEditedSeed.current = false;
              }}
            >
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {genre === "Other / Custom" && (
            <input
              className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
              placeholder="Enter custom genre..."
              value={customGenre}
              onChange={(e) => {
                setCustomGenre(e.target.value);
                userEditedSeed.current = false;
              }}
            />
          )}
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
            value={seed}
            onChange={(e) => {
              userEditedSeed.current = true;
              setSeed(e.target.value);
            }}
            placeholder="Premise (e.g., 'A loner finds a cursed map...')"
          />
          <button
            type="button"
            disabled={shuffling}
            className="rounded-xl border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800 disabled:opacity-50"
            onClick={async () => {
              setShuffling(true);
              try {
                const res = await fetch("/api/seed", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ category: effectiveCategory }),
                });
                const json = await res.json().catch(() => ({}));
                if (res.ok && typeof (json as any).seed === "string") {
                  setSeed((json as any).seed);
                } else {
                  setSeed(randomSeedForGenre(effectiveCategory));
                }
                userEditedSeed.current = false;
              } finally {
                setShuffling(false);
              }
            }}
          >
            {shuffling ? "Shuffling..." : "Shuffle"}
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || !seed.trim()}
            onClick={onGenerate}
            className="rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800 disabled:opacity-50"
          >
            {busy ? "Generating..." : "Generate First Scene"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => router.push("/play")}
            className="rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800 disabled:opacity-50"
          >
            Play Saved
          </button>
        </div>
      </section>
    </main>
  );
}

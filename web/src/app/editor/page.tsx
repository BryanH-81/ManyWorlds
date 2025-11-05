"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createEmptyStory, linkChoiceImmutable } from "@/lib/storyGraph";
import type { Story, StoryNode } from "@/lib/models";
import { GENRES, randomSeedForGenre } from "@/lib/genres";
import { useRouter } from "next/navigation";
import { isSupabaseConfigured, saveStory, loadStory } from "@/lib/persistence";

export default function EditorPage() {
  const router = useRouter();
  // Avoid SSR id mismatches
  const [story, setStory] = useState<Story | null>(null);
  // Load from saved draft if present, else create fresh
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("mw_current_story") : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Story;
        if (parsed && parsed.nodes && parsed.rootId && parsed.nodes[parsed.rootId]) {
          setStory(parsed);
          return;
        }
      }
    } catch {}
    setStory(createEmptyStory("My Story"));
  }, []);

  // Genre dropdown + optional custom
  const [genre, setGenre] = useState<string>(GENRES[0]);
  const [customGenre, setCustomGenre] = useState<string>("");

  // Seed: start random from genre; update on Shuffle or genre change (if user hasn't edited)
  const [seed, setSeed] = useState<string>(() => randomSeedForGenre(GENRES[0]));
  const userEditedSeed = useRef(false);

  const effectiveCategory = useMemo(
    () =>
      genre === "Other / Custom" && customGenre.trim()
        ? customGenre.trim()
        : genre,
    [genre, customGenre]
  );

  function onSeedChange(v: string) {
    if (!userEditedSeed.current) userEditedSeed.current = true;
    setSeed(v);
  }

  // When genre/custom genre changes, refresh seed if not manually edited
  useEffect(() => {
    if (!userEditedSeed.current) {
      setSeed(randomSeedForGenre(effectiveCategory));
    }
  }, [effectiveCategory]);

  const [busy, setBusy] = useState<Set<string>>(new Set<string>()); // track busy node ids
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [directions, setDirections] = useState<Record<string, string>>({}); // per-node custom direction
  const [selected, setSelected] = useState<Record<string, string | null>>({}); // per-node selected choice id or "__custom__"
  const [advOpen, setAdvOpen] = useState(false);
  const advRef = useRef<HTMLDivElement | null>(null);
  const [shuffling, setShuffling] = useState(false);
  const customInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const supabaseEnabled = useMemo(() => isSupabaseConfigured(), []);

  const controllers = useRef<AbortController[]>([]);
  useEffect(() => {
    return () => {
      controllers.current.forEach((c) => c.abort());
      controllers.current = [];
    };
  }, []);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!advOpen) return;
      const el = advRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) {
        setAdvOpen(false);
      }
    }
    function onDocKey(e: KeyboardEvent) {
      if (advOpen && e.key === "Escape") setAdvOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onDocKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onDocKey);
    };
  }, [advOpen]);

  async function generateNext(
    fromId: string,
    param?: string | { direction?: string; existingChoiceId?: string }
  ) {
    if (!story) return;
    const direction = typeof param === "string" ? param : param?.direction;
    const existingChoiceId =
      typeof param === "string" ? undefined : param?.existingChoiceId;
    setBusy((prev) => {
      const next = new Set(prev);
      next.add(fromId);
      return next;
    });
    setErrors((m) => ({ ...m, [fromId]: null }));
    try {
      const from = story.nodes[fromId];
      const ac = new AbortController();
      controllers.current.push(ac);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: effectiveCategory,
          seed,
          direction: direction?.trim() ? direction : undefined,
          context: from?.content,
        }),
        signal: ac.signal,
      });
      const isJSON = res.headers
        .get("content-type")
        ?.toLowerCase()
        .includes("application/json");
      const payload = isJSON ? await res.json().catch(() => null) : null;
      if (!res.ok) {
        const message = (payload as any)?.error
          ? `HTTP ${res.status}: ${(payload as any).error}`
          : `HTTP ${res.status}`;
        throw new Error(message);
      }
      const json = (payload ?? {}) as any;

      const node: StoryNode = {
        id: crypto.randomUUID(),
        title: json.title ?? "Untitled",
        content: json.content ?? "",
        choices: (json.choices ?? []).map((text: string) => ({
          id: crypto.randomUUID(),
          text,
        })),
      };

      setStory((s) => {
        if (!s) return s;
        let next: Story = { ...s, nodes: { ...s.nodes, [node.id]: node } };

        // Link the selected existing choice, or add/link a new custom choice
        if (direction?.trim()) {
          const fromNode = { ...next.nodes[fromId] };
          if (existingChoiceId) {
            const idx = fromNode.choices.findIndex((c) => c.id === existingChoiceId);
            if (idx >= 0) {
              next.nodes[fromId] = fromNode;
              next = linkChoiceImmutable(next, fromId, idx, node.id);
            }
          } else {
            const choiceIdx = fromNode.choices.length;
            fromNode.choices = [
              ...fromNode.choices,
              { id: crypto.randomUUID(), text: direction.trim() },
            ];
            next.nodes[fromId] = fromNode;
            next = linkChoiceImmutable(next, fromId, choiceIdx, node.id);
          }
        }
        return next;
      });

      // clear this node's direction input
      setDirections((d) => ({ ...d, [fromId]: "" }));
      setSelected((sel) => ({ ...sel, [fromId]: null }));
      // Smoothly scroll to top after generating a new branch
      try {
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } catch {}
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setErrors((m) => ({ ...m, [fromId]: e?.message ?? "Failed to generate" }));
      }
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(fromId);
        return next;
      });
      // remove any finished/aborted controllers for cleanliness
      controllers.current = controllers.current.filter((c) => !c.signal.aborted);
    }
  }

  const nodes = useMemo(() => (story ? Object.values(story.nodes) : []), [story]);

  if (!story) {
    return (
      <main className="grid gap-4">
        <div className="text-xs text-neutral-400">Loading...</div>
        <article className="rounded-2xl border border-neutral-800 p-4">
          <div className="h-6 w-40 animate-pulse rounded bg-neutral-800" />
          <div className="mt-3 h-24 animate-pulse rounded bg-neutral-900" />
        </article>
      </main>
    );
  }

  return (
    <main className="grid gap-4">
      {/* Controls */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        {/* Genre dropdown */}
        <div className="flex items-center gap-2">
          <label htmlFor="genre" className="text-sm text-neutral-300">Genre</label>
          <select
            id="genre"
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
            value={genre}
            onChange={(e) => {
              setGenre(e.target.value);
              userEditedSeed.current = false; // allow auto-refresh of seed after genre switch
            }}
          >
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* Custom genre input */}
        {genre === "Other / Custom" && (
          <input
            className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
            placeholder="Enter custom genre..."
            value={customGenre}
            onChange={(e) => {
              setCustomGenre(e.target.value);
              userEditedSeed.current = false; // allow auto-refresh while typing custom genre
            }}
          />
        )}

        {/* Seed + Shuffle */}
        <div className="flex gap-2 flex-1">
          <input
            className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
            value={seed}
            onChange={(e) => onSeedChange(e.target.value)}
            placeholder="Seed / premise..."
          />
          <button
            type="button"
            disabled={shuffling}
            className="rounded-xl border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800 disabled:opacity-50"
            title="Shuffle a new random seed for this genre"
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

        <button
          type="button"
          className="rounded-xl border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800"
          title="Save the current story locally and open Play"
          onClick={() => {
            if (story) {
              try {
                localStorage.setItem("mw_current_story", JSON.stringify(story));
              } catch {}
            }
            router.push("/play");
          }}
        >
          Play
        </button>
      </div>
      {/* Advanced dropdown */}
      <div className="relative" ref={advRef}>
        <button
          type="button"
          className="rounded-xl border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800"
          aria-haspopup="menu"
          aria-expanded={advOpen}
          title="Advanced options: save, load, import/export, share"
          onClick={() => setAdvOpen((v) => !v)}
        >
          Advanced ▾
        </button>
        {advOpen && (
          <div
            role="menu"
            className="absolute z-10 mt-2 min-w-64 rounded-xl border border-neutral-800 bg-neutral-950 p-2 shadow-xl"
          >
            <button
              role="menuitem"
              type="button"
              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-900 disabled:opacity-50"
              title="Save this story to Supabase"
              disabled={!story || !supabaseEnabled}
              onClick={async () => {
                if (!story) return;
                const res = await saveStory(story);
                if ("error" in res) alert(`Save failed: ${res.error}`);
                else alert(`Saved story ${res.id} to Supabase`);
                setAdvOpen(false);
              }}
            >
              Save to Supabase
            </button>
            <button
              role="menuitem"
              type="button"
              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-900 disabled:opacity-50"
              title="Load a story from Supabase by its ID"
              disabled={!supabaseEnabled}
              onClick={async () => {
                const id = window.prompt("Load story by ID");
                if (!id) return;
                const s = await loadStory(id.trim());
                if (!s) {
                  alert("Story not found or load failed");
                  return;
                }
                setStory(s);
                try { localStorage.setItem("mw_current_story", JSON.stringify(s)); } catch {}
                setAdvOpen(false);
              }}
            >
              Load by ID
            </button>
            <button
              role="menuitem"
              type="button"
              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-900"
              title="Export the current story as a JSON file"
              onClick={() => {
                if (!story) return;
                const blob = new Blob([JSON.stringify(story, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `story-${story.id}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                setAdvOpen(false);
              }}
            >
              Export JSON
            </button>
            <label
              role="menuitem"
              className="block w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-900"
              title="Import a story from a JSON file"
            >
              Import JSON
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const text = await f.text();
                    const parsed = JSON.parse(text) as Story;
                    if (!parsed || !parsed.nodes || !parsed.rootId || !parsed.nodes[parsed.rootId]) throw new Error("Invalid story JSON");
                    setStory(parsed);
                    try { localStorage.setItem("mw_current_story", JSON.stringify(parsed)); } catch {}
                  } catch (err: any) {
                    alert(`Import failed: ${err?.message ?? String(err)}`);
                  } finally {
                    (e.currentTarget as HTMLInputElement).value = "";
                    setAdvOpen(false);
                  }
                }}
              />
            </label>
            <button
              role="menuitem"
              type="button"
              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-900"
              title="Copy a shareable Play link that loads this story from Supabase"
              onClick={() => {
                if (!story) return;
                const origin = typeof window !== "undefined" ? window.location.origin : "";
                const url = `${origin}/play?id=${encodeURIComponent(story.id)}`;
                navigator.clipboard?.writeText(url).then(
                  () => alert("Share link copied to clipboard"),
                  () => alert(url)
                );
                setAdvOpen(false);
              }}
            >
              Copy Share Link
            </button>
          </div>
        )}
      </div>
      {/* Nodes */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {nodes.map((n) => (
          <article id={n.id} key={n.id} className="rounded-2xl border border-neutral-800 p-4" aria-busy={busy.has(n.id)}>
            <h3 className="text-lg font-medium">{n.title}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-200">{n.content}</p>
            {n.choices.length > 0 ? (
            <fieldset className="mt-3 grid gap-2">
              <legend className="sr-only">Choose direction</legend>
              {n.choices.map((c) => (
                <label
                  key={c.id}
                  className={`flex items-start gap-2 rounded-xl p-2 transition-colors backdrop-blur-sm shadow-sm focus-within:ring-1 ${
                    selected?.[n.id] === c.id
                      ? "border border-indigo-400/30 bg-indigo-500/10"
                      : "border border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <input
                    type="radio"
                    name={`choice-${n.id}`}
                    className="mt-1"
                    value={c.id}
                    checked={selected?.[n.id] === c.id}
                    onChange={() => setSelected((m) => ({ ...m, [n.id]: c.id }))}
                    disabled={busy.has(n.id)}
                  />
                  <span className="text-sm">
                    {c.text}
                    {c.to && (
                      <span className="ml-2 text-xs text-neutral-400">
                        Leads to: {story?.nodes[c.to]?.title ?? "Unknown"}
                      </span>
                    )}
                  </span>
                  {c.to && (
                    <button
                      type="button"
                  className="ml-auto rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800"
                  title="Scroll to the target node"
                  onClick={() => {
                        const el = document.getElementById(c.to!);
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    >
                      Go
                    </button>
                  )}
                </label>
              ))}

              {/* Custom option */}
              <label
                className={`rounded-xl p-2 transition-colors backdrop-blur-sm shadow-sm focus-within:ring-1 ${
                  selected?.[n.id] === "__custom__"
                    ? "border border-indigo-400/30 bg-indigo-500/10"
                    : "border border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`choice-${n.id}`}
                    className="mt-1"
                    value="__custom__"
                    checked={selected?.[n.id] === "__custom__"}
                    onChange={() => setSelected((m) => ({ ...m, [n.id]: "__custom__" }))}
                    disabled={busy.has(n.id)}
                  />
                  <span className="text-sm flex items-center gap-2">
                    Custom direction
                    <button
                      type="button"
                      className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800"
                      title="Select custom and focus the input"
                      onClick={() => {
                        setSelected((m) => ({ ...m, [n.id]: "__custom__" }));
                        setTimeout(() => customInputRefs.current[n.id]?.focus(), 0);
                      }}
                    >
                      Add
                    </button>
                  </span>
                </div>

                {selected?.[n.id] === "__custom__" && (
                  <div className="mt-2">
                    <input
                      className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
                      placeholder="Type what you want to do next."
                      value={directions[n.id] ?? ""}
                      ref={(el) => { customInputRefs.current[n.id] = el; }}
                      onChange={(e) =>
                        setDirections((d) => ({ ...d, [n.id]: e.target.value }))
                      }
                      disabled={busy.has(n.id)}
                    />
                  </div>
                )}
              </label>

              {errors[n.id] && (
                <div className="rounded border border-red-800 bg-red-950/40 p-2 text-xs text-red-300">
                  {errors[n.id]}
                </div>
              )}
              <div>
                <button
                  disabled={
                    busy.has(n.id) ||
                    !selected?.[n.id] ||
                    (selected?.[n.id] === "__custom__" && !(directions[n.id]?.trim()))
                  }
                  onClick={() => {
                    const sel = selected?.[n.id];
                    if (sel === "__custom__") {
                      generateNext(n.id, { direction: directions[n.id] });
                    } else if (sel) {
                      const choice = n.choices.find((c) => c.id === sel);
                      generateNext(n.id, { direction: choice?.text, existingChoiceId: sel });
                    }
                  }}
                  className="rounded-xl border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800 disabled:opacity-50"
                  title="Generate the next node from the chosen option"
                >
                  {busy.has(n.id) ? "Generating..." : "Generate From Selection"}
                </button>
              </div>
            </fieldset>
            ) : (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => generateNext(n.id)}
                  disabled={busy.has(n.id)}
                  className="rounded-xl border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800 disabled:opacity-50"
                  title="Ask AI to propose options for what happens next"
                >
                  {busy.has(n.id) ? "Generating..." : "Generate AI Choices"}
                </button>
              </div>
            )}

            {/* Custom direction input + actions */}
            <div className="mt-3 grid gap-2 hidden">
              <input
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
                placeholder="Or type a custom direction (e.g., 'Override security and open the hatch')"
                value={directions[n.id] ?? ""}
                onChange={(e) =>
                  setDirections((d) => ({ ...d, [n.id]: e.target.value }))
                }
              />
              {errors[n.id] && (
                <div className="rounded border border-red-800 bg-red-950/40 p-2 text-xs text-red-300">
                  {errors[n.id]}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  disabled={busy.has(n.id)}
                  onClick={() => generateNext(n.id)}
                  className="rounded-xl border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800 disabled:opacity-50"
                >
                  {busy.has(n.id) ? "Generating..." : "Generate Next (AI choices)"}
                </button>
                <button
                  disabled={busy.has(n.id) || !(directions[n.id]?.trim())}
                  onClick={() => generateNext(n.id, directions[n.id])}
                  className="rounded-xl border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800 disabled:opacity-50"
                >
                  {busy.has(n.id) ? "Generating..." : "Generate From Direction"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}

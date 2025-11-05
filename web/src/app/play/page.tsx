"use client";
import { useEffect, useId, useMemo, useState } from "react";
import { createEmptyStory, linkChoiceImmutable } from "@/lib/storyGraph";
import { loadStory } from "@/lib/persistence";
import type { Story, StoryNode } from "@/lib/models";

export default function PlayPage() {
  const [story, setStory] = useState<Story | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const [busy, setBusy] = useState(false);
  const [readingMode, setReadingMode] = useState(true);
  const [paperMode, setPaperMode] = useState(false);

  // Stable radio group name across renders
  const groupId = useId();

  // Build initial story only on the client (avoid SSR randomness)
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("mw_current_story") : null;
      const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const id = search?.get("id");
      if (id) {
        loadStory(id).then((remote) => {
          if (remote && remote.nodes && remote.rootId && remote.nodes[remote.rootId]) {
            setStory(remote);
            setCurrent(remote.rootId);
            try { localStorage.setItem("mw_current_story", JSON.stringify(remote)); } catch {}
          }
        });
        return; // prefer loading from Supabase when an id is present
      }
      if (raw) {
        const parsed = JSON.parse(raw) as Story;
        if (parsed && parsed.nodes && parsed.rootId && parsed.nodes[parsed.rootId]) {
          setStory(parsed);
          setCurrent(parsed.rootId);
          return;
        }
      }
    } catch {}
    const s = createEmptyStory("Quick Start");
    setStory(s);
    setCurrent(s.rootId);
  }, []);

  const node = current && story ? story.nodes[current] : null;
  const breadcrumbs = useMemo(() => (node ? [node.title ?? "Start"] : []), [node]);

  function startOverFromSaved() {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("mw_current_story") : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Story;
        if (parsed && parsed.nodes && parsed.rootId && parsed.nodes[parsed.rootId]) {
          setStory(parsed);
          setCurrent(parsed.rootId);
          setSelectedChoiceId(null);
          setCustomText("");
          setBusy(false);
          return;
        }
      }
    } catch {}
    const s = createEmptyStory("Quick Start");
    setStory(s);
    setCurrent(s.rootId);
    setSelectedChoiceId(null);
    setCustomText("");
    setBusy(false);
  }

  function clearSavedAndReset() {
    try {
      if (typeof window !== "undefined") localStorage.removeItem("mw_current_story");
    } catch {}
    const s = createEmptyStory("Quick Start");
    setStory(s);
    setCurrent(s.rootId);
    setSelectedChoiceId(null);
    setCustomText("");
    setBusy(false);
  }

  async function branchFromText(text: string) {
    if (!node || !story) return;
    setBusy(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "Player",
          seed: "Branch from player input",
          direction: text,
          context: node.content,
        }),
      });
      const json = await res.json();

      const newNode: StoryNode = {
        id: crypto.randomUUID(),
        title: json.title ?? "New Branch",
        content: json.content ?? "",
        choices: (json.choices ?? []).map((t: string) => ({
          id: crypto.randomUUID(),
          text: t,
        })),
      };

      setStory((s) => {
        if (!s) return s;
        const next = { ...s, nodes: { ...s.nodes, [newNode.id]: newNode } };
        const cur = { ...next.nodes[current!] };
        const idx = cur.choices.length;
        cur.choices = [...cur.choices, { id: crypto.randomUUID(), text }];
        next.nodes[current!] = cur;
        return linkChoiceImmutable(next, current!, idx, newNode.id);
      });

      setCurrent(newNode.id);
      // Scroll to top after moving to the newly generated branch
      try {
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } catch {}
    } finally {
      setBusy(false);
      setSelectedChoiceId(null);
      setCustomText("");
    }
  }

  async function onPickChoice(choiceId: string) {
    if (!node || !story || busy) return;

    if (choiceId === "__custom__") {
      setSelectedChoiceId("__custom__");
      return;
    }

    const choice = node.choices.find((c) => c.id === choiceId);
    if (!choice) return;

    if (choice.to) {
      setCurrent(choice.to);
      setSelectedChoiceId(null);
      setCustomText("");
      try {
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } catch {}
      return;
    }

    setSelectedChoiceId(choiceId);
    await branchFromText(choice.text);
  }

  async function onContinueCustom() {
    if (!customText.trim() || busy) return;
    await branchFromText(customText.trim());
  }

  if (!story || !node) {
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
      <div className="flex items-center justify-between">
        <div className="text-xs text-neutral-400">{breadcrumbs.join(" / ")}</div>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() => setReadingMode((v) => !v)}
            title="Toggle larger text and relaxed layout for reading"
            className={`rounded-xl border px-3 py-1 text-sm ${readingMode ? "border-teal-400 bg-teal-900/30" : "border-neutral-700 hover:bg-neutral-800"}`}
          >
            Reading Mode: {readingMode ? "On" : "Off"}
          </button>
          <button
            type="button"
            onClick={() => setPaperMode((v) => !v)}
            title="Toggle light paper-style theme"
            className={`rounded-xl border px-3 py-1 text-sm ${paperMode ? "border-amber-500 bg-amber-100 text-neutral-900" : "border-neutral-700 hover:bg-neutral-800"}`}
          >
            Paper Mode: {paperMode ? "On" : "Off"}
          </button>
          <button
            type="button"
            className="rounded-xl border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800"
            title="Load the last saved story from this device"
            onClick={startOverFromSaved}
          >
            Start Over
          </button>
          <button
            type="button"
            className="rounded-xl border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800"
            title="Remove the saved story from this device and start fresh"
            onClick={clearSavedAndReset}
          >
            Clear Saved
          </button>
        </div>
      </div>

      <article
        key={node.id}
        className={`node-enter rounded-2xl p-8 shadow-xl ${paperMode ? "border border-neutral-200 bg-neutral-50 text-neutral-900" : "border border-neutral-700 bg-neutral-900/60 text-neutral-100 backdrop-blur-sm"}`}
      >
        <div className={`${readingMode ? "min-h-[70vh] max-w-3xl mx-auto" : "min-h-[60vh]"}`}>
          <h2 className={`font-semibold tracking-tight ${readingMode ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl"} ${paperMode ? "text-neutral-900" : "text-neutral-50"}`}>{node.title}</h2>
          <p className={`mt-4 whitespace-pre-wrap ${readingMode ? "text-xl md:text-2xl leading-9" : "text-lg md:text-xl leading-8"} ${paperMode ? "text-neutral-900" : "text-neutral-100"}`}>
            {node.content}
          </p>
        </div>

        <fieldset className="mt-8 grid gap-3">
          <legend className="sr-only">Choose your action</legend>

          {node.choices.map((c) => (
            <label
              key={c.id}
              className={`flex items-start gap-3 rounded-xl p-4 transition-colors focus-within:ring-1 ${
                paperMode
                  ? "border border-neutral-300 hover:bg-neutral-100"
                  : `border border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur-sm shadow-sm ${
                      selectedChoiceId === c.id ? "border-indigo-400/30 bg-indigo-500/10" : ""
                    }`
              }`}
            >
              <input
                type="radio"
                name={`choice-${groupId}`}
                className="mt-1 h-5 w-5"
                value={c.id}
                checked={selectedChoiceId === c.id}
                onChange={() => onPickChoice(c.id)}
                disabled={busy}
              />
              <span className={`text-base md:text-lg leading-7 ${paperMode ? "text-neutral-900" : "text-neutral-100"}`}>{c.text}</span>
            </label>
          ))}

          {/* Custom option */}
          <label
            className={`rounded-xl p-4 transition-colors focus-within:ring-1 ${
              paperMode
                ? "border border-neutral-300 hover:bg-neutral-100"
                : `border border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur-sm shadow-sm ${
                    selectedChoiceId === "__custom__" ? "border-indigo-400/30 bg-indigo-500/10" : ""
                  }`
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name={`choice-${groupId}`}
                className="mt-1 h-5 w-5"
                value="__custom__"
                checked={selectedChoiceId === "__custom__"}
                onChange={() => onPickChoice("__custom__")}
                disabled={busy}
              />
              <span className={`text-base md:text-lg leading-7 ${paperMode ? "text-neutral-900" : "text-neutral-100"}`}>Custom direction</span>
            </div>

            <div className="mt-2">
              <input
                className={`w-full rounded-xl px-3 py-3 text-base md:text-lg ${paperMode ? "border border-neutral-300 bg-white text-neutral-900" : "border border-neutral-700 bg-neutral-950/60"}`}
                placeholder="Type what you want to do next..."
                value={customText}
                onChange={(e) => {
                  setCustomText(e.target.value);
                  if (selectedChoiceId !== "__custom__") setSelectedChoiceId("__custom__");
                }}
                disabled={busy}
              />
            </div>

            <div className="mt-3">
              <button
                onClick={onContinueCustom}
                disabled={busy || !customText.trim()}
                className={`rounded-xl px-4 py-2 text-base disabled:opacity-50 ${paperMode ? "border border-neutral-300 hover:bg-neutral-200" : "border border-neutral-700 hover:bg-neutral-800"}`}
                title="Generate a new branch from your custom direction"
              >
                {busy ? "Branching..." : "Continue with Custom"}
              </button>
            </div>
          </label>
        </fieldset>
      </article>
    </main>
  );
}

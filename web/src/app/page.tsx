export default function Page() {
return (
<main className="grid gap-4">
<h2 className="text-xl font-medium">Choose Your Own World</h2>
<p className="text-neutral-300 max-w-prose">
Generate 400 to 600 word story nodes with crisp choices, edit them, and branch as far as you like.
</p>
<div className="flex gap-3">
<a className="rounded-xl border border-neutral-700 px-4 py-2 hover:bg-neutral-800" href="/new">Start New Story</a>
<a className="rounded-xl border border-neutral-700 px-4 py-2 hover:bg-neutral-800" href="/editor">Open Editor</a>
<a className="rounded-xl border border-neutral-700 px-4 py-2 hover:bg-neutral-800" href="/play">Play Saved</a>
</div>
</main>
);
}

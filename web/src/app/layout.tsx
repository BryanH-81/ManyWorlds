import "./globals.css";
import type { Metadata } from "next";


export const metadata: Metadata = { title: "ManyWorlds" };


export default function RootLayout({ children }: { children: React.ReactNode }) {
return (
<html lang="en">
<body className="min-h-screen bg-neutral-950 text-neutral-100">
<div className="mx-auto max-w-5xl p-6">
<header className="mb-6 flex items-center justify-between">
<h1 className="text-2xl font-semibold"><a href="/" className="hover:underline">ManyWorlds</a></h1>
<nav className="flex gap-4 text-sm">
<a href="/play" className="hover:underline">Play</a>
<a href="/editor" className="hover:underline">Editor</a>
</nav>
</header>
{children}
</div>
</body>
</html>
);
}

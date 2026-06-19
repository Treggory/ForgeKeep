"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Home", glyph: "▦" },
  { href: "/inventory", label: "Inventory", glyph: "▤" },
  { href: "/store", label: "Store", glyph: "◎", hero: true },
  { href: "/projects", label: "Projects", glyph: "▣" },
  { href: "/more", label: "More", glyph: "≡" },
];

export default function BottomNav() {
  const path = usePathname();
  if (path.startsWith("/login")) return null;
  const active = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-line bg-panel/95 backdrop-blur supports-[backdrop-filter]:bg-panel/80">
      <ul className="mx-auto flex max-w-xl items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => (
          <li key={t.href} className="flex-1">
            <Link
              href={t.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[0.62rem] uppercase tracking-wider transition-colors ${
                active(t.href) ? "text-jade" : "text-muted hover:text-ink"
              }`}
            >
              <span
                className={`grid h-9 w-9 place-items-center rounded-full text-lg leading-none ${
                  t.hero
                    ? "bg-jade text-gun shadow-panel -mt-4 h-12 w-12 text-2xl ring-4 ring-gun"
                    : ""
                } ${active(t.href) && !t.hero ? "bg-line/60" : ""}`}
              >
                {t.glyph}
              </span>
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

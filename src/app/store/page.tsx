"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SearchResult } from "@/lib/types";
import BarcodeScanner from "@/components/BarcodeScanner";

const TYPE_GLYPH: Record<string, string> = {
  paint: "🎨",
  miniature: "🪖",
  brush: "🖌️",
  tool: "🛠️",
  terrain: "🏚️",
};

export default function StoreMode() {
  const supabase = createClient();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [scanning, setScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNext = useRef<string | null>(null); // value already resolved via scan

  // Debounced text search (search_inventory) — unchanged behaviour.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const query = q.trim();
    if (skipNext.current !== null && query === skipNext.current) {
      skipNext.current = null;
      return; // this exact value was just resolved by a scan
    }
    if (query.length < 2) {
      setResults([]);
      setState("idle");
      return;
    }
    setState("loading");
    timer.current = setTimeout(async () => {
      const { data } = await supabase.rpc("search_inventory", { q: query });
      setResults((data ?? []) as SearchResult[]);
      setState("done");
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, supabase]);

  async function handleDetected(code: string) {
    setScanning(false);
    setScannedCode(code);
    skipNext.current = code;
    setQ(code);
    setAdded(null);
    setState("loading");
    const { data } = await supabase.rpc("find_by_barcode", { code });
    setResults((data ?? []) as SearchResult[]);
    setState("done");
  }

  async function addToWishlist() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("wishlist").insert({
      owner_id: user.id,
      name: q.trim(),
      reason: "Want to Buy",
      item_type: "other",
      barcode: scannedCode,
    });
    if (!error) setAdded(q.trim());
  }

  const showVerdict = q.trim().length >= 2 && state === "done";
  const owned = results.length > 0;

  return (
    <div className="space-y-4">
      {scanning ? (
        <BarcodeScanner onDetected={handleDetected} onClose={() => setScanning(false)} />
      ) : null}

      <header>
        <div className="eyebrow">Store Mode</div>
        <h1 className="font-display text-2xl font-semibold">Do I own this?</h1>
        <p className="text-sm text-muted">
          Search, or scan a barcode, before you buy.
        </p>
      </header>

      <div className="sticky top-0 z-10 -mx-4 space-y-2 bg-gun/95 px-4 py-2 backdrop-blur">
        <div className="flex gap-2">
          <input
            autoFocus
            inputMode="search"
            placeholder="e.g. Pro Acryl Jade, Rubric Marines…"
            className="min-w-0 flex-1 rounded-xl border border-line bg-panel px-4 py-3 text-lg outline-none focus:border-jade"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setScannedCode(null);
              setAdded(null);
            }}
          />
          <button
            onClick={() => setScanning(true)}
            className="shrink-0 rounded-xl bg-brass px-4 text-gun"
            aria-label="Scan barcode"
            title="Scan barcode"
          >
            ▦
          </button>
        </div>
        {scannedCode ? (
          <div className="text-xs text-muted">
            Scanned code: <span className="font-mono text-ink">{scannedCode}</span>
          </div>
        ) : null}
      </div>

      {showVerdict ? (
        owned ? (
          <div className="card border-amber/40 bg-amber/10 p-4">
            <div className="font-display text-lg text-amber">⚠ Already in your collection</div>
            <p className="text-sm text-muted">
              {results.length} match{results.length === 1 ? "" : "es"} — check before buying a duplicate.
            </p>
          </div>
        ) : (
          <div className="card border-jade/40 bg-jade/10 p-4">
            <div className="font-display text-lg text-jade">✓ Not in your collection</div>
            <p className="text-sm text-muted">Clear to buy.</p>
            <button
              onClick={addToWishlist}
              className="mt-3 rounded-lg border border-line bg-panel px-3 py-2 text-sm"
            >
              {added ? "Added to wishlist ✓" : "+ Add to wishlist"}
            </button>
          </div>
        )
      ) : null}

      {state === "loading" ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card h-16 animate-pulse" />
          ))}
        </div>
      ) : null}

      <ul className="space-y-2">
        {results.map((r) => (
          <li key={`${r.item_type}-${r.id}`} className="card flex items-center gap-3 p-3">
            <span className="text-2xl">{TYPE_GLYPH[r.item_type] ?? "•"}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{r.title}</div>
              <div className="truncate text-xs text-muted">
                {r.item_type}
                {r.subtitle ? ` · ${r.subtitle}` : ""}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-jade">✓ {r.owned_qty}</div>
              {r.needs_replacement ? (
                <div className="text-[0.65rem] uppercase text-amber">replace</div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

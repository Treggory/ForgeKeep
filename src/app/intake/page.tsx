"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import BarcodeScanner from "@/components/BarcodeScanner";
import QuickAddForm, { QUICK_TYPES, type AddedEntry, type Prefill } from "@/components/QuickAddForm";

// Barcode-bearing inventory tables, queried directly (NOT the search RPC) so we
// get concrete row ids to increment.
const LOOKUP = [
  { table: "paints", category: "paints", type: "Paint", title: (r: any) => `${r.brand} — ${r.color_name}` },
  { table: "miniature_units", category: "miniatures", type: "Miniature", title: (r: any) => r.unit_name },
  { table: "tools", category: "tools", type: "Tool", title: (r: any) => r.item },
  { table: "terrain", category: "terrain", type: "Terrain", title: (r: any) => r.terrain_set },
];

type Match = { table: string; category: string; type: string; row: any };
const ADD_TABS = ["paints", "miniatures", "tools", "terrain", "wishlist"];

export default function IntakePage() {
  const supabase = createClient();
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "looking" | "found" | "new">("idle");
  const [matches, setMatches] = useState<Match[]>([]);
  const [addType, setAddType] = useState<string>("paints");
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [offerCatalogSave, setOfferCatalogSave] = useState(false);
  const [catalogSource, setCatalogSource] = useState("manual");
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [recent, setRecent] = useState<(AddedEntry & { qtyNote?: string })[]>([]);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  // Product lookup chain: inventory -> product_catalog -> external API -> manual
  async function lookup(c: string) {
    setCode(c);
    setScanning(false);
    setFlash(null);
    setPhase("looking");
    setPrefill(null);
    setOfferCatalogSave(false);
    setCatalogSource("manual");
    setSourceLabel(null);

    // 1) user inventory
    const found: Match[] = [];
    for (const l of LOOKUP) {
      const { data } = await supabase.from(l.table).select("*").eq("barcode", c);
      for (const row of data ?? [])
        found.push({ table: l.table, category: l.category, type: l.type, row });
    }
    if (found.length) {
      setMatches(found);
      setPhase("found");
      return;
    }
    setMatches([]);
    setAddType("paints");

    // 2) global product catalog (already known -> no need to re-save)
    const { data: cat } = await supabase
      .from("product_catalog").select("*").eq("barcode", c).maybeSingle();
    if (cat) {
      setPrefill({ name: cat.name, brand: cat.brand, category: cat.category });
      setOfferCatalogSave(false);
      setSourceLabel("Prefilled from the product catalog");
      setPhase("new");
      return;
    }

    // 3) external UPC lookup (server-side proxy; falls back gracefully)
    try {
      const res = await fetch(`/api/upc?barcode=${encodeURIComponent(c)}`);
      const data = await res.json();
      if (data?.found) {
        setPrefill({ name: data.name, brand: data.brand, category: data.category });
        setOfferCatalogSave(true);
        setCatalogSource(data.source ?? "external");
        setSourceLabel(`Prefilled from ${data.source ?? "external"} lookup`);
        setPhase("new");
        return;
      }
    } catch {
      // ignore — fall through to manual
    }

    // 4) manual — still let the user contribute the product to the catalog
    setOfferCatalogSave(true);
    setCatalogSource("manual");
    setSourceLabel("No product match — enter details manually");
    setPhase("new");
  }

  function startOver() {
    setCode(null);
    setManual("");
    setMatches([]);
    setPrefill(null);
    setOfferCatalogSave(false);
    setCatalogSource("manual");
    setSourceLabel(null);
    setPhase("idle");
    setNoteDraft({});
  }

  function pushRecent(e: AddedEntry & { qtyNote?: string }) {
    setRecent((r) => [e, ...r].slice(0, 12));
  }

  function addAsNewManual() {
    // From a "found" match, treat as a brand-new manual product.
    setPrefill(null);
    setOfferCatalogSave(true);
    setCatalogSource("manual");
    setSourceLabel("Adding as a new product");
    setAddType("paints");
    setPhase("new");
  }

  async function increment(m: Match) {
    setRowBusy(m.row.id);
    const next = (m.row.quantity ?? 0) + 1;
    const { data, error } = await supabase
      .from(m.table).update({ quantity: next }).eq("id", m.row.id).select().single();
    setRowBusy(null);
    if (error || !data) return;
    setMatches((ms) => ms.map((x) => (x.row.id === m.row.id ? { ...x, row: data } : x)));
    setFlash(`Quantity updated to ${next}.`);
    pushRecent({
      id: m.row.id, type: m.type, category: m.category,
      title: LOOKUP.find((l) => l.table === m.table)!.title(data),
      action: "added", savedToCatalog: false, qtyNote: `qty → ${next}`,
    });
  }

  async function addNote(m: Match) {
    const draft = (noteDraft[m.row.id] ?? "").trim();
    if (!draft) return;
    setRowBusy(m.row.id);
    const combined = m.row.notes ? `${m.row.notes}\n${draft}` : draft;
    const { data, error } = await supabase
      .from(m.table).update({ notes: combined }).eq("id", m.row.id).select().single();
    setRowBusy(null);
    if (error || !data) return;
    setMatches((ms) => ms.map((x) => (x.row.id === m.row.id ? { ...x, row: data } : x)));
    setNoteDraft((d) => ({ ...d, [m.row.id]: "" }));
    pushRecent({
      id: m.row.id, type: m.type, category: m.category,
      title: LOOKUP.find((l) => l.table === m.table)!.title(data),
      action: "added", savedToCatalog: false, qtyNote: "note added",
    });
  }

  function handleAdded(e: AddedEntry) {
    pushRecent(e);
    setFlash(
      e.category === null
        ? "Added to your wishlist."
        : e.savedToCatalog
        ? "Added to your inventory and saved to the shared catalog."
        : "Added to your inventory only."
    );
    startOver();
  }

  return (
    <div className="space-y-4">
      {scanning ? <BarcodeScanner onDetected={lookup} onClose={() => setScanning(false)} /> : null}

      <header>
        <div className="eyebrow">Scan In</div>
        <h1 className="font-display text-2xl font-semibold">Inventory intake</h1>
        <p className="text-sm text-muted">
          Scan or type a barcode to add new stock or top up what you own.
        </p>
      </header>

      {flash ? (
        <div className="card border-jade/40 bg-jade/10 p-3 text-sm text-jade">{flash}</div>
      ) : null}

      <div className="card space-y-3 p-4">
        <button onClick={() => setScanning(true)} className="w-full rounded-lg bg-brass px-4 py-3 font-semibold text-gun">
          ▦ Scan barcode
        </button>
        <div className="flex gap-2">
          <input
            inputMode="numeric"
            placeholder="…or type a barcode"
            className="min-w-0 flex-1 rounded-lg border border-line bg-gun px-3 py-2.5 outline-none focus:border-jade"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && manual.trim() && lookup(manual.trim())}
          />
          <button
            onClick={() => manual.trim() && lookup(manual.trim())}
            disabled={!manual.trim()}
            className="rounded-lg border border-line px-4 py-2.5 disabled:opacity-50"
          >
            Go
          </button>
        </div>
        {code ? (
          <div className="text-xs text-muted">
            Current: <span className="font-mono text-ink">{code}</span>
            <button onClick={startOver} className="ml-3 underline">clear</button>
          </div>
        ) : null}
      </div>

      {phase === "looking" ? (
        <div className="card p-4 text-sm text-muted">Looking up product…</div>
      ) : null}

      {phase === "found" ? (
        <section className="space-y-2">
          <div className="card border-jade/40 bg-jade/10 p-3 text-sm text-jade">
            Already in your inventory — {matches.length} match{matches.length === 1 ? "" : "es"}.
          </div>
          {matches.map((m) => (
            <div key={m.row.id} className="card space-y-3 p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="truncate font-medium">{LOOKUP.find((l) => l.table === m.table)!.title(m.row)}</div>
                  <div className="text-xs text-muted">{m.type} · qty {m.row.quantity ?? 0}</div>
                </div>
                <Link href={`/inventory/${m.category}/${m.row.id}`} className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm">
                  View item
                </Link>
              </div>
              <button onClick={() => increment(m)} disabled={rowBusy === m.row.id}
                className="w-full rounded-lg bg-jade px-4 py-2.5 font-semibold text-gun disabled:opacity-50">
                + Increment quantity
              </button>
              <div className="flex gap-2">
                <input placeholder="Add a note"
                  className="min-w-0 flex-1 rounded-lg border border-line bg-gun px-3 py-2 text-sm outline-none focus:border-jade"
                  value={noteDraft[m.row.id] ?? ""}
                  onChange={(e) => setNoteDraft((d) => ({ ...d, [m.row.id]: e.target.value }))} />
                <button onClick={() => addNote(m)}
                  disabled={rowBusy === m.row.id || !(noteDraft[m.row.id] ?? "").trim()}
                  className="rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-50">
                  Save note
                </button>
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={addAsNewManual} className="flex-1 rounded-lg border border-line px-4 py-2.5 text-sm">
              Not this — add as new
            </button>
            <button onClick={startOver} className="flex-1 rounded-lg border border-line px-4 py-2.5 text-sm">
              Scan another
            </button>
          </div>
        </section>
      ) : null}

      {phase === "new" && code ? (
        <section className="space-y-3">
          <div className={`card p-3 text-sm ${
            sourceLabel?.startsWith("Prefilled")
              ? "border-jade/40 bg-jade/10 text-jade"
              : "border-amber/40 bg-amber/10 text-amber"}`}>
            {sourceLabel ?? "Not in your inventory yet — quick-add it."}
          </div>
          <div className="flex flex-wrap gap-2">
            {ADD_TABS.map((t) => (
              <button key={t} onClick={() => setAddType(t)}
                className={`rounded-full px-3 py-1.5 text-sm ${addType === t ? "bg-jade text-gun" : "border border-line text-muted"}`}>
                {QUICK_TYPES[t].label}
              </button>
            ))}
          </div>
          <div className="card p-4">
            <QuickAddForm
              key={addType}
              typeKey={addType}
              barcode={code}
              prefill={prefill}
              offerCatalogSave={offerCatalogSave}
              catalogSource={catalogSource}
              onAdded={handleAdded}
            />
          </div>
          <button onClick={startOver} className="w-full rounded-lg border border-line px-4 py-2.5 text-sm">
            Cancel
          </button>
        </section>
      ) : null}

      {recent.length ? (
        <section>
          <div className="eyebrow mb-2">Recently added</div>
          <ul className="space-y-2">
            {recent.map((e, i) => (
              <li key={`${e.id}-${i}`} className="card flex items-center gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{e.title}</div>
                  <div className="text-xs text-muted">
                    {e.type}
                    {e.qtyNote ? ` · ${e.qtyNote}` : " · added"}
                    {e.savedToCatalog ? " · catalog" : ""}
                  </div>
                </div>
                {e.category ? (
                  <Link href={`/inventory/${e.category}/${e.id}`} className="text-muted">→</Link>
                ) : (
                  <Link href="/wishlist" className="text-muted">→</Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

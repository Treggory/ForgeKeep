"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Minimal "quick-add" forms for intake. Deliberately short; full editing happens
// later via "View item". The scanned barcode is pre-filled and read-only, values
// can be prefilled from the catalog / external lookup, and (for the four owned
// item types) the product can optionally be contributed to the shared catalog.
type QField = {
  n: string;
  l: string;
  req?: boolean;
  num?: boolean;
  def?: any;
  select?: string[];
};

type CatalogShape = { name: string | null; brand: string | null; category: string | null };

type QType = {
  table: string;
  label: string;
  category: string | null;          // inventory route segment; null for wishlist
  fields: QField[];
  title: (v: any) => string;
  prefill: (p: Prefill) => Record<string, any>;
  // map entered form values -> a catalog row. Absent => not catalogable (wishlist).
  toCatalog?: (v: any) => CatalogShape;
};

export type Prefill = { name?: string | null; brand?: string | null; category?: string | null };

export const QUICK_TYPES: Record<string, QType> = {
  paints: {
    table: "paints", label: "Paint", category: "paints",
    fields: [
      { n: "brand", l: "Brand", req: true },
      { n: "color_name", l: "Color / product", req: true },
      { n: "quantity", l: "Quantity", num: true, def: 1 },
    ],
    title: (v) => `${v.brand} — ${v.color_name}`,
    prefill: (p) => ({ brand: p.brand ?? "", color_name: p.name ?? "" }),
    toCatalog: (v) => ({ name: v.color_name || null, brand: v.brand || null, category: "Paint" }),
  },
  miniatures: {
    table: "miniature_units", label: "Miniature", category: "miniatures",
    fields: [
      { n: "unit_name", l: "Unit name", req: true },
      { n: "quantity", l: "Quantity", num: true, def: 1 },
    ],
    title: (v) => v.unit_name,
    prefill: (p) => ({ unit_name: p.name ?? "" }),
    toCatalog: (v) => ({ name: v.unit_name || null, brand: null, category: "Miniature" }),
  },
  tools: {
    table: "tools", label: "Tool", category: "tools",
    fields: [
      { n: "item", l: "Item", req: true },
      { n: "category", l: "Category" },
      { n: "quantity", l: "Quantity", num: true, def: 1 },
    ],
    title: (v) => v.item,
    prefill: (p) => ({ item: p.name ?? "", category: p.category ?? "" }),
    toCatalog: (v) => ({ name: v.item || null, brand: null, category: v.category || "Tool" }),
  },
  terrain: {
    table: "terrain", label: "Terrain", category: "terrain",
    fields: [
      { n: "terrain_set", l: "Terrain set", req: true },
      { n: "components", l: "Components" },
    ],
    title: (v) => v.terrain_set,
    prefill: (p) => ({ terrain_set: p.name ?? "" }),
    toCatalog: (v) => ({ name: v.terrain_set || null, brand: null, category: "Terrain" }),
  },
  wishlist: {
    table: "wishlist", label: "Wishlist", category: null,
    fields: [
      { n: "name", l: "Name", req: true },
      { n: "brand", l: "Brand" },
      { n: "reason", l: "Reason", select: ["Want to Buy", "Need Replacement", "Future Project"], def: "Want to Buy" },
    ],
    title: (v) => v.name,
    prefill: (p) => ({ name: p.name ?? "", brand: p.brand ?? "" }),
    // no toCatalog: a wishlist entry is an intent, not an owned product
  },
};

export type AddedEntry = {
  id: string;
  type: string;
  category: string | null;
  title: string;
  action: "added";
  savedToCatalog: boolean;
};

export default function QuickAddForm({
  typeKey,
  barcode,
  prefill,
  offerCatalogSave = false,
  catalogSource = "manual",
  onAdded,
}: {
  typeKey: string;
  barcode: string;
  prefill?: Prefill | null;
  offerCatalogSave?: boolean;
  catalogSource?: string;
  onAdded: (e: AddedEntry) => void;
}) {
  const supabase = createClient();
  const def = QUICK_TYPES[typeKey];
  const catalogable = offerCatalogSave && !!def.toCatalog;

  const [values, setValues] = useState<Record<string, any>>(() => {
    const v: Record<string, any> = {};
    for (const f of def.fields) v[f.n] = f.def ?? "";
    if (prefill) Object.assign(v, def.prefill(prefill));
    return v;
  });
  const [saveToCatalog, setSaveToCatalog] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missingReq = def.fields.some((f) => f.req && !String(values[f.n] ?? "").trim());

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");

      const payload: Record<string, any> = { owner_id: user.id, barcode };
      for (const f of def.fields) {
        const raw = values[f.n];
        payload[f.n] =
          raw === "" || raw == null ? (f.num ? (f.req ? 0 : null) : null) : f.num ? Number(raw) : raw;
      }
      if (typeKey === "wishlist") payload.item_type = "other";

      const { data, error } = await supabase
        .from(def.table)
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      // Optionally contribute to the shared catalog — built from the values the
      // user actually entered, only on explicit confirmation. Never touches the
      // user's inventory beyond the row inserted above. A catalog failure does
      // not fail the add; we just report it as inventory-only.
      let savedToCatalog = false;
      if (catalogable && saveToCatalog && def.toCatalog) {
        const c = def.toCatalog(values);
        if (c.name) {
          // Writes go through the SECURITY DEFINER RPC (migration 0009), which
          // protects verified entries and records the contributor. Ordinary
          // users can no longer write product_catalog directly.
          const { error: cErr } = await supabase.rpc("upsert_catalog_product", {
            p_barcode: barcode,
            p_name: c.name,
            p_brand: c.brand,
            p_category: c.category,
            p_source: catalogSource,
          });
          savedToCatalog = !cErr;
        }
      }

      onAdded({
        id: data.id,
        type: def.label,
        category: def.category,
        title: def.title(data),
        action: "added",
        savedToCatalog,
      });
    } catch (e: any) {
      setError(e.message ?? "Couldn't add item.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="card border-rust/50 bg-rust/10 p-3 text-sm text-rust">{error}</div>
      ) : null}

      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wide text-muted">Barcode</span>
        <input
          readOnly
          value={barcode}
          className="w-full rounded-lg border border-line bg-panel2 px-3 py-2.5 font-mono text-muted"
        />
      </label>

      {def.fields.map((f) => (
        <label key={f.n} className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-muted">
            {f.l}
            {f.req ? <span className="text-rust"> *</span> : null}
          </span>
          {f.select ? (
            <select
              className="w-full rounded-lg border border-line bg-gun px-3 py-2.5 outline-none focus:border-jade"
              value={values[f.n] ?? ""}
              onChange={(e) => setValues((p) => ({ ...p, [f.n]: e.target.value }))}
            >
              {f.select.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          ) : (
            <input
              type={f.num ? "number" : "text"}
              className="w-full rounded-lg border border-line bg-gun px-3 py-2.5 outline-none focus:border-jade"
              value={values[f.n] ?? ""}
              onChange={(e) => setValues((p) => ({ ...p, [f.n]: e.target.value }))}
            />
          )}
        </label>
      ))}

      {catalogable ? (
        <label className="flex items-start gap-2 text-sm text-muted">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={saveToCatalog}
            onChange={(e) => setSaveToCatalog(e.target.checked)}
          />
          <span>
            Also save this product to the shared catalog
            <span className="block text-xs">(barcode + name/brand/category, helps future scans)</span>
          </span>
        </label>
      ) : null}

      <button
        onClick={save}
        disabled={busy || missingReq}
        className="w-full rounded-lg bg-jade px-4 py-3 font-semibold text-gun disabled:opacity-50"
      >
        {busy ? "Adding…" : `Add ${def.label.toLowerCase()}`}
      </button>
    </div>
  );
}

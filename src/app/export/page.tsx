"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Sheet definitions mirror the original import workbook headers so an exported
// file can be re-imported by scripts/import_excel.py without edits.
type SheetDef = {
  sheet: string;
  table: string;
  select: string;
  map: (r: any) => Record<string, any>;
};

const SHEETS: SheetDef[] = [
  {
    sheet: "Miniatures",
    table: "miniature_units",
    select: "*, faction:factions(name)",
    map: (r) => ({
      Faction: r.faction?.name ?? "",
      Unit: r.unit_name,
      Quantity: r.quantity,
      Material: r.material ?? "",
      "Paint Status": r.paint_status ?? "",
      "Assembly Status": r.assembly_status ?? "",
      "Basing Status": r.basing_status ?? "",
      "Repairs Needed": r.repairs_needed ?? "",
      "Tabletop Ready": r.tabletop_ready ?? "",
      Priority: r.priority ?? "",
      "Storage Location": "",
      "Loadout / Notes": r.notes ?? "",
      "Estimated Value": r.estimated_value ?? 0,
      Barcode: r.barcode ?? "",
    }),
  },
  {
    sheet: "Paints",
    table: "paints",
    select: "*",
    map: (r) => ({
      Category: r.category ?? "",
      Brand: r.brand,
      Line: r.line ?? "",
      "Color / Product": r.color_name,
      Quantity: r.quantity,
      "Paint Type": r.paint_type ?? "",
      Condition: r.condition ?? "",
      "Opened?": r.opened ?? "",
      Barcode: r.barcode ?? "",
      "Needs Replacement?": r.needs_replacement ?? "",
      "Storage Location": "",
      Notes: r.notes ?? "",
    }),
  },
  {
    sheet: "Brushes",
    table: "brushes",
    select: "*",
    map: (r) => ({
      Brand: r.manufacturer,
      "Series / Type": r.series ?? "",
      Size: r.size ?? "",
      Quantity: r.quantity,
      "Hair / Material": r.material ?? "",
      Condition: r.condition ?? "",
      "Primary Use": r.purpose ?? "",
      Notes: r.notes ?? "",
    }),
  },
  {
    sheet: "Tools_Equipment",
    table: "tools",
    select: "*",
    map: (r) => ({
      Category: r.category ?? "",
      Item: r.item,
      Barcode: r.barcode ?? "",
      Quantity: r.quantity,
      Condition: r.condition ?? "",
      "Storage Location": "",
      Notes: r.notes ?? "",
    }),
  },
  {
    sheet: "Terrain",
    table: "terrain",
    select: "*",
    map: (r) => ({
      "Terrain Set": r.terrain_set,
      Barcode: r.barcode ?? "",
      Component: r.components ?? "",
      Quantity: r.quantity_label ?? r.quantity ?? "",
      "Paint Status": r.paint_status ?? "",
      "Repairs Needed": r.repairs_needed ?? "",
      "Storage Location": "",
      Notes: r.notes ?? "",
    }),
  },
  {
    sheet: "Wishlist",
    table: "wishlist",
    select: "*",
    map: (r) => ({
      "Item Type": r.item_type ?? "",
      Name: r.name,
      Brand: r.brand ?? "",
      Reason: r.reason ?? "",
      Notes: r.notes ?? "",
      "Estimated Price": r.estimated_price ?? "",
      Barcode: r.barcode ?? "",
      Fulfilled: r.fulfilled ? "Yes" : "No",
      "Created At": r.created_at ?? "",
    }),
  },
];

function toCSV(rows: Record<string, any>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportPage() {
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function fetchSheet(def: SheetDef) {
    const { data, error } = await supabase.from(def.table).select(def.select);
    if (error) throw error;
    return (data ?? []).map(def.map);
  }

  async function exportExcel() {
    setBusy("excel");
    setErr(null);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      for (const def of SHEETS) {
        const rows = await fetchSheet(def);
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, def.sheet);
      }
      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const stamp = new Date().toISOString().slice(0, 10);
      download(
        new Blob([out], { type: "application/octet-stream" }),
        `ForgeKeep_Inventory_${stamp}.xlsx`
      );
    } catch (e: any) {
      setErr(e.message ?? "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  async function exportCSV(def: SheetDef) {
    setBusy(def.sheet);
    setErr(null);
    try {
      const rows = await fetchSheet(def);
      const stamp = new Date().toISOString().slice(0, 10);
      download(
        new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8;" }),
        `ForgeKeep_${def.sheet}_${stamp}.csv`
      );
    } catch (e: any) {
      setErr(e.message ?? "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <div className="eyebrow">Reporting</div>
        <h1 className="font-display text-2xl font-semibold">Export &amp; backup</h1>
        <p className="text-sm text-muted">
          The Excel file matches your original workbook layout, so it re-imports cleanly.
          The Wishlist sheet is export-only (it isn&apos;t read back on import).
        </p>
      </header>

      {err ? (
        <div className="card border-rust/50 bg-rust/10 p-3 text-sm text-rust">{err}</div>
      ) : null}

      <button
        onClick={exportExcel}
        disabled={!!busy}
        className="card flex w-full items-center justify-between p-4 disabled:opacity-50"
      >
        <span className="font-display text-lg">⤓ Full Excel workbook (.xlsx)</span>
        <span className="text-jade">{busy === "excel" ? "…" : "Download"}</span>
      </button>

      <div>
        <div className="eyebrow mb-2">Individual CSVs</div>
        <ul className="space-y-2">
          {SHEETS.map((def) => (
            <li key={def.sheet}>
              <button
                onClick={() => exportCSV(def)}
                disabled={!!busy}
                className="card flex w-full items-center justify-between p-3 text-sm disabled:opacity-50"
              >
                <span>{def.sheet}</span>
                <span className="text-muted">{busy === def.sheet ? "…" : "CSV →"}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

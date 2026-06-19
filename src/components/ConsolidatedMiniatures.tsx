import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProgressBar from "@/components/ProgressBar";
import EmptyState from "@/components/EmptyState";

// Consolidated miniatures: one card per canonical unit group, with the original
// individual entries preserved as expandable child rows (no history lost).
export default async function ConsolidatedMiniatures() {
  const supabase = await createClient();

  const [{ data: groups }, { data: children }] = await Promise.all([
    supabase.from("v_unit_groups").select("*").order("name"),
    supabase
      .from("miniature_units")
      .select(
        "id, unit_name, quantity, paint_status, assembly_status, basing_status, priority, notes, barcode, group_id"
      )
      .order("created_at"),
  ]);

  const byGroup = new Map<string, any[]>();
  for (const c of children ?? []) {
    const key = c.group_id ?? "ungrouped";
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key)!.push(c);
  }

  const grps = groups ?? [];

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <div className="eyebrow">🪖 {grps.length} units · {children?.length ?? 0} entries</div>
          <h1 className="font-display text-2xl font-semibold">Miniatures</h1>
        </div>
        <Link
          href="/inventory/miniatures/new"
          className="rounded-full bg-jade px-4 py-2 text-sm font-semibold text-gun"
        >
          + Add
        </Link>
      </header>

      {grps.length === 0 ? (
        <EmptyState
          title="No miniatures yet"
          body="Add your first unit or import your workbook."
          ctaHref="/inventory/miniatures/new"
          ctaLabel="Add miniature unit"
        />
      ) : (
        <ul className="space-y-2">
          {grps.map((g) => {
            const kids = byGroup.get(g.group_id) ?? [];
            const multi = kids.length > 1;
            return (
              <li key={g.group_id} className="card overflow-hidden">
                <details open={false} className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {g.name}
                        {multi ? (
                          <span className="ml-2 rounded-full bg-line px-2 py-0.5 align-middle text-[0.6rem] uppercase tracking-wide text-muted">
                            {kids.length} entries
                          </span>
                        ) : null}
                      </div>
                      <div className="truncate text-xs text-muted">
                        {[g.faction, `${g.total_quantity} models`].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <div className="w-20">
                      <ProgressBar
                        value={g.total_quantity ? (100 * g.total_painted) / g.total_quantity : 0}
                      />
                    </div>
                    <span className="text-muted transition-transform group-open:rotate-90">›</span>
                  </summary>

                  <div className="border-t border-line">
                    {kids.map((c) => (
                      <Link
                        key={c.id}
                        href={`/inventory/miniatures/${c.id}`}
                        className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-panel2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate">
                            {c.quantity} × <span className="text-muted">{c.paint_status ?? "—"}</span>
                          </div>
                          <div className="truncate text-xs text-muted">
                            {[c.assembly_status, c.basing_status, c.priority, c.notes]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </div>
                        </div>
                        {c.barcode ? (
                          <span className="font-mono text-[0.6rem] text-muted">{c.barcode}</span>
                        ) : null}
                        <span className="text-muted">→</span>
                      </Link>
                    ))}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

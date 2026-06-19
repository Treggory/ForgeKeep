import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEntity } from "@/lib/entities";
import EmptyState from "@/components/EmptyState";
import ConsolidatedMiniatures from "@/components/ConsolidatedMiniatures";

export default async function ListPage({
  params,
}: {
  params: { category: string };
}) {
  const entity = getEntity(params.category);
  if (!entity) notFound();

  // Miniatures get the consolidated (grouped) presentation.
  if (entity.key === "miniatures") return <ConsolidatedMiniatures />;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(entity.table)
    .select(entity.selectQuery)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as any[];

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <div className="eyebrow">{entity.icon} {rows.length} items</div>
          <h1 className="font-display text-2xl font-semibold">{entity.plural}</h1>
        </div>
        <Link
          href={`/inventory/${entity.key}/new`}
          className="rounded-full bg-jade px-4 py-2 text-sm font-semibold text-gun"
        >
          + Add
        </Link>
      </header>

      {error ? (
        <div className="card border-rust/50 bg-rust/10 p-3 text-sm text-rust">
          {error.message}
        </div>
      ) : null}

      {rows.length === 0 && !error ? (
        <EmptyState
          title={`No ${entity.plural.toLowerCase()} yet`}
          body="Add your first item or import your workbook."
          ctaHref={`/inventory/${entity.key}/new`}
          ctaLabel={`Add ${entity.singular.toLowerCase()}`}
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const badge = entity.badge?.(r) ?? null;
            return (
              <li key={r.id}>
                <Link
                  href={`/inventory/${entity.key}/${r.id}`}
                  className="card flex items-center gap-3 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{entity.title(r)}</div>
                    <div className="truncate text-xs text-muted">
                      {entity.subtitle(r)}
                    </div>
                  </div>
                  {badge ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[0.65rem] uppercase tracking-wide ${
                        badge.tone === "amber"
                          ? "bg-amber/15 text-amber"
                          : badge.tone === "jade"
                          ? "bg-jade/15 text-jade"
                          : "bg-line text-muted"
                      }`}
                    >
                      {badge.text}
                    </span>
                  ) : null}
                  <span className="text-muted">→</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

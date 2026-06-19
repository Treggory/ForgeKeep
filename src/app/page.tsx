import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import StatCard from "@/components/StatCard";
import ProgressBar from "@/components/ProgressBar";

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export default async function Dashboard() {
  const supabase = await createClient();

  const [collection, hobby, byType, replacement, projects, groups] = await Promise.all([
    supabase.from("v_collection_stats").select("*").maybeSingle(),
    supabase.from("v_hobby_stats").select("*").maybeSingle(),
    supabase.from("v_paint_by_type").select("*").order("total", { ascending: false }),
    supabase.from("v_paints_replacement").select("id", { count: "exact", head: true }),
    supabase.from("v_project_progress").select("*").order("pct_completed", { ascending: false }),
    supabase.from("v_unit_groups").select("group_id", { count: "exact", head: true }),
  ]);

  const c = collection.data;
  const h = hobby.data;
  const empty = !c && !h;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <div className="eyebrow">Collection</div>
          <h1 className="font-display text-2xl font-semibold">Dashboard</h1>
        </div>
        <Link
          href="/store"
          className="rounded-full bg-jade px-4 py-2 text-sm font-semibold text-gun"
        >
          ◎ Store Mode
        </Link>
      </header>

      {empty ? (
        <div className="card p-6 text-center">
          <div className="font-display text-lg">No data yet</div>
          <p className="mt-1 text-sm text-muted">
            Run the inventory seed (migration 0006) or add items from the
            Inventory tab to populate your dashboard.
          </p>
        </div>
      ) : null}

      {c ? (
        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total models" value={c.total_models} tone="brass" />
            <StatCard label="Painted" value={c.models_painted} tone="jade" />
            <StatCard label="Unpainted" value={c.models_unpainted} />
            <StatCard label="Need repair" value={c.models_needing_repair} tone="amber" />
          </div>
          <div className="card p-4">
            <ProgressBar
              label="Collection painted"
              value={c.total_models ? (100 * c.models_painted) / c.total_models : 0}
            />
            <div className="mt-3 flex justify-between text-sm text-muted">
              <span>Tabletop ready: <span className="text-ink">{c.models_tabletop_ready}</span></span>
              <span>Est. value: <span className="text-brass">{money(c.estimated_value)}</span></span>
            </div>
            {(groups.count ?? 0) > 0 ? (
              <div className="mt-1 text-xs text-muted">
                Consolidated into <span className="text-ink">{groups.count}</span> unit
                {groups.count === 1 ? "" : "s"}.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {h ? (
        <section>
          <div className="eyebrow mb-2">Paints &amp; Hobby</div>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Paints" value={h.paint_count} />
            <StatCard label="Brushes" value={h.brush_count} />
            <StatCard label="Tools" value={h.tool_count} />
          </div>
          {(replacement.count ?? 0) > 0 ? (
            <Link
              href="/inventory/paints"
              className="card mt-3 flex items-center justify-between p-3 text-sm"
            >
              <span className="text-amber">⚠ {replacement.count} paint(s) need replacing</span>
              <span className="text-muted">View →</span>
            </Link>
          ) : null}
          {byType.data && byType.data.length ? (
            <div className="card mt-3 p-4">
              <div className="eyebrow mb-2">Paints by type</div>
              <ul className="space-y-1.5 text-sm">
                {byType.data.slice(0, 6).map((t: any) => (
                  <li key={t.paint_type} className="flex justify-between">
                    <span className="text-muted">{t.paint_type}</span>
                    <span className="font-mono">{t.total}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {projects.data && projects.data.length ? (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="eyebrow">Active projects</div>
            <Link href="/projects" className="text-sm text-muted">All →</Link>
          </div>
          <div className="space-y-3">
            {projects.data.slice(0, 3).map((p: any) => (
              <div key={p.project_id} className="card p-4">
                <div className="mb-2 flex justify-between">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-muted">{p.total_models} models</span>
                </div>
                <ProgressBar label="Completed" value={p.pct_completed} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

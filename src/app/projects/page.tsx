import { createClient } from "@/lib/supabase/server";
import ProgressBar from "@/components/ProgressBar";
import EmptyState from "@/components/EmptyState";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_project_progress")
    .select("*")
    .order("pct_completed", { ascending: false });

  const projects = (data ?? []) as any[];

  return (
    <div className="space-y-4">
      <header>
        <div className="eyebrow">Hobby</div>
        <h1 className="font-display text-2xl font-semibold">Projects</h1>
      </header>

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          body="Projects are created from your miniatures' priorities during import, or assign a unit to a project when editing it."
        />
      ) : (
        <ul className="space-y-3">
          {projects.map((p) => (
            <li key={p.project_id} className="card p-4">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <div className="font-display text-lg">{p.name}</div>
                  <div className="text-xs text-muted">
                    {p.total_models} models · {p.status}
                  </div>
                </div>
                <span className="font-mono text-2xl text-jade">{p.pct_completed}%</span>
              </div>
              <div className="space-y-2">
                <ProgressBar label="Completed" value={p.pct_completed} tone="jade" />
                <ProgressBar label="Painted" value={p.pct_painted} tone="brass" />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-muted">
                {[
                  ["Assembled", p.assembled],
                  ["Primed", p.primed],
                  ["Basecoated", p.basecoated],
                  ["Painted", p.painted],
                  ["Based", p.based],
                  ["Completed", p.completed],
                ].map(([label, n]) => (
                  <div key={label as string} className="rounded-lg bg-gun py-2">
                    <div className="font-mono text-ink">{n as number}</div>
                    {label}
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

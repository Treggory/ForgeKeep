export default function StatCard({
  label,
  value,
  hint,
  tone = "ink",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "ink" | "jade" | "amber" | "brass";
}) {
  const toneClass = {
    ink: "text-ink",
    jade: "text-jade",
    amber: "text-amber",
    brass: "text-brass",
  }[tone];
  return (
    <div className="card p-4">
      <div className="eyebrow">{label}</div>
      <div className={`mt-1 font-display text-3xl font-semibold ${toneClass}`}>
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

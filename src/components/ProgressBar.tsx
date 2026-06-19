export default function ProgressBar({
  value,
  label,
  tone = "jade",
}: {
  value: number; // 0..100
  label?: string;
  tone?: "jade" | "brass";
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const bar = tone === "jade" ? "bg-jade" : "bg-brass";
  return (
    <div>
      {label ? (
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>{label}</span>
          <span className="font-mono">{v}%</span>
        </div>
      ) : null}
      <div className="h-2 w-full overflow-hidden rounded-full bg-line">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

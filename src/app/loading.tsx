export default function Loading() {
  return (
    <div className="space-y-3">
      <div className="h-7 w-40 animate-pulse rounded bg-line" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-24 animate-pulse" />
        ))}
      </div>
      <div className="card h-40 animate-pulse" />
    </div>
  );
}

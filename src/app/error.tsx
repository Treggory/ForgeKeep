"use client";
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="card mt-10 p-6 text-center">
      <div className="font-display text-xl text-amber">Something broke</div>
      <p className="mt-2 break-words text-sm text-muted">{error.message}</p>
      <button
        onClick={reset}
        className="mt-4 rounded-lg bg-jade px-4 py-2 text-sm font-semibold text-gun"
      >
        Try again
      </button>
    </div>
  );
}

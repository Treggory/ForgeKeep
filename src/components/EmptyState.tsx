import Link from "next/link";

export default function EmptyState({
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  body?: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center">
      <div className="text-3xl opacity-60">∅</div>
      <div className="font-display text-lg">{title}</div>
      {body ? <p className="max-w-sm text-sm text-muted">{body}</p> : null}
      {ctaHref && ctaLabel ? (
        <Link
          href={ctaHref}
          className="mt-1 rounded-lg bg-jade px-4 py-2 text-sm font-semibold text-gun"
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}

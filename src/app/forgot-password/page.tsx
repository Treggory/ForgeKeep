"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    // Works locally and in production: defaults to the current origin, with an
    // optional NEXT_PUBLIC_SITE_URL override for canonical links. The resulting
    // URL must be in Supabase Auth -> URL Configuration -> Redirect URLs.
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${siteUrl}/reset-password`,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className="mb-6 text-center">
        <div className="font-display text-4xl font-bold tracking-wide text-brass">
          FORGEKEEP
        </div>
        <p className="text-sm text-muted">Reset your password.</p>
      </div>

      <div className="card space-y-3 p-5">
        {sent ? (
          <>
            <div className="rounded-lg border border-jade/40 bg-jade/10 p-3 text-sm text-jade">
              If an account exists for that email, a password reset link is on its
              way. Check your inbox (and spam).
            </div>
            <Link
              href="/login"
              className="block w-full rounded-lg border border-line px-4 py-2.5 text-center text-sm"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            {error ? (
              <div className="rounded-lg border border-line bg-gun p-2.5 text-sm text-amber">
                {error}
              </div>
            ) : null}
            <p className="text-sm text-muted">
              Enter your account email and we&apos;ll send a reset link.
            </p>
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wide text-muted">Email</span>
              <input
                type="email"
                autoComplete="email"
                className="w-full rounded-lg border border-line bg-gun px-3 py-2.5 outline-none focus:border-jade"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && email.trim() && submit()}
              />
            </label>
            <button
              onClick={submit}
              disabled={busy || !email.trim()}
              className="w-full rounded-lg bg-jade px-4 py-3 font-semibold text-gun disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
            <Link
              href="/login"
              className="block text-center text-sm text-muted underline-offset-2 hover:underline"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

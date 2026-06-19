"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Establish the recovery session from whatever the email link delivered.
  useEffect(() => {
    let active = true;

    // Implicit/hash flow: the browser client auto-detects the recovery token in
    // the URL hash and fires PASSWORD_RECOVERY (or SIGNED_IN with a session).
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setStatus("ready");
      }
    });

    (async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("error_description")) {
        if (active) setStatus("invalid");
        return;
      }
      // PKCE flow: a ?code= must be exchanged for a session.
      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!active) return;
        if (error) {
          setStatus("invalid");
          return;
        }
        window.history.replaceState({}, "", "/reset-password");
        setStatus("ready");
        return;
      }
      // Otherwise check whether a recovery session already exists.
      const { data } = await supabase.auth.getSession();
      if (active && data.session) setStatus("ready");
    })();

    // If no recovery session materializes, the link was bad or expired.
    const timer = setTimeout(() => {
      if (active) setStatus((s) => (s === "checking" ? "invalid" : s));
    }, 2500);

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [supabase]);

  async function submit() {
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    // Sign out the recovery session and send them to sign in fresh.
    await supabase.auth.signOut();
    router.replace("/login?reset=success");
  }

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className="mb-6 text-center">
        <div className="font-display text-4xl font-bold tracking-wide text-brass">
          FORGEKEEP
        </div>
        <p className="text-sm text-muted">Choose a new password.</p>
      </div>

      <div className="card space-y-3 p-5">
        {status === "checking" ? (
          <p className="text-sm text-muted">Verifying your reset link…</p>
        ) : status === "invalid" ? (
          <>
            <div className="rounded-lg border border-line bg-gun p-3 text-sm text-amber">
              This reset link is invalid or has expired.
            </div>
            <Link
              href="/forgot-password"
              className="block w-full rounded-lg bg-jade px-4 py-2.5 text-center font-semibold text-gun"
            >
              Request a new link
            </Link>
          </>
        ) : (
          <>
            {error ? (
              <div className="rounded-lg border border-line bg-gun p-2.5 text-sm text-amber">
                {error}
              </div>
            ) : null}
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wide text-muted">New password</span>
              <input
                type="password"
                autoComplete="new-password"
                className="w-full rounded-lg border border-line bg-gun px-3 py-2.5 outline-none focus:border-jade"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wide text-muted">Confirm password</span>
              <input
                type="password"
                autoComplete="new-password"
                className="w-full rounded-lg border border-line bg-gun px-3 py-2.5 outline-none focus:border-jade"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </label>
            <button
              onClick={submit}
              disabled={busy || !password || !confirm}
              className="w-full rounded-lg bg-jade px-4 py-3 font-semibold text-gun disabled:opacity-50"
            >
              {busy ? "Updating…" : "Update password"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

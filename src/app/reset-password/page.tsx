"use client";
import { useEffect, useRef, useState } from "react";
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
  const startedRef = useRef(false);

  // Establish the recovery session. With the standard client, detectSessionInUrl
  // may auto-exchange the ?code= during init, so we (a) accept an already-present
  // session, (b) otherwise exchange the code exactly once, and (c) on any
  // exchange error, re-check for a session — the auto-exchange may have already
  // succeeded. We never time out before the exchange resolves, and we do not
  // rely on PASSWORD_RECOVERY events.
  useEffect(() => {
    if (startedRef.current) return; // exactly once (guards StrictMode double-invoke)
    startedRef.current = true;

    let active = true;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const errorDescription = params.get("error_description");
      if (errorDescription) {
        console.error("[reset-password] link error:", errorDescription);
        if (active) setStatus("invalid");
        return;
      }
      const code = params.get("code");

      // (a) A session may already exist if the client auto-exchanged the code.
      const { data: existing } = await supabase.auth.getSession();
      if (!active) return;
      if (existing.session) {
        window.history.replaceState({}, "", "/reset-password");
        setStatus("ready");
        return;
      }

      if (!code) {
        setStatus("invalid");
        return;
      }

      // (b) Exchange the code exactly once.
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!active) return;

      if (error) {
        // Log the exact error object for diagnosis.
        console.error("[reset-password] exchangeCodeForSession error:", error);
        // (c) The auto-exchange may have already consumed the code and created
        // the session; treat an existing session as success.
        const { data: after } = await supabase.auth.getSession();
        if (!active) return;
        if (after.session) {
          window.history.replaceState({}, "", "/reset-password");
          setStatus("ready");
          return;
        }
        setStatus("invalid");
        return;
      }

      window.history.replaceState({}, "", "/reset-password");
      setStatus("ready");
    })();

    return () => {
      active = false;
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

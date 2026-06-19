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

  // Establish the recovery session by exchanging the PKCE code EXACTLY ONCE.
  // We do not rely on PASSWORD_RECOVERY auth events, and we never time out
  // before the exchange resolves — the exchange result alone decides validity.
  useEffect(() => {
    if (startedRef.current) return; // guard React StrictMode's double-invoke
    startedRef.current = true;

    let active = true;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const errorDescription = params.get("error_description");
      const code = params.get("code");

      if (errorDescription) {
        console.error("[reset-password] link error:", errorDescription);
        if (active) setStatus("invalid");
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!active) return;
        if (error) {
          console.error("[reset-password] exchangeCodeForSession failed:", error.message);
          setStatus("invalid");
          return;
        }
        // Success: remove the code from the URL and show the form.
        window.history.replaceState({}, "", "/reset-password");
        setStatus("ready");
        return;
      }

      // No code present — a session may already exist (e.g. after a refresh).
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setStatus(data.session ? "ready" : "invalid");
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

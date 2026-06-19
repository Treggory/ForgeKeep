"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Tokens = { access_token: string; refresh_token: string };

function tokensOf(s: Tokens): Tokens {
  return { access_token: s.access_token, refresh_token: s.refresh_token };
}

function projectRef(url?: string): string | null {
  try {
    return url ? new URL(url).hostname.split(".")[0] : null;
  } catch {
    return null;
  }
}

// Decode the `sub` (user id) from a JWT access token without verifying it —
// purely for diagnostics/comparison.
function decodeJwtSub(token?: string): string | null {
  if (!token) return null;
  try {
    let b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    b64 += "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(b64));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  // Tokens from the recovery session, used to re-attach if the in-memory
  // session is lost before updateUser.
  const recoveryRef = useRef<Tokens | null>(null);

  // Establish the recovery session. When a ?code= is present it is the
  // AUTHORITATIVE source — we exchange it (or read the result of the client's
  // auto-exchange) rather than trusting any pre-existing session, which could
  // be stale or from a different project. Exactly one explicit exchange; no
  // timeout; no reliance on PASSWORD_RECOVERY events.
  useEffect(() => {
    if (startedRef.current) return; // guards StrictMode double-invoke
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

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!active) return;
        if (!error && data.session) {
          recoveryRef.current = tokensOf(data.session);
          window.history.replaceState({}, "", "/reset-password");
          setStatus("ready");
          return;
        }
        if (error) {
          console.error("[reset-password] exchangeCodeForSession error:", error);
        }
        // The client may have auto-exchanged the code already; read that session.
        const { data: after } = await supabase.auth.getSession();
        if (!active) return;
        if (after.session) {
          recoveryRef.current = tokensOf(after.session);
          window.history.replaceState({}, "", "/reset-password");
          setStatus("ready");
          return;
        }
        setStatus("invalid");
        return;
      }

      // No code in the URL: only then fall back to an existing session
      // (e.g. the user refreshed after a successful exchange).
      const { data: existing } = await supabase.auth.getSession();
      if (!active) return;
      if (existing.session) {
        recoveryRef.current = tokensOf(existing.session);
        window.history.replaceState({}, "", "/reset-password");
        setStatus("ready");
        return;
      }
      setStatus("invalid");
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

    // Make sure a session is attached to THIS client; re-attach the recovery
    // tokens if the in-memory session was lost.
    const { data: sessionData } = await supabase.auth.getSession();
    let session = sessionData.session;
    if (!session?.access_token && recoveryRef.current) {
      const { data: setData, error: setErr } = await supabase.auth.setSession(
        recoveryRef.current
      );
      if (setErr) console.error("[reset-password] setSession error:", setErr);
      session = setData?.session ?? null;
    }
    if (!session?.access_token) {
      setError("Your recovery session has expired. Please request a new reset link.");
      setBusy(false);
      return;
    }

    // ---- Diagnostics: confirm we are not mixing projects / stale sessions ----
    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const ref = projectRef(projectUrl);
    console.log("[reset-password] project URL:", projectUrl, "| ref:", ref);

    // The @supabase/ssr browser client stores the session in COOKIES, not
    // localStorage. Any sb-*-auth-token in localStorage is a stale leftover; a
    // key for a different project ref indicates cross-project contamination.
    try {
      const lsKeys = Object.keys(window.localStorage).filter((k) =>
        /^sb-.*-auth-token/.test(k)
      );
      if (lsKeys.length) {
        console.warn(
          "[reset-password] stale supabase auth keys in localStorage (ssr client uses cookies):",
          lsKeys
        );
        const foreign = ref ? lsKeys.filter((k) => !k.includes(ref)) : lsKeys;
        if (foreign.length) {
          console.error(
            "[reset-password] localStorage keys from a DIFFERENT project (cross-project!):",
            foreign
          );
        }
      } else {
        console.log("[reset-password] no supabase auth keys in localStorage (good)");
      }
    } catch {
      /* localStorage may be unavailable; ignore */
    }

    const subFromJwt = decodeJwtSub(session.access_token);
    console.log("[reset-password] JWT sub (user id inside token):", subFromJwt);

    // getUser() validates the token against THIS project's Auth server.
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      console.error(
        "[reset-password] getUser error (token's user is not valid for this project):",
        userErr
      );
    }
    const authUserId = userData?.user?.id ?? null;
    console.log(
      "[reset-password] getUser id:",
      authUserId,
      "| email:",
      userData?.user?.email ?? null
    );
    console.log(
      "[reset-password] JWT sub === getUser id:",
      !!subFromJwt && subFromJwt === authUserId
    );

    if (userErr || !authUserId) {
      // The session's user does not exist in this project (stale/cross-project/
      // deleted). Clear the bad local session so a fresh link starts clean, and
      // do NOT attempt updateUser (which would 403 with "sub does not exist").
      await supabase.auth.signOut({ scope: "local" });
      setError(
        "This recovery session isn't valid for the current project (the account may have been removed, or the session is stale). Please request a new reset link."
      );
      setBusy(false);
      return;
    }
    // -------------------------------------------------------------------------

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      console.error("[reset-password] updateUser error:", error);
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

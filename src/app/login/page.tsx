"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Surface the "password reset" success message after a redirect from
  // /reset-password (read from the URL to avoid a Suspense boundary).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("reset") === "success") {
      setNotice("Your password has been reset. Sign in with your new password.");
      window.history.replaceState({}, "", "/login");
    }
  }, []);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          router.replace("/");
          router.refresh();
        } else {
          setMsg("Account created. Check your email to confirm, then sign in.");
          setMode("signin");
        }
      }
    } catch (e: any) {
      setMsg(e.message ?? "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className="mb-6 text-center">
        <div className="font-display text-4xl font-bold tracking-wide text-brass">
          FORGEKEEP
        </div>
        <p className="text-sm text-muted">Hobby inventory, in your pocket.</p>
      </div>
      <div className="card space-y-3 p-5">
        {notice ? (
          <div className="rounded-lg border border-jade/40 bg-jade/10 p-2.5 text-sm text-jade">
            {notice}
          </div>
        ) : null}
        {msg ? (
          <div className="rounded-lg border border-line bg-gun p-2.5 text-sm text-amber">
            {msg}
          </div>
        ) : null}
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-muted">Email</span>
          <input
            type="email"
            autoComplete="email"
            className="w-full rounded-lg border border-line bg-gun px-3 py-2.5 outline-none focus:border-jade"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-muted">Password</span>
          <input
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            className="w-full rounded-lg border border-line bg-gun px-3 py-2.5 outline-none focus:border-jade"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button
          onClick={submit}
          disabled={busy || !email || !password}
          className="w-full rounded-lg bg-jade px-4 py-3 font-semibold text-gun disabled:opacity-50"
        >
          {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        {mode === "signin" ? (
          <div className="text-center">
            <Link
              href="/forgot-password"
              className="text-sm text-muted underline-offset-2 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        ) : null}
        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setMsg(null);
          }}
          className="w-full text-center text-sm text-muted underline-offset-2 hover:underline"
        >
          {mode === "signin"
            ? "Need an account? Sign up"
            : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

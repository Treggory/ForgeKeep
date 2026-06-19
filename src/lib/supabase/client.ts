import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // PKCE is what the recovery link uses (?code=...).
        flowType: "pkce",
        // Do NOT auto-process tokens found in the URL. Otherwise the client
        // would auto-exchange the recovery `?code=` during init, consuming the
        // single-use code before our explicit exchange on /reset-password runs,
        // making every reset link look "invalid". We exchange it ourselves.
        detectSessionInUrl: false,
        autoRefreshToken: true,
        persistSession: true,
      },
    }
  );
}

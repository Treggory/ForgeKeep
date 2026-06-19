import { createBrowserClient } from "@supabase/ssr";

// Standard Supabase SSR browser client. We rely on its default PKCE handling
// (detectSessionInUrl) rather than overriding it — overriding caused recovery
// links to fail. The /reset-password page reconciles the auto-exchange with an
// explicit one and uses "a session now exists" as the success signal.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

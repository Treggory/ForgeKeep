import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

export default async function MorePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-4">
      <header>
        <div className="eyebrow">Account</div>
        <h1 className="font-display text-2xl font-semibold">More</h1>
      </header>

      <ul className="space-y-2">
        <li><Link href="/intake" className="card block p-4">▦ Scan In (intake)</Link></li>
        <li><Link href="/wishlist" className="card block p-4">★ Wishlist</Link></li>
        <li><Link href="/export" className="card block p-4">⤓ Export &amp; backup</Link></li>
        <li><Link href="/inventory" className="card block p-4">▤ Browse inventory</Link></li>
      </ul>

      <div className="card p-4 text-sm text-muted">
        Signed in as <span className="text-ink">{user?.email ?? "—"}</span>
      </div>
      <SignOutButton />
    </div>
  );
}

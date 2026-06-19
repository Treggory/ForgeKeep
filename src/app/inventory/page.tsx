import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ENTITY_LIST } from "@/lib/entities";

export default async function InventoryHub() {
  const supabase = await createClient();
  const counts = await Promise.all(
    ENTITY_LIST.map((e) =>
      supabase.from(e.table).select("id", { count: "exact", head: true })
    )
  );

  return (
    <div className="space-y-5">
      <header>
        <div className="eyebrow">Browse</div>
        <h1 className="font-display text-2xl font-semibold">Inventory</h1>
      </header>

      <Link
        href="/intake"
        className="card flex items-center gap-4 border-brass/40 bg-brass/10 p-4"
      >
        <span className="text-2xl">▦</span>
        <div className="flex-1">
          <div className="font-display text-lg text-brass">Scan In</div>
          <div className="text-xs text-muted">Add or top up stock by barcode</div>
        </div>
        <span className="text-muted">→</span>
      </Link>
      <ul className="space-y-3">
        {ENTITY_LIST.map((e, i) => (
          <li key={e.key}>
            <Link
              href={`/inventory/${e.key}`}
              className="card flex items-center gap-4 p-4"
            >
              <span className="text-2xl">{e.icon}</span>
              <span className="flex-1 font-display text-lg">{e.plural}</span>
              <span className="font-mono text-muted">{counts[i].count ?? 0}</span>
              <span className="text-muted">→</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-3">
        <Link href="/wishlist" className="card p-4 text-center font-display">
          ★ Wishlist
        </Link>
        <Link href="/export" className="card p-4 text-center font-display">
          ⤓ Export
        </Link>
      </div>
    </div>
  );
}

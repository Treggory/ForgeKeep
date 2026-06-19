"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import EmptyState from "@/components/EmptyState";

const REASONS = ["Want to Buy", "Need Replacement", "Future Project"];

export default function WishlistPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [reason, setReason] = useState(REASONS[0]);
  const [barcode, setBarcode] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("wishlist")
      .select("*")
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add() {
    setErr(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !name.trim()) return;
    const { error } = await supabase.from("wishlist").insert({
      owner_id: user.id,
      name: name.trim(),
      brand: brand.trim() || null,
      reason,
      item_type: "other",
      barcode: barcode.trim() || null,
    });
    if (error) return setErr(error.message);
    setName("");
    setBrand("");
    setBarcode("");
    load();
  }

  async function updateReason(id: string, r: string) {
    await supabase.from("wishlist").update({ reason: r }).eq("id", id);
    load();
  }
  async function toggle(id: string, fulfilled: boolean) {
    await supabase.from("wishlist").update({ fulfilled: !fulfilled }).eq("id", id);
    load();
  }
  async function remove(id: string) {
    await supabase.from("wishlist").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-4">
      <header>
        <div className="eyebrow">Shopping</div>
        <h1 className="font-display text-2xl font-semibold">Wishlist</h1>
      </header>

      <div className="card space-y-2 p-4">
        {err ? <div className="text-sm text-rust">{err}</div> : null}
        <input
          placeholder="Item name"
          className="w-full rounded-lg border border-line bg-gun px-3 py-2.5 outline-none focus:border-jade"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-2">
          <input
            placeholder="Brand (optional)"
            className="flex-1 rounded-lg border border-line bg-gun px-3 py-2.5 outline-none focus:border-jade"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          />
          <select
            className="rounded-lg border border-line bg-gun px-3 py-2.5 outline-none focus:border-jade"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <input
          placeholder="Barcode / UPC (optional)"
          inputMode="numeric"
          className="w-full rounded-lg border border-line bg-gun px-3 py-2.5 outline-none focus:border-jade"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
        />
        <button
          onClick={add}
          disabled={!name.trim()}
          className="w-full rounded-lg bg-jade px-4 py-2.5 font-semibold text-gun disabled:opacity-50"
        >
          + Add to wishlist
        </button>
      </div>

      {loading ? (
        <div className="card h-24 animate-pulse" />
      ) : items.length === 0 ? (
        <EmptyState title="Wishlist is empty" body="Add things you want to buy or need to replace." />
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className={`card flex items-center gap-3 p-3 ${it.fulfilled ? "opacity-50" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <div className={`truncate font-medium ${it.fulfilled ? "line-through" : ""}`}>
                  {it.name}
                </div>
                {it.brand ? <div className="text-xs text-muted">{it.brand}</div> : null}
                <select
                  className="mt-1 rounded border border-line bg-gun px-2 py-1 text-xs text-muted"
                  value={it.reason}
                  onChange={(e) => updateReason(it.id, e.target.value)}
                >
                  {REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => toggle(it.id, it.fulfilled)}
                className="rounded-lg border border-line px-2 py-1 text-xs"
                title="Mark bought"
              >
                {it.fulfilled ? "↺" : "✓"}
              </button>
              <button
                onClick={() => remove(it.id)}
                className="rounded-lg border border-rust/50 px-2 py-1 text-xs text-rust"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

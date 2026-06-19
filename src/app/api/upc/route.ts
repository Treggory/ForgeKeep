import { NextRequest, NextResponse } from "next/server";

// Server-side UPC/EAN lookup proxy.
// - Runs on the server so any API key (UPC_API_KEY) stays out of the client.
// - The outbound URL is built here from env/defaults; the client only supplies
//   a sanitized numeric barcode, so it cannot point the request at another host.
// - Provider is configurable via env; defaults to the UPCitemdb trial endpoint
//   (no key, rate-limited). Any failure returns { found: false } so the UI
//   falls back to manual quick-add.
//
// Query parameter: `barcode` (preferred). `code` is also accepted as a fallback
// so older callers keep working. Accepts 6–14 digit codes, which covers
// UPC-E (6–8), UPC-A (12) and EAN-13 (13). Raw digits are passed through to the
// provider (no UPC-E -> UPC-A expansion).
//
// NOTE: the console.* lines below are TEMPORARY debug logging. They print to the
// server terminal (the process running `next dev`/`next start`), never to the
// browser. Remove them once the lookup is confirmed working.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PROVIDER = "https://api.upcitemdb.com/prod/trial/lookup?upc=";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const barcode = (sp.get("barcode") ?? sp.get("code") ?? "").trim();

  if (!/^\d{6,14}$/.test(barcode)) {
    console.warn("[upc] validation: rejected barcode", JSON.stringify(barcode));
    return NextResponse.json(
      { found: false, error: "invalid barcode" },
      { status: 400 }
    );
  }

  const base = process.env.UPC_PROVIDER_URL || DEFAULT_PROVIDER;
  const url = base + encodeURIComponent(barcode);

  let res: Response;
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (process.env.UPC_API_KEY) headers["Authorization"] = `Bearer ${process.env.UPC_API_KEY}`;
    res = await fetch(url, { headers, cache: "no-store" });
  } catch (e) {
    console.error("[upc] provider request failed (network/exception):", url, e);
    return NextResponse.json({ found: false });
  }

  if (!res.ok) {
    console.warn("[upc] provider HTTP error:", res.status, url);
    return NextResponse.json({ found: false });
  }

  let data: any;
  try {
    data = await res.json();
  } catch (e) {
    console.warn("[upc] provider returned malformed JSON for", barcode, e);
    return NextResponse.json({ found: false });
  }

  // Normalize common shapes (UPCitemdb: {items:[...]}, others: {product:{...}}).
  const item = Array.isArray(data?.items) ? data.items[0] : data?.product ?? data;
  const name = item?.title || item?.product_name || item?.name || null;
  const brand = item?.brand || item?.brand_name || null;
  const category = item?.category || null;

  if (!name && !brand) {
    console.info("[upc] provider returned no usable product for", barcode);
    return NextResponse.json({ found: false });
  }

  const source = process.env.UPC_PROVIDER_NAME || "upcitemdb";
  console.info("[upc] found product for", barcode, "->", JSON.stringify({ name, brand, source }));
  return NextResponse.json({ found: true, name, brand, category, source });
}

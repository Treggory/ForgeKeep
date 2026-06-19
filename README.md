# ForgeKeep

A mobile-first hobby inventory for Warhammer (and other miniature) collections:
miniatures, paints, brushes, tools, and terrain — with an in-store duplicate
checker ("Store Mode") that supports text search **and barcode scanning**,
miniature consolidation, project progress tracking, a wishlist, dashboards, and
Excel/CSV export. Built on **Next.js + TypeScript + TailwindCSS** and
**Supabase (Postgres + RLS + Storage)**.

> ForgeKeep is the application name. It tracks Warhammer hobby data (e.g. the
> default "Warhammer 40,000" game system), but the app itself is game-agnostic.

---

## What's in here

```
warhammer-inventory/
├── supabase/migrations/        # apply in order in the Supabase SQL editor
│   ├── 0001_schema.sql         # tables, indexes, triggers
│   ├── 0002_rls.sql            # row-level security (owner-only)
│   ├── 0003_views_functions.sql# dashboards + search_inventory() RPC
│   ├── 0004_storage.sql        # photos storage bucket + policies
│   ├── 0005_seed_lookups.sql   # global dropdown vocab (from your Lookups sheet)
│   ├── 0006_seed_inventory.generated.sql  # YOUR data — run AFTER first sign-up
│   └── 0007_barcodes_and_unit_groups.sql  # barcodes + miniature consolidation
├── scripts/
│   ├── import_excel.py         # (re)generate the seed from a workbook export
│   └── requirements.txt
├── src/                        # the Next.js app (App Router)
├── public/                     # PWA manifest, service worker, icons
├── BACKUP.md                   # backup & restore guide
├── README.md
└── .env.local.example
```

---

## 1. Create the Supabase project
1. https://supabase.com -> **New project**, pick the closest region, save the DB password.
2. **Project Settings -> API**: copy the **Project URL** and **anon public** key.

## 2. Apply the database (order matters)
In **SQL Editor**, run each file in order: `0001` -> `0002` -> `0003` -> `0004`
-> `0005`. Then **create your account** (start the app and sign up, or
Authentication -> Users -> Add user), then run `0006_seed_inventory.generated.sql`
(binds the imported rows to the first auth user; it raises a clear error if no
user exists yet). Finally run `0007_barcodes_and_unit_groups.sql`, which adds
barcode fields and consolidates your miniatures into canonical unit groups.

## 3. Configure & run the app
```bash
cd warhammer-inventory
cp .env.local.example .env.local      # paste your URL + anon key
npm install
npm run dev                           # http://localhost:3000
```
Sign in with the account you created. Your dashboard should show ~454 models,
67 paints, 32 brushes, 19 tools, 1 terrain set, and 2 seeded projects.

## 4. Verify the build
```bash
npx tsc --noEmit
npm run build
```

---

## Store Mode (the in-store feature)
Search by name, or tap the scan button to read a barcode with the device camera
(uses the native BarcodeDetector when available — e.g. Android Chrome — and
falls back to manual entry elsewhere, e.g. iOS Safari). Either way you get a
verdict: Already Owned (with quantity) or Not in your collection.

## Scan In (inventory intake)
A separate intake mode (Inventory -> Scan In, or More -> Scan In) for *adding*
stock. Scan or type a barcode: if it already exists you can increment the
quantity, append a note, or jump to the item; if it's new, a quick-add form
(Paint / Miniature / Tool / Terrain / Wishlist) opens with the barcode
pre-filled. A session "Recently added" list tracks what you logged. This is
kept separate from Store Mode and the search RPC.

**Product lookup chain.** When a barcode is scanned, intake resolves it in
order: (1) your own inventory; (2) a shared `product_catalog` table; (3) an
external UPC lookup. A catalog or external hit prefills the quick-add form. An
external hit can also be saved back to `product_catalog` — only after you tick
the confirmation box and add the item. External results are never added to your
inventory automatically; you always complete the quick-add form yourself. If
nothing matches, you fall back to manual quick-add. The external call goes
through a server route (`/api/upc`) so any API key stays server-side; it is
configurable via `UPC_PROVIDER_URL` / `UPC_PROVIDER_NAME` / `UPC_API_KEY` and
defaults to the UPCitemdb trial endpoint (no key, rate-limited). Any lookup
failure falls back to manual entry. `product_catalog` is global/shared and is
kept entirely separate from your owned inventory. All catalog writes go through a
SECURITY DEFINER RPC (`upsert_catalog_product`, migration 0009): users can add
new products and refine *unverified* ones, but cannot overwrite an entry once an
operator marks it `verified`. Each row records `created_by`; verification
(`verified`, `verified_by`, `verified_at`) is set by an operator via the
service role / SQL editor.

## Miniature consolidation
Duplicate unit entries (e.g. two "Rubric Marines" rows) are grouped under one
canonical unit showing the combined quantity, while the original entries are
preserved as expandable child rows with their individual paint/assembly/loadout
status and barcodes. No history is deleted.

## Export, barcode round-trip & re-import
The Export page produces a full Excel workbook plus per-sheet CSVs:
- Inventory sheets (Miniatures, Paints, Brushes, Tools, Terrain) match the
  original workbook layout, so they **re-import cleanly**.
- A **Barcode** column is included for Miniatures, Paints, Tools, and Terrain.
- A **Wishlist** sheet/CSV is included (Item Type, Name, Brand, Reason, Notes,
  Estimated Price, Barcode, Fulfilled, Created At). Wishlist is **export-only**;
  it is not read back on import.

Default filenames: `ForgeKeep_Inventory_<date>.xlsx` and
`ForgeKeep_<Sheet>_<date>.csv`.

Re-import a workbook with the importer:
```bash
python3 scripts/import_excel.py path/to/export.xlsx -o supabase/migrations/0006_seed_inventory.generated.sql
```
Rows UPSERT by a stable `import_key`, so re-running updates existing rows rather
than duplicating. The importer reads a `Barcode` column when present and is
backward compatible: older workbooks without one still import (barcodes become
null), and empty barcode cells import as null. A regenerated seed self-adds the
barcode columns (`ADD COLUMN IF NOT EXISTS`), so it applies whether or not
migration 0007 has run yet.

---

## Deployment (Vercel + Supabase)
1. Push this folder to a Git repo.
2. https://vercel.com -> **New Project** -> import the repo.
3. Add env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy. Supabase is already hosted; no separate backend deploy needed.
5. In Supabase **Authentication -> URL Configuration**, add your Vercel domain.

Installable as a PWA ("ForgeKeep"): open the deployed site on your phone and
"Add to Home Screen". The service worker caches the app shell (inventory data
still needs a connection).

## Backup
See **BACKUP.md**.

## Security model
Every table has Row Level Security; a user can only read/write rows where
`owner_id = auth.uid()`. Single-user today, but because all access is keyed on
`owner_id`, enabling multi-user later needs no schema change.

## Scope
Built: auth, mobile nav, dashboards, Store Mode (text + camera/manual barcode
scanning), Scan In intake mode (barcode-driven add / increment / note, with a product
lookup chain: inventory -> shared catalog -> external UPC API, confirmation
required before catalog save), full
CRUD for all five categories (with barcode fields), miniature consolidation
(canonical unit groups with expandable child entries), wishlist, projects,
Excel/CSV export (including a Wishlist sheet) with barcode round-trip,
loading/error/empty states.

Not built yet (schema is ready): QR labels, paint-depletion tracking, multi-user
UI, advanced photo gallery, insurance reports.

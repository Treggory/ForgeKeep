# ForgeKeep — Backup & Restore

ForgeKeep stores everything in your Supabase Postgres database plus the
`inventory-photos` storage bucket. Three layers of backup are recommended.

## 1. In-app export (quick, portable)
Open the **Export** page and download the **Full Excel workbook**
(`ForgeKeep_Inventory_<date>.xlsx`). It contains:
- Miniatures, Paints, Brushes, Tools, Terrain — matching the original workbook
  layout, including a **Barcode** column for Miniatures, Paints, Tools, Terrain.
- A **Wishlist** sheet (Item Type, Name, Brand, Reason, Notes, Estimated Price,
  Barcode, Fulfilled, Created At) — export-only.

Per-sheet CSVs (`ForgeKeep_<Sheet>_<date>.csv`) are also available. Do this
regularly and keep copies in separate cloud storage.

Restore from an Excel export: regenerate the seed and run it (see README ->
"Export, barcode round-trip & re-import"). Note the inventory sheets re-import;
the Wishlist sheet does not.

## 2. Database backup (complete)
- Supabase takes **automatic daily backups** on paid plans
  (Dashboard -> Database -> Backups).
- Manual logical dump with the Supabase CLI:
  ```bash
  supabase db dump -f forgekeep-backup.sql
  ```
  or with `pg_dump` using the connection string from
  Project Settings -> Database:
  ```bash
  pg_dump "$DATABASE_URL" > forgekeep-backup.sql
  ```
  This captures everything (including barcodes and wishlist) regardless of what
  the Excel export covers.

## 3. Photos
Download the `inventory-photos` bucket from the Supabase Storage dashboard, or
sync it via the Storage API. Files live under a per-user folder
(`<user-id>/...`), matching the row-level security boundary.

## Suggested cadence
- Excel export: weekly, or after any large update.
- Database dump: before running new migrations or bulk imports.
- Photos: whenever you add a batch of new images.

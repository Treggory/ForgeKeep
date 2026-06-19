-- =============================================================================
-- Migration 0008: Global product_catalog (barcode -> product reference)
-- =============================================================================
-- This is a SHARED reference table (not user-scoped). It maps a barcode to a
-- known product so future scans can prefill the quick-add form. It is kept
-- completely separate from the user's inventory tables — entries here are NOT
-- owned items, just product metadata. Populating inventory from a catalog hit
-- always goes through the quick-add form (explicit user action).
-- =============================================================================

create table if not exists product_catalog (
  id         uuid primary key default gen_random_uuid(),
  barcode    text not null unique,
  name       text,
  brand      text,
  category   text,
  source     text,                       -- 'catalog' | external provider name | 'manual'
  verified   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists product_catalog_barcode_idx on product_catalog(barcode);

alter table product_catalog enable row level security;

-- Shared catalog: any authenticated user may read it, and may contribute /
-- correct entries. Rows are not owned, so there is no owner_id check. (For a
-- stricter multi-user policy later, contributions could be gated to verified
-- editors; the column set already supports a `verified` flag.)
drop policy if exists product_catalog_read   on product_catalog;
drop policy if exists product_catalog_insert on product_catalog;
drop policy if exists product_catalog_update on product_catalog;

create policy product_catalog_read on product_catalog
  for select to authenticated using (true);
create policy product_catalog_insert on product_catalog
  for insert to authenticated with check (true);
create policy product_catalog_update on product_catalog
  for update to authenticated using (true) with check (true);

-- reuse touch_updated_at() from migration 0001
drop trigger if exists trg_touch_product_catalog on product_catalog;
create trigger trg_touch_product_catalog
  before update on product_catalog
  for each row execute function touch_updated_at();

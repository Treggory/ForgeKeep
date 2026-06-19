-- =============================================================================
-- Migration 0009: Harden the shared product_catalog
-- =============================================================================
-- The catalog is a single shared table. Previously any authenticated user could
-- INSERT or UPDATE any row (0008 used `with check (true)` / `using (true)`),
-- which let one beta user silently overwrite — or un-verify — another's entry,
-- with no record of who did it. This migration:
--   1. adds provenance + verification metadata,
--   2. removes the blanket write policies (reads stay open),
--   3. funnels every write through one SECURITY DEFINER RPC that protects
--      verified rows and stamps the contributor.
-- Idempotent and additive; safe to run on top of 0001–0008.
-- =============================================================================

-- 1) Provenance + verification metadata -------------------------------------
--    created_at / updated_at already exist (0008). These add: who created the
--    row, and who verified it + when. created_by is NULL for any rows added
--    before this migration (provenance simply unknown for legacy data).
alter table product_catalog add column if not exists created_by  uuid references auth.users(id) on delete set null;
alter table product_catalog add column if not exists verified_by uuid references auth.users(id) on delete set null;
alter table product_catalog add column if not exists verified_at timestamptz;

-- 2) Remove direct write access ---------------------------------------------
--    Reads remain open to authenticated users (product_catalog_read from 0008
--    stays in place). With these two policies gone and no replacement, the
--    `authenticated` role can no longer INSERT/UPDATE the table directly — the
--    only write path is the SECURITY DEFINER function below.
drop policy if exists product_catalog_insert on product_catalog;
drop policy if exists product_catalog_update on product_catalog;

-- 3) The one controlled write path ------------------------------------------
--    SECURITY DEFINER => runs as the function owner (postgres), so it bypasses
--    RLS and is the sole way ordinary users mutate the catalog. It:
--      * requires an authenticated caller,
--      * inserts a new row (stamped with created_by) when the barcode is new,
--      * refuses to modify a row once verified = true,
--      * for an unverified row, only fills/refreshes fields (coalesce keeps
--        existing values rather than letting blank input wipe good data).
--    search_path is pinned to avoid search-path hijacking of a definer fn.
create or replace function upsert_catalog_product(
  p_barcode  text,
  p_name     text,
  p_brand    text,
  p_category text,
  p_source   text
)
returns product_catalog
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_code   text := nullif(btrim(p_barcode), '');
  existing product_catalog;
  result   product_catalog;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if v_code is null or length(v_code) > 64 then
    raise exception 'Invalid barcode';
  end if;

  select * into existing from product_catalog where barcode = v_code;

  if not found then
    insert into product_catalog (barcode, name, brand, category, source, verified, created_by)
    values (
      v_code,
      nullif(btrim(p_name), ''),
      nullif(btrim(p_brand), ''),
      nullif(btrim(p_category), ''),
      nullif(btrim(p_source), ''),
      false,
      v_uid
    )
    returning * into result;
    return result;
  end if;

  -- Verified entries are immutable to ordinary contributors.
  if existing.verified then
    return existing;
  end if;

  update product_catalog
     set name       = coalesce(nullif(btrim(p_name), ''),     name),
         brand      = coalesce(nullif(btrim(p_brand), ''),    brand),
         category   = coalesce(nullif(btrim(p_category), ''), category),
         source     = coalesce(nullif(btrim(p_source), ''),   source),
         updated_at = now()
   where id = existing.id
   returning * into result;
  return result;
end;
$$;

-- Callable only by signed-in users; never anon/public.
revoke all on function upsert_catalog_product(text, text, text, text, text) from public;
revoke all on function upsert_catalog_product(text, text, text, text, text) from anon;
grant execute on function upsert_catalog_product(text, text, text, text, text) to authenticated;

-- 4) Verification (operator action) -----------------------------------------
--    There is no end-user "verify" button by design. An operator marks an entry
--    trustworthy using the service_role / SQL editor, which bypasses RLS, e.g.:
--      update product_catalog
--         set verified = true, verified_by = '<admin-uuid>', verified_at = now()
--       where barcode = '...';
--    Once verified, the RPC above will refuse user overwrites.

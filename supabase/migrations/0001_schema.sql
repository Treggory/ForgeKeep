-- =============================================================================
-- ForgeKeep — Hobby Inventory — Core Schema
-- Migration 0001: extensions, reference data, core tables
-- =============================================================================
-- Design notes
--  * Every inventory row carries owner_id -> auth.users(id). The app is
--    single-user today, but RLS (0002) keys off auth.uid() = owner_id, so
--    flipping on multi-user later requires no schema change.
--  * Controlled vocabularies (statuses, conditions, paint types) live in a
--    single `lookups` table instead of hard Postgres ENUMs. Hobby vocab grows
--    over time; a row insert is cheaper than an ALTER TYPE migration. Status
--    columns are TEXT (no hard FK) so an unexpected value never blocks an
--    import — the UI populates dropdowns from `lookups`.
--  * `import_key` (unique per owner) lets the Excel importer UPSERT, so future
--    workbook exports re-import cleanly instead of duplicating rows.
--  * Future features (multiple armies, game systems, QR/barcode, paint
--    depletion) have their columns/tables stubbed now so adding them later is
--    data entry, not migration archaeology.
-- =============================================================================

create extension if not exists "pgcrypto";       -- gen_random_uuid()
create extension if not exists "pg_trgm";         -- fast ILIKE / fuzzy search

-- -----------------------------------------------------------------------------
-- Profiles (mirror of auth.users; future-proofs multi-user)
-- -----------------------------------------------------------------------------
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at  timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- -----------------------------------------------------------------------------
-- Lookups (controlled vocabularies; mirrors the workbook "Lookups" sheet)
--   owner_id NULL  = global default, visible to everyone
--   owner_id SET   = a value this user added
-- -----------------------------------------------------------------------------
create table if not exists lookups (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid references auth.users(id) on delete cascade,
  category   text not null,         -- 'paint_status','assembly_status','condition','priority','yes_no_unknown','paint_type','wishlist_reason'
  value      text not null,
  sort_order int  not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (owner_id, category, value)
);
create index if not exists lookups_category_idx on lookups(category);
-- NULLs are "distinct" in a normal UNIQUE, so guard global defaults separately:
create unique index if not exists lookups_global_uni
  on lookups(category, value) where owner_id is null;

-- -----------------------------------------------------------------------------
-- Game systems & factions  (multi-army / multi-game future-proofing)
-- -----------------------------------------------------------------------------
create table if not exists game_systems (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  slug       text,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table if not exists factions (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references auth.users(id) on delete cascade,
  game_system_id    uuid references game_systems(id) on delete set null,
  name              text not null,
  parent_faction_id uuid references factions(id) on delete set null,  -- subfaction support
  created_at        timestamptz not null default now(),
  unique (owner_id, name)
);

-- -----------------------------------------------------------------------------
-- Storage locations (multiple, hierarchical, QR/barcode ready)
-- -----------------------------------------------------------------------------
create table if not exists storage_locations (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  parent_id   uuid references storage_locations(id) on delete set null,
  qr_code     text,        -- future: QR label payload
  barcode     text,        -- future: scanned bin barcode
  created_at  timestamptz not null default now(),
  unique (owner_id, name)
);

-- -----------------------------------------------------------------------------
-- Projects (e.g. "Thousand Sons Combat Patrol")
-- -----------------------------------------------------------------------------
create table if not exists projects (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  description    text,
  game_system_id uuid references game_systems(id) on delete set null,
  faction_id     uuid references factions(id) on delete set null,
  priority       text,
  status         text not null default 'Active',  -- Active | On Hold | Completed | Archived
  target_date    date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Miniature units  (one row per unit/entry, matches the workbook)
--   Aggregate stage counts feed dashboards & project progress bars.
-- -----------------------------------------------------------------------------
create table if not exists miniature_units (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users(id) on delete cascade,
  game_system_id      uuid references game_systems(id) on delete set null,
  faction_id          uuid references factions(id) on delete set null,
  subfaction          text,
  project_id          uuid references projects(id) on delete set null,
  storage_location_id uuid references storage_locations(id) on delete set null,

  unit_name        text not null,
  quantity         int  not null default 1 check (quantity >= 0),
  material         text,

  paint_status     text,   -- imported free/controlled text e.g. "Painted (32) / Unpainted (3)"
  assembly_status  text,
  basing_status    text,
  repairs_needed   text,
  tabletop_ready   text,   -- yes_no_unknown
  priority         text,
  notes            text,
  estimated_value  numeric(12,2) not null default 0,

  -- structured progress (drives dashboards + project bars; editable in app)
  qty_assembled    int not null default 0 check (qty_assembled  >= 0),
  qty_primed       int not null default 0 check (qty_primed     >= 0),
  qty_basecoated   int not null default 0 check (qty_basecoated >= 0),
  qty_painted      int not null default 0 check (qty_painted    >= 0),
  qty_based        int not null default 0 check (qty_based       >= 0),
  qty_completed    int not null default 0 check (qty_completed   >= 0),

  import_key       text,   -- stable hash for idempotent re-import
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (owner_id, import_key)
);
create index if not exists miniature_units_owner_idx   on miniature_units(owner_id);
create index if not exists miniature_units_faction_idx on miniature_units(faction_id);
create index if not exists miniature_units_project_idx on miniature_units(project_id);
create index if not exists miniature_units_name_trgm   on miniature_units using gin (unit_name gin_trgm_ops);

-- Optional per-model granularity (photos / status on a single mini)
create table if not exists miniature_models (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  unit_id    uuid not null references miniature_units(id) on delete cascade,
  label      text,
  stage      text,   -- assembled | primed | basecoated | painted | based | completed
  notes      text,
  created_at timestamptz not null default now()
);
create index if not exists miniature_models_unit_idx on miniature_models(unit_id);

-- -----------------------------------------------------------------------------
-- Paints
-- -----------------------------------------------------------------------------
create table if not exists paints (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users(id) on delete cascade,
  storage_location_id uuid references storage_locations(id) on delete set null,

  category          text,           -- Paint | Medium
  brand             text not null,
  line              text,
  color_name        text not null,
  quantity          int  not null default 1 check (quantity >= 0),
  paint_type        text,           -- Acrylic, Metallic, Contrast, Wash, Shade, Texture, Primer, Varnish, Colorshift, Airbrush Acrylic, Medium, Putty
  condition         text,
  opened            text,           -- yes_no_unknown
  needs_replacement text not null default 'No',  -- yes_no_unknown; drives wishlist auto-flag
  notes             text,

  -- future: paint depletion tracking (columns present, unused for now)
  fill_level_pct    int check (fill_level_pct between 0 and 100),
  low_threshold_pct int default 20,
  last_used_at      timestamptz,

  import_key        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (owner_id, import_key)
);
create index if not exists paints_owner_idx on paints(owner_id);
create index if not exists paints_brand_idx on paints(brand);
create index if not exists paints_type_idx  on paints(paint_type);
create index if not exists paints_color_trgm on paints using gin (color_name gin_trgm_ops);
create index if not exists paints_brand_trgm on paints using gin (brand gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- Brushes
-- -----------------------------------------------------------------------------
create table if not exists brushes (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  manufacturer text not null,
  series       text,          -- "Series / Type"
  size         text,
  brush_type   text,          -- optional explicit type
  material     text,          -- "Hair / Material"
  quantity     int not null default 1 check (quantity >= 0),
  condition    text,
  purpose      text,          -- "Primary Use"
  notes        text,
  import_key   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (owner_id, import_key)
);
create index if not exists brushes_owner_idx on brushes(owner_id);
create index if not exists brushes_mfr_trgm  on brushes using gin (manufacturer gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- Tools / Equipment
-- -----------------------------------------------------------------------------
create table if not exists tools (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users(id) on delete cascade,
  storage_location_id uuid references storage_locations(id) on delete set null,
  category   text,
  item       text not null,
  quantity   int not null default 1 check (quantity >= 0),
  condition  text,
  notes      text,
  import_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, import_key)
);
create index if not exists tools_owner_idx on tools(owner_id);
create index if not exists tools_item_trgm on tools using gin (item gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- Terrain
-- -----------------------------------------------------------------------------
create table if not exists terrain (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users(id) on delete cascade,
  storage_location_id uuid references storage_locations(id) on delete set null,
  terrain_set    text not null,
  components     text,
  quantity       int,            -- nullable; workbook had "Multiple"
  quantity_label text,           -- preserves non-numeric quantities like "Multiple"
  paint_status   text,
  repairs_needed text,
  notes          text,
  import_key     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (owner_id, import_key)
);
create index if not exists terrain_owner_idx on terrain(owner_id);

-- -----------------------------------------------------------------------------
-- Wishlist
-- -----------------------------------------------------------------------------
create table if not exists wishlist (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  item_type       text,           -- paint | miniature | tool | brush | terrain | other
  name            text not null,
  brand           text,
  reason          text not null default 'Want to Buy',  -- Want to Buy | Need Replacement | Future Project
  notes           text,
  estimated_price numeric(12,2),
  related_paint_id uuid references paints(id) on delete set null,
  fulfilled       boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists wishlist_owner_idx on wishlist(owner_id);

-- -----------------------------------------------------------------------------
-- Photos (polymorphic; files live in the Supabase Storage bucket)
-- -----------------------------------------------------------------------------
create table if not exists photos (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  entity_type  text not null,     -- unit | model | paint | brush | tool | terrain
  entity_id    uuid not null,
  storage_path text not null,     -- path within the 'inventory-photos' bucket
  caption      text,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists photos_entity_idx on photos(entity_type, entity_id);
create index if not exists photos_owner_idx  on photos(owner_id);

-- -----------------------------------------------------------------------------
-- updated_at touch trigger
-- -----------------------------------------------------------------------------
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

do $$
declare t text;
begin
  foreach t in array array[
    'projects','miniature_units','paints','brushes','tools','terrain'
  ] loop
    execute format(
      'drop trigger if exists trg_touch_%1$s on %1$s;
       create trigger trg_touch_%1$s before update on %1$s
       for each row execute function touch_updated_at();', t);
  end loop;
end $$;

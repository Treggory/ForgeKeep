-- =============================================================================
-- Migration 0002: Row Level Security
-- =============================================================================
-- Every table is locked down. The owner (auth.uid() = owner_id) can do
-- everything with their own rows and nothing with anyone else's. This is the
-- single-user posture today AND the multi-user posture tomorrow — no rewrite.
--
-- `lookups` is the one exception: global defaults (owner_id IS NULL) are
-- readable by every authenticated user so dropdowns work out of the box, while
-- each user can still add/edit/remove their own custom values.
-- =============================================================================

alter table profiles          enable row level security;
alter table lookups           enable row level security;
alter table game_systems      enable row level security;
alter table factions          enable row level security;
alter table storage_locations enable row level security;
alter table projects          enable row level security;
alter table miniature_units   enable row level security;
alter table miniature_models  enable row level security;
alter table paints            enable row level security;
alter table brushes           enable row level security;
alter table tools             enable row level security;
alter table terrain           enable row level security;
alter table wishlist          enable row level security;
alter table photos            enable row level security;

-- Profiles: a user sees and edits only their own profile row.
create policy profiles_self on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Generic owner-only policy applied to every owner_id table.
do $$
declare t text;
begin
  foreach t in array array[
    'game_systems','factions','storage_locations','projects',
    'miniature_units','miniature_models','paints','brushes',
    'tools','terrain','wishlist','photos'
  ] loop
    execute format('drop policy if exists %1$s_owner on %1$s;', t);
    execute format(
      'create policy %1$s_owner on %1$s
         for all
         using (auth.uid() = owner_id)
         with check (auth.uid() = owner_id);', t);
  end loop;
end $$;

-- Lookups: read global defaults + your own; write only your own.
drop policy if exists lookups_read  on lookups;
drop policy if exists lookups_write on lookups;
create policy lookups_read on lookups
  for select
  using (owner_id is null or auth.uid() = owner_id);
create policy lookups_write on lookups
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- =============================================================================
-- Migration 0007: Barcodes + Miniature consolidation (unit groups)
-- Additive & idempotent — safe to run on top of 0001–0006.
-- =============================================================================

-- ---------- 1. Barcode / UPC fields -----------------------------------------
alter table paints          add column if not exists barcode text;
alter table tools           add column if not exists barcode text;
alter table miniature_units add column if not exists barcode text;
alter table terrain         add column if not exists barcode text;
alter table wishlist        add column if not exists barcode text;

create index if not exists paints_barcode_idx  on paints(owner_id, barcode)          where barcode is not null;
create index if not exists tools_barcode_idx   on tools(owner_id, barcode)           where barcode is not null;
create index if not exists minis_barcode_idx   on miniature_units(owner_id, barcode) where barcode is not null;
create index if not exists terrain_barcode_idx on terrain(owner_id, barcode)         where barcode is not null;

-- ---------- 2. Unit groups (canonical, consolidated units) -------------------
create table if not exists unit_groups (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  game_system_id uuid references game_systems(id) on delete set null,
  faction_id     uuid references factions(id) on delete set null,
  name           text not null,
  notes          text,
  created_at     timestamptz not null default now()
);
-- faction_id can be NULL, and NULLs are "distinct" in a plain UNIQUE, so use a
-- coalesced expression index to enforce one group per (owner, faction, name).
create unique index if not exists unit_groups_uni
  on unit_groups (owner_id, name,
                  coalesce(faction_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Children keep ALL their history; we only add a pointer to the canonical group.
alter table miniature_units add column if not exists group_id uuid references unit_groups(id) on delete set null;
create index if not exists miniature_units_group_idx on miniature_units(group_id);

-- RLS
alter table unit_groups enable row level security;
drop policy if exists unit_groups_owner on unit_groups;
create policy unit_groups_owner on unit_groups
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------- 3. Auto-assign group on insert (keeps new units consolidated) ----
create or replace function assign_unit_group()
returns trigger language plpgsql as $$
declare gid uuid;
declare sentinel uuid := '00000000-0000-0000-0000-000000000000';
begin
  if new.group_id is null and new.unit_name is not null then
    select id into gid from unit_groups
      where owner_id = new.owner_id
        and name = new.unit_name
        and coalesce(faction_id, sentinel) = coalesce(new.faction_id, sentinel)
      limit 1;
    if gid is null then
      insert into unit_groups(owner_id, game_system_id, faction_id, name)
      values (new.owner_id, new.game_system_id, new.faction_id, new.unit_name)
      returning id into gid;
    end if;
    new.group_id := gid;
  end if;
  return new;
end $$;

drop trigger if exists trg_assign_unit_group on miniature_units;
create trigger trg_assign_unit_group
  before insert on miniature_units
  for each row execute function assign_unit_group();

-- ---------- 4. Safe data migration: group existing exact matches -------------
-- Creates one group per distinct (owner, faction, unit_name) and points the
-- existing rows at it. No rows are deleted or merged; only group_id is set.
do $$
declare rec record;
declare gid uuid;
declare sentinel uuid := '00000000-0000-0000-0000-000000000000';
begin
  for rec in
    select owner_id, faction_id, unit_name, max(game_system_id) as gsid
    from miniature_units
    where unit_name is not null
    group by owner_id, faction_id, unit_name
  loop
    select id into gid from unit_groups
      where owner_id = rec.owner_id
        and name = rec.unit_name
        and coalesce(faction_id, sentinel) = coalesce(rec.faction_id, sentinel)
      limit 1;
    if gid is null then
      insert into unit_groups(owner_id, game_system_id, faction_id, name)
      values (rec.owner_id, rec.gsid, rec.faction_id, rec.unit_name)
      returning id into gid;
    end if;
    update miniature_units
      set group_id = gid
      where owner_id = rec.owner_id
        and unit_name = rec.unit_name
        and coalesce(faction_id, sentinel) = coalesce(rec.faction_id, sentinel)
        and group_id is null;
  end loop;
end $$;

-- ---------- 5. Consolidated view --------------------------------------------
create or replace view v_unit_groups as
select
  g.id as group_id, g.owner_id, g.name,
  f.name as faction,
  count(m.id)                        as child_count,
  coalesce(sum(m.quantity), 0)       as total_quantity,
  coalesce(sum(m.qty_painted), 0)    as total_painted,
  coalesce(sum(m.qty_completed), 0)  as total_completed,
  coalesce(sum(m.estimated_value),0) as total_value
from unit_groups g
left join miniature_units m on m.group_id = g.id
left join factions f on f.id = g.faction_id
group by g.id, g.owner_id, g.name, f.name;

-- ---------- 6. Search: consolidate minis + match barcodes (text path) -------
-- Existing name/ILIKE behaviour preserved; barcode matching is ADDITIVE (OR).
create or replace function search_inventory(q text)
returns table (
  item_type text, id uuid, title text, subtitle text,
  owned_qty int, already_owned boolean, needs_replacement boolean, rank real
)
language sql stable
as $$
  with needle as (select '%' || coalesce(q,'') || '%' as pat, coalesce(q,'') as raw)
  -- Paints
  select 'paint', p.id, p.brand || ' ' || p.color_name,
         coalesce(p.line,'') || case when p.paint_type is not null then ' · '||p.paint_type else '' end,
         p.quantity, true, p.needs_replacement in ('Yes','Partial'),
         greatest(similarity(p.brand||' '||p.color_name, n.raw), similarity(p.color_name, n.raw))
  from paints p, needle n
  where (p.brand||' '||coalesce(p.line,'')||' '||p.color_name) ilike n.pat
     or (p.barcode is not null and p.barcode ilike n.pat)
  union all
  -- Miniatures — consolidated by group (one row per canonical unit)
  select 'miniature', g.id, g.name, coalesce(f.name,''),
         coalesce(sum(m.quantity),0)::int, true, false,
         similarity(g.name, n.raw)
  from unit_groups g
  left join miniature_units m on m.group_id = g.id
  left join factions f on f.id = g.faction_id, needle n
  where (g.name||' '||coalesce(f.name,'')) ilike n.pat
     or exists (select 1 from miniature_units mm
                where mm.group_id = g.id and mm.barcode is not null and mm.barcode ilike n.pat)
  group by g.id, g.name, f.name, n.raw
  union all
  -- Brushes
  select 'brush', b.id, b.manufacturer||' '||coalesce(b.series,''),
         coalesce(b.size,''), b.quantity, true, false,
         similarity(b.manufacturer||' '||coalesce(b.series,''), n.raw)
  from brushes b, needle n
  where (b.manufacturer||' '||coalesce(b.series,'')||' '||coalesce(b.size,'')) ilike n.pat
  union all
  -- Tools
  select 'tool', t.id, t.item, coalesce(t.category,''), t.quantity, true, false,
         similarity(t.item, n.raw)
  from tools t, needle n
  where (t.item||' '||coalesce(t.category,'')) ilike n.pat
     or (t.barcode is not null and t.barcode ilike n.pat)
  union all
  -- Terrain
  select 'terrain', r.id, r.terrain_set, coalesce(r.components,''),
         coalesce(r.quantity,0), true, false, similarity(r.terrain_set, n.raw)
  from terrain r, needle n
  where (r.terrain_set||' '||coalesce(r.components,'')) ilike n.pat
     or (r.barcode is not null and r.barcode ilike n.pat)
  order by rank desc, title
  limit 50;
$$;

-- ---------- 7. Exact barcode lookup (scan path) ------------------------------
create or replace function find_by_barcode(code text)
returns table (
  item_type text, id uuid, title text, subtitle text,
  owned_qty int, already_owned boolean, needs_replacement boolean, rank real
)
language sql stable
as $$
  select 'paint', p.id, p.brand||' '||p.color_name, coalesce(p.line,''),
         p.quantity, true, p.needs_replacement in ('Yes','Partial'), 1.0::real
  from paints p where p.barcode = code
  union all
  select 'tool', t.id, t.item, coalesce(t.category,''), t.quantity, true, false, 1.0
  from tools t where t.barcode = code
  union all
  select 'terrain', r.id, r.terrain_set, coalesce(r.components,''),
         coalesce(r.quantity,0), true, false, 1.0
  from terrain r where r.barcode = code
  union all
  select 'miniature', g.id, g.name, coalesce(f.name,''),
         coalesce(sum(m.quantity),0)::int, true, false, 1.0
  from miniature_units m
  join unit_groups g on g.id = m.group_id
  left join factions f on f.id = g.faction_id
  where m.barcode = code
  group by g.id, g.name, f.name;
$$;

grant execute on function search_inventory(text) to authenticated;
grant execute on function find_by_barcode(text) to authenticated;

-- =============================================================================
-- Migration 0003: Views & functions (dashboards, unified search, progress)
-- =============================================================================
-- All views are SECURITY INVOKER, so RLS still applies — a user only ever
-- aggregates their own rows.
-- =============================================================================

-- ---------- Collection dashboard --------------------------------------------
create or replace view v_collection_stats as
select
  owner_id,
  count(*)                                   as unit_count,
  coalesce(sum(quantity), 0)                 as total_models,
  coalesce(sum(qty_painted), 0)              as models_painted,
  coalesce(sum(greatest(quantity - qty_painted, 0)), 0) as models_unpainted,
  coalesce(sum(case when repairs_needed is not null
                     and repairs_needed not in ('', 'None')
                    then quantity else 0 end), 0)        as models_needing_repair,
  coalesce(sum(case when tabletop_ready = 'Yes' then quantity else 0 end), 0) as models_tabletop_ready,
  coalesce(sum(estimated_value), 0)          as estimated_value
from miniature_units
group by owner_id;

-- ---------- Paint dashboards -------------------------------------------------
create or replace view v_paint_by_brand as
select owner_id, coalesce(brand,'(unknown)') as brand,
       count(*) as line_items, coalesce(sum(quantity),0) as total
from paints group by owner_id, brand;

create or replace view v_paint_by_type as
select owner_id, coalesce(paint_type,'(unspecified)') as paint_type,
       count(*) as line_items, coalesce(sum(quantity),0) as total
from paints group by owner_id, paint_type;

create or replace view v_paints_replacement as
select * from paints
where needs_replacement in ('Yes','Partial');

-- ---------- Hobby dashboard --------------------------------------------------
-- NB: anchored on public tables (not auth.users) so the `authenticated`
-- role can read it. RLS on the base tables still scopes rows to the caller.
create or replace view v_hobby_stats as
with owners as (
  select owner_id from brushes
  union select owner_id from tools
  union select owner_id from terrain
  union select owner_id from paints
)
select o.owner_id,
  coalesce((select sum(quantity) from brushes b where b.owner_id = o.owner_id),0) as brush_count,
  coalesce((select sum(quantity) from tools   t where t.owner_id = o.owner_id),0) as tool_count,
  coalesce((select count(*)      from terrain r where r.owner_id = o.owner_id),0) as terrain_sets,
  coalesce((select sum(quantity) from paints  p where p.owner_id = o.owner_id),0) as paint_count
from (select distinct owner_id from owners) o;

-- ---------- Project progress (drives progress bars) -------------------------
create or replace view v_project_progress as
select
  p.id as project_id, p.owner_id, p.name, p.status, p.priority,
  coalesce(sum(m.quantity),0)      as total_models,
  coalesce(sum(m.qty_assembled),0) as assembled,
  coalesce(sum(m.qty_primed),0)    as primed,
  coalesce(sum(m.qty_basecoated),0) as basecoated,
  coalesce(sum(m.qty_painted),0)   as painted,
  coalesce(sum(m.qty_based),0)     as based,
  coalesce(sum(m.qty_completed),0) as completed,
  case when coalesce(sum(m.quantity),0) = 0 then 0
       else round(100.0 * sum(m.qty_completed) / sum(m.quantity)) end as pct_completed,
  case when coalesce(sum(m.quantity),0) = 0 then 0
       else round(100.0 * sum(m.qty_painted)  / sum(m.quantity)) end as pct_painted
from projects p
left join miniature_units m on m.project_id = p.id
group by p.id, p.owner_id, p.name, p.status, p.priority;

-- ---------- Unified search for Store Mode + duplicate detection -------------
-- Returns one normalized shape across paints / minis / brushes / tools / terrain.
-- owned_qty + already_owned power the "✓ Already Owned" / "⚠ Already Owned" UI.
create or replace function search_inventory(q text)
returns table (
  item_type   text,
  id          uuid,
  title       text,
  subtitle    text,
  owned_qty   int,
  already_owned boolean,
  needs_replacement boolean,
  rank        real
)
language sql stable
as $$
  with needle as (select '%' || coalesce(q,'') || '%' as pat, coalesce(q,'') as raw)
  -- Paints
  select 'paint', p.id,
         p.brand || ' ' || p.color_name,
         coalesce(p.line,'') || case when p.paint_type is not null then ' · '||p.paint_type else '' end,
         p.quantity, true,
         p.needs_replacement in ('Yes','Partial'),
         greatest(similarity(p.brand||' '||p.color_name, n.raw),
                  similarity(p.color_name, n.raw))
  from paints p, needle n
  where (p.brand||' '||coalesce(p.line,'')||' '||p.color_name) ilike n.pat
  union all
  -- Miniatures
  select 'miniature', m.id, m.unit_name,
         coalesce(f.name,'') ,
         m.quantity, true, false,
         similarity(m.unit_name, n.raw)
  from miniature_units m left join factions f on f.id = m.faction_id, needle n
  where (m.unit_name||' '||coalesce(f.name,'')) ilike n.pat
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
  union all
  -- Terrain
  select 'terrain', r.id, r.terrain_set, coalesce(r.components,''),
         coalesce(r.quantity,0), true, false,
         similarity(r.terrain_set, n.raw)
  from terrain r, needle n
  where (r.terrain_set||' '||coalesce(r.components,'')) ilike n.pat
  order by rank desc, title
  limit 50;
$$;

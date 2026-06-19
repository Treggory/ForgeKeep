-- =============================================================================
-- Migration 0005: Global lookup defaults (owner_id NULL = visible to all users)
-- Generated from the workbook "Lookups" sheet. Idempotent.
-- =============================================================================
do $$
begin
  if not exists (select 1 from lookups where owner_id is null) then
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'paint_status','NiB',0);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'paint_status','Unpainted',1);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'paint_status','Mostly Unpainted',2);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'paint_status','Partially Painted',3);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'paint_status','Mostly Painted',4);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'paint_status','Painted',5);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'paint_status','Mixed',6);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'paint_status','Needs Testing',7);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'paint_status','New',8);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'assembly_status','NiB',0);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'assembly_status','NOS',1);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'assembly_status','Partial',2);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'assembly_status','Assembled',3);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'assembly_status','Mixed',4);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'assembly_status','Unknown',5);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'condition','New',0);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'condition','Excellent',1);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'condition','Good',2);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'condition','Fair-Good',3);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'condition','Fair',4);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'condition','Poor',5);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'condition','Needs Testing',6);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'condition','Needs Repair',7);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'condition','Retired',8);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'priority','Immediate',0);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'priority','Active Project',1);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'priority','Secondary Project',2);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'priority','Backlog',3);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'priority','Storage',4);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'priority','Display Only',5);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'priority','Sell/Trade',6);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'yes_no_unknown','Yes',0);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'yes_no_unknown','No',1);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'yes_no_unknown','Unknown',2);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'yes_no_unknown','Partial',3);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'paint_type','Acrylic',0);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'paint_type','Airbrush Acrylic',1);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'paint_type','Contrast',2);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'paint_type','Wash',3);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'paint_type','Shade',4);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'paint_type','Metallic',5);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'paint_type','Colorshift',6);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'paint_type','Medium',7);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'paint_type','Texture',8);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'paint_type','Putty',9);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'paint_type','Primer',10);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'paint_type','Varnish',11);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'wishlist_reason','Want to Buy',0);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'wishlist_reason','Need Replacement',1);
    insert into lookups(owner_id,category,value,sort_order) values (NULL,'wishlist_reason','Future Project',2);
  end if;
end $$;

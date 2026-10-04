-- SPMU dual-side storage: UNIT and SPARE PART / MATERIAL can both be populated
-- independently in the same report. Legacy SPMU columns remain for compatibility.
alter table public.reports
  add column if not exists unit_status text,
  add column if not exists unit_name text,
  add column if not exists unit_type text,
  add column if not exists unit_jumlah numeric,
  add column if not exists spare_part_material_status text,
  add column if not exists spare_part_material text,
  add column if not exists spare_part_material_type text,
  add column if not exists spare_part_material_jumlah numeric;

update public.reports
set
  unit_status = coalesce(unit_status, case when upper(trim(coalesce(spare_part_unit_kind,''))) = 'UNIT' then spare_part_unit_status end),
  unit_name = coalesce(unit_name, case when upper(trim(coalesce(spare_part_unit_kind,''))) = 'UNIT' then spare_part_unit end),
  unit_type = coalesce(unit_type, case when upper(trim(coalesce(spare_part_unit_kind,''))) = 'UNIT' then type end),
  unit_jumlah = coalesce(unit_jumlah, case when upper(trim(coalesce(spare_part_unit_kind,''))) = 'UNIT' then jumlah end),
  spare_part_material_status = coalesce(spare_part_material_status, case when upper(trim(coalesce(spare_part_unit_kind,''))) = 'SPARE PART / MATERIAL' then spare_part_unit_status end),
  spare_part_material = coalesce(spare_part_material, case when upper(trim(coalesce(spare_part_unit_kind,''))) = 'SPARE PART / MATERIAL' then spare_part_unit end),
  spare_part_material_type = coalesce(spare_part_material_type, case when upper(trim(coalesce(spare_part_unit_kind,''))) = 'SPARE PART / MATERIAL' then type end),
  spare_part_material_jumlah = coalesce(spare_part_material_jumlah, case when upper(trim(coalesce(spare_part_unit_kind,''))) = 'SPARE PART / MATERIAL' then jumlah end);

comment on column public.reports.unit_status is 'SPMU UNIT condition/source: BARU, KANIBAL, DARI UNIT / RUANGAN LAIN, or LAINNYA';
comment on column public.reports.unit_name is 'SPMU UNIT name';
comment on column public.reports.unit_type is 'SPMU UNIT type/specification';
comment on column public.reports.unit_jumlah is 'SPMU UNIT quantity';
comment on column public.reports.spare_part_material_status is 'SPMU SPARE PART / MATERIAL condition/source: BARU, KANIBAL, DARI UNIT / RUANGAN LAIN, or LAINNYA';
comment on column public.reports.spare_part_material is 'SPMU SPARE PART / MATERIAL name';
comment on column public.reports.spare_part_material_type is 'SPMU SPARE PART / MATERIAL type/specification';
comment on column public.reports.spare_part_material_jumlah is 'SPMU SPARE PART / MATERIAL quantity';

-- SPMU dual-side schema alignment only.
-- IMPORTANT: schema-only; no INSERT/UPDATE/DELETE/backfill of production rows.
alter table public.reports
  add column if not exists unit_status text,
  add column if not exists unit_name text,
  add column if not exists unit_type text,
  add column if not exists unit_jumlah numeric,
  add column if not exists spare_part_material_status text,
  add column if not exists spare_part_material text,
  add column if not exists spare_part_material_type text,
  add column if not exists spare_part_material_jumlah numeric;

comment on column public.reports.spare_part_unit_kind is
  'SPMU kind: SPARE PART / MATERIAL or UNIT';
comment on column public.reports.spare_part_unit_status is
  'SPMU legacy source/status: BARU, KANIBAL, DARI UNIT / RUANGAN LAIN, or LAINNYA';
comment on column public.reports.unit_status is
  'SPMU UNIT condition/source: BARU, KANIBAL, DARI UNIT / RUANGAN LAIN, or LAINNYA';
comment on column public.reports.unit_name is 'SPMU UNIT name';
comment on column public.reports.unit_type is 'SPMU UNIT type/specification';
comment on column public.reports.unit_jumlah is 'SPMU UNIT quantity';
comment on column public.reports.spare_part_material_status is
  'SPMU SPARE PART / MATERIAL condition/source: BARU, KANIBAL, DARI UNIT / RUANGAN LAIN, or LAINNYA';
comment on column public.reports.spare_part_material is 'SPMU SPARE PART / MATERIAL name';
comment on column public.reports.spare_part_material_type is 'SPMU SPARE PART / MATERIAL type/specification';
comment on column public.reports.spare_part_material_jumlah is 'SPMU SPARE PART / MATERIAL quantity';
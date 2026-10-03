-- SPARE PART / MATERIAL / UNIT classification and automatic recap support
alter table public.reports
  add column if not exists spare_part_unit_kind text;

alter table public.reports
  add column if not exists spare_part_unit_status text;

comment on column public.reports.spare_part_unit_kind is 'SPARE PART / MATERIAL or UNIT';
comment on column public.reports.spare_part_unit_status is 'BARU, KANIBAL, or LAINNYA';

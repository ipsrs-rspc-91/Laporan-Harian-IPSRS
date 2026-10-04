-- SPMU status/source contract correction
-- Keep the original migration immutable; document the complete accepted set.
comment on column public.reports.spare_part_unit_status is
  'SPMU source/status: BARU, KANIBAL, DARI UNIT / RUANGAN LAIN, or LAINNYA';

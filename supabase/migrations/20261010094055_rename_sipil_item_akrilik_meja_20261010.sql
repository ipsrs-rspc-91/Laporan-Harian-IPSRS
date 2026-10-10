-- Rename one Sipil master-data item only; preserve its ID, parent area, and report history.
-- Rollback: UPDATE public.master_data SET name = 'Akrilik meja / AC Split', updated_at = now() WHERE id = 131 AND data_type = 'ITEM' AND parent_id = 879 AND name = 'Akrilik meja';
do $$
declare changed integer;
begin
  update public.master_data
  set name = 'Akrilik meja', updated_at = now()
  where id = 131
    and data_type = 'ITEM'
    and parent_id = 879
    and name = 'Akrilik meja / AC Split'
    and is_active = true;
  get diagnostics changed = row_count;
  if changed <> 1 then
    raise exception 'Expected exactly one active Sipil item ID 131 to rename; updated % rows. Transaction rolled back.', changed;
  end if;
end $$;

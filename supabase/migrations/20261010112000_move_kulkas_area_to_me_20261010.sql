-- Move the standalone Kulkas area from the catch-all group into M.E.
-- Preserve report history: only master_data relationships/active flags change.
-- Existing M.E. item "Kulkas" remains; its unique child item is moved below the
-- M.E. AC/Tata Udara/Chiller area. The old standalone area is soft-disabled.

DO $$
DECLARE
  v_old_area_id bigint;
  v_me_area_id bigint;
  v_item record;
  v_existing_item_id bigint;
  v_next_sort integer;
BEGIN
  SELECT id
    INTO v_old_area_id
  FROM public.master_data
  WHERE data_type = 'AREA'
    AND name = 'Kulkas'
    AND parent_id IS NULL
    AND is_active = true
  ORDER BY id
  LIMIT 1;

  SELECT id
    INTO v_me_area_id
  FROM public.master_data
  WHERE data_type = 'AREA'
    AND name = 'M.E. ( AC / Tata Udara / CHILLER )'
    AND is_active = true
  ORDER BY id
  LIMIT 1;

  IF v_old_area_id IS NULL THEN
    RAISE NOTICE 'Active standalone Kulkas area not found; migration is already applied or no work is needed.';
    RETURN;
  END IF;

  IF v_me_area_id IS NULL THEN
    RAISE EXCEPTION 'Target M.E. AC/Tata Udara/Chiller area was not found; no Kulkas data was changed.';
  END IF;

  FOR v_item IN
    SELECT id, name
    FROM public.master_data
    WHERE data_type = 'ITEM'
      AND parent_id = v_old_area_id
      AND is_active = true
    ORDER BY sort_order, id
  LOOP
    SELECT id
      INTO v_existing_item_id
    FROM public.master_data
    WHERE data_type = 'ITEM'
      AND parent_id = v_me_area_id
      AND is_active = true
      AND lower(btrim(name)) = lower(btrim(v_item.name))
    ORDER BY id
    LIMIT 1;

    IF v_existing_item_id IS NULL THEN
      SELECT COALESCE(MAX(sort_order), 0) + 1
        INTO v_next_sort
      FROM public.master_data
      WHERE data_type = 'ITEM'
        AND parent_id = v_me_area_id;

      UPDATE public.master_data
      SET parent_id = v_me_area_id,
          sort_order = v_next_sort,
          updated_at = now()
      WHERE id = v_item.id;
    ELSE
      -- An equivalent active item already exists in M.E.; avoid a duplicate.
      UPDATE public.master_data
      SET is_active = false,
          updated_at = now()
      WHERE id = v_item.id;
    END IF;
  END LOOP;

  -- Soft-disable, do not hard-delete, the old catch-all area.
  UPDATE public.master_data
  SET is_active = false,
      updated_at = now()
  WHERE id = v_old_area_id;
END
$$;

-- Perbaikan jalur Reset LHI untuk insiden yang sudah EXPIRED.
-- Hanya mengizinkan recovery challenge dan pembukaan oleh role KA IPSRS
-- setelah kode Reset diverifikasi dan login KA IPSRS berhasil.
-- Snapshot kewajiban insiden lama dipertahankan; masa pemulihan baru 120 jam.

CREATE OR REPLACE FUNCTION public.create_lhi_recovery_challenge(p_nonce_hash text, p_ip_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
DECLARE v_incident public.lhi_discipline_incidents%ROWTYPE; v_lock text;
BEGIN
  IF p_nonce_hash IS NULL OR p_nonce_hash !~ '^[0-9a-f]{64}$'
     OR p_ip_hash IS NULL OR p_ip_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('ok',false);
  END IF;
  SELECT value INTO v_lock FROM public.access_settings WHERE key='LHI_GLOBAL_BLOCK' FOR UPDATE;
  IF v_lock IS DISTINCT FROM 'AKTIF' THEN RETURN jsonb_build_object('ok',false); END IF;
  SELECT * INTO v_incident FROM public.lhi_discipline_incidents
   WHERE status IN ('LOCKED','EXPIRED') ORDER BY incident_id DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false); END IF;
  INSERT INTO public.lhi_recovery_challenges(nonce_hash,ip_hash,incident_id,expires_at)
  VALUES(p_nonce_hash,p_ip_hash,v_incident.incident_id,now()+interval '5 minutes');
  RETURN jsonb_build_object('ok',true,'expires_at',now()+interval '5 minutes',
    'incident_id',v_incident.incident_id,'incident_status',v_incident.status);
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_lhi_recovery_challenge(p_nonce_hash text,p_auth_user_id uuid,p_session_token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
DECLARE v_challenge public.lhi_recovery_challenges%ROWTYPE; v_staff public.staff%ROWTYPE; v_lock text;
BEGIN
  SELECT * INTO v_challenge FROM public.lhi_recovery_challenges WHERE nonce_hash=p_nonce_hash FOR UPDATE;
  IF NOT FOUND OR v_challenge.consumed_at IS NOT NULL OR v_challenge.expires_at<=now()
    THEN RETURN jsonb_build_object('ok',false); END IF;
  SELECT value INTO v_lock FROM public.access_settings WHERE key='LHI_GLOBAL_BLOCK' FOR UPDATE;
  IF v_lock IS DISTINCT FROM 'AKTIF' THEN RETURN jsonb_build_object('ok',false); END IF;
  SELECT * INTO v_staff FROM public.staff
   WHERE auth_user_id=p_auth_user_id AND role='KA_IPSRS' AND status='Aktif' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.lhi_discipline_incidents
    WHERE incident_id=v_challenge.incident_id AND status IN ('LOCKED','EXPIRED'))
    THEN RETURN jsonb_build_object('ok',false); END IF;
  UPDATE public.lhi_recovery_challenges SET consumed_at=now() WHERE nonce_hash=p_nonce_hash;
  INSERT INTO public.lhi_recovery_sessions(session_token_hash,auth_user_id,staff_id,staff_name,role,incident_id,expires_at)
  VALUES(p_session_token_hash,p_auth_user_id,v_staff.staff_id,v_staff.nama,'KA_IPSRS',
    v_challenge.incident_id,now()+interval '10 minutes');
  RETURN jsonb_build_object('ok',true,'expires_at',now()+interval '10 minutes',
    'staff_name',v_staff.nama,'role',v_staff.role,'incident_id',v_challenge.incident_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.open_lhi_global_grace(p_staff_id text,p_staff_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
DECLARE v_lock text; v_incident public.lhi_discipline_incidents%ROWTYPE;
  v_total integer:=0; v_reactivated integer:=0; v_now timestamptz:=clock_timestamp();
BEGIN
  IF p_staff_id IS NULL OR btrim(p_staff_id)='' OR p_staff_name IS NULL OR btrim(p_staff_name)=''
    THEN RAISE EXCEPTION 'Identitas KA IPSRS tidak lengkap. Blokir tetap aktif.'; END IF;
  SELECT value INTO v_lock FROM public.access_settings WHERE key='LHI_GLOBAL_BLOCK' FOR UPDATE;
  IF v_lock IS DISTINCT FROM 'AKTIF' THEN
    SELECT * INTO v_incident FROM public.lhi_discipline_incidents
     WHERE status='GRACE' ORDER BY incident_id DESC LIMIT 1 FOR UPDATE;
    IF FOUND AND v_lock='NONAKTIF' THEN
      SELECT count(DISTINCT staff_id) INTO v_total FROM public.lhi_discipline_obligations
       WHERE incident_id=v_incident.incident_id;
      RETURN jsonb_build_object('ok',true,'already_open',true,'incident_id',v_incident.incident_id,
        'status',v_incident.status,'started_at',v_incident.started_at,'deadline_at',v_incident.deadline_at,'total',v_total);
    END IF;
    RAISE EXCEPTION 'Mode Blok Aplikasi tidak dalam kondisi terkunci. Periksa status aplikasi sebelum mencoba kembali.';
  END IF;
  SELECT * INTO v_incident FROM public.lhi_discipline_incidents
   WHERE status IN ('LOCKED','EXPIRED') ORDER BY incident_id DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Data insiden blokir global tidak ditemukan. Blokir tetap aktif.'; END IF;
  SELECT count(DISTINCT o.staff_id) INTO v_total FROM public.lhi_discipline_obligations o
   JOIN public.staff s ON s.staff_id=o.staff_id
   WHERE o.incident_id=v_incident.incident_id AND o.completed_at IS NULL AND s.status='Aktif';
  IF v_total<1 THEN RAISE EXCEPTION 'Snapshot kewajiban aktif yang belum dipenuhi tidak ditemukan. Blokir tetap aktif.'; END IF;
  UPDATE public.staff SET status='Aktif',lhi_manual_unblock_until=NULL,updated_at=v_now
   WHERE status IN ('Nonaktif_LHI_HARI_8','DIBLOKIR_LHI_7_HARI');
  GET DIAGNOSTICS v_reactivated=ROW_COUNT;
  UPDATE public.lhi_discipline_incidents SET status='GRACE',started_at=v_now,
    deadline_at=v_now+interval '120 hours',started_by_staff_id=p_staff_id,started_by_name=p_staff_name,
    completed_at=NULL,reactivated_at=NULL WHERE incident_id=v_incident.incident_id;
  UPDATE public.access_settings SET value='NONAKTIF',updated_at=v_now,
    updated_by_staff_id=p_staff_id,updated_by_name=p_staff_name WHERE key='LHI_GLOBAL_BLOCK';
  IF NOT FOUND THEN RAISE EXCEPTION 'Status blokir global gagal diperbarui. Seluruh perubahan dibatalkan.'; END IF;
  INSERT INTO public.audit_log(username,staff_id,action,report_id,keterangan,field_changed,old_value,new_value)
  VALUES(p_staff_id,p_staff_id,'OPEN_LHI_GLOBAL_GRACE',NULL,
    'KA IPSRS membuka blokir global dan blokir individual LHI secara atomik serta memulai kelonggaran 5 hari (120 jam). Insiden sebelumnya: '||v_incident.status,
    'LHI_GLOBAL_BLOCK,staff.status,lhi_discipline_incidents.status',
    'AKTIF / '||v_incident.status||' / blokir individual','NONAKTIF / GRACE / Aktif');
  RETURN jsonb_build_object('ok',true,'already_open',false,'incident_id',v_incident.incident_id,
    'status','GRACE','started_at',v_now,'deadline_at',v_now+interval '120 hours',
    'total',v_total,'reactivated_accounts',v_reactivated,'previous_incident_status',v_incident.status);
END;
$$;

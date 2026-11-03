import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('HR anchor verification is stored as an append-only, server-only record', async () => {
  const sql = await read('../supabase/migrations/20261103041836_lhi_schema_v2.sql');
  expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.lhi_active_since_verifications');
  expect(sql).toContain('verified_active_since timestamptz NOT NULL');
  expect(sql).toContain('source_reference text NOT NULL');
  expect(sql).toContain('verified_by_auth_user_id uuid NOT NULL');
  expect(sql).toContain('trg_lhi_anchor_verifications_append_only');
  expect(sql).toContain('trg_lhi_anchor_verifications_no_truncate');
  expect(sql).toContain('REVOKE ALL ON public.lhi_active_since_verifications FROM PUBLIC, anon, authenticated, service_role');
});

test('only an authenticated active KA IPSRS can verify a current active employee anchor', async () => {
  const sql = await read('../supabase/migrations/20261103041836_lhi_schema_v2.sql');
  expect(sql).toContain('CREATE OR REPLACE FUNCTION public.verify_lhi_active_since_v2');
  expect(sql).toContain("v_actor.role <> 'KA_IPSRS'");
  expect(sql).toContain("v_actor.status <> 'Aktif'");
  expect(sql).toContain("v_target.status <> 'Aktif'");
  expect(sql).toContain('p_actor_auth_user_id');
  expect(sql).toContain("lhi_active_since_source = 'HR_CONFIRMED'");
  expect(sql).toContain('lhi_active_since_verified_at = v_now');
  expect(sql).toContain('INSERT INTO public.lhi_active_since_verifications');
  expect(sql).toContain("'VERIFY_LHI_ACTIVE_SINCE'");
  expect(sql).toContain('p_active_since_date > (v_now AT TIME ZONE');
});

test('normal API exposes HR anchor review and a KA-only audited verification action', async () => {
  const api = await read('../supabase/functions/ipsrs-api/index.ts');
  expect(api).toContain('if(a==="apiGetLhiAnchorReview")');
  expect(api).toContain('if(a==="apiVerifyLhiActiveSince")');
  expect(api).toContain('s.role!=="KA_IPSRS"');
  expect(api).toContain('verify_lhi_active_since_v2');
  expect(api).toContain('p_actor_auth_user_id:actorAuthUserId');
});

test('KA IPSRS access panel shows provisional versus HR-confirmed anchors and requires a source reference', async () => {
  const ui = await read('../frontend/access-control.js');
  expect(ui).toContain('Verifikasi Tanggal Mulai Aktif Petugas');
  expect(ui).toContain('dokumen HR/TMT');
  expect(ui).toContain('PERLU VERIFIKASI');
  expect(ui).toContain('TERVERIFIKASI');
  expect(ui).toContain('data-anchor-reference');
  expect(ui).toContain('window.verifyLhiAnchor');
  expect(ui).toContain("callAccessApi('apiVerifyLhiActiveSince'");
  expect(ui).toContain('tanggal mulai aktif petugas ini sudah dicocokkan dengan dokumen HR');
});

test('browser API transport maps the anchor review and verification actions explicitly', async () => {
  const app = await read('../frontend/app.js');
  expect(app).toContain("case 'apiGetLhiAnchorReview':");
  expect(app).toContain("case 'apiVerifyLhiActiveSince':");
  expect(app).toContain('payload.activeSinceDate=args[1]||');
  expect(app).toContain('payload.sourceReference=args[2]||');
});

test('PostgreSQL integration verifies anchors through the same KA-only RPC', async () => {
  const integration = await read('../tests/integration/lhi-postgres-integration.sql');
  expect(integration).toContain('verify_lhi_active_since_v2(');
  expect(integration).toContain('TEST-UNAUTHORIZED-HR-REF');
  expect(integration).toContain('Only authenticated KA IPSRS');
  expect(integration).toContain('lhi_active_since_verifications');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('HR anchor verification is stored as an append-only, server-only record', async () => {
  const sql = await read('../docs/drafts/2026-11-03-lhi-schema-v2-migration-review.sql');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.lhi_active_since_verifications/);
  assert.match(sql, /verified_active_since timestamptz NOT NULL/);
  assert.match(sql, /source_reference text NOT NULL/);
  assert.match(sql, /verified_by_auth_user_id uuid NOT NULL/);
  assert.match(sql, /trg_lhi_anchor_verifications_append_only/);
  assert.match(sql, /trg_lhi_anchor_verifications_no_truncate/);
  assert.match(sql, /REVOKE ALL ON public\.lhi_active_since_verifications FROM PUBLIC, anon, authenticated, service_role/);
});

test('only an authenticated active KA IPSRS can verify a current active employee anchor', async () => {
  const sql = await read('../docs/drafts/2026-11-03-lhi-schema-v2-migration-review.sql');
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.verify_lhi_active_since_v2/);
  assert.match(sql, /v_actor\.role <> 'KA_IPSRS'/);
  assert.match(sql, /v_actor\.status <> 'Aktif'/);
  assert.match(sql, /v_target\.status <> 'Aktif'/);
  assert.match(sql, /p_actor_auth_user_id/);
  assert.match(sql, /lhi_active_since_source = 'HR_CONFIRMED'/);
  assert.match(sql, /lhi_active_since_verified_at = v_now/);
  assert.match(sql, /INSERT INTO public\.lhi_active_since_verifications/);
  assert.match(sql, /'VERIFY_LHI_ACTIVE_SINCE'/);
  assert.match(sql, /p_active_since_date > \(v_now AT TIME ZONE/);
});

test('normal API exposes HR anchor review and a KA-only audited verification action', async () => {
  const api = await read('../supabase/functions/ipsrs-api/index.ts');
  assert.ok(api.includes('if(a==="apiGetLhiAnchorReview")'));
  assert.ok(api.includes('if(a==="apiVerifyLhiActiveSince")'));
  assert.ok(api.includes('s.role!=="KA_IPSRS"'));
  assert.ok(api.includes('verify_lhi_active_since_v2'));
  assert.ok(api.includes('p_actor_auth_user_id:actorAuthUserId'));
});

test('KA IPSRS access panel shows provisional versus HR-confirmed anchors and requires a source reference', async () => {
  const ui = await read('../frontend/access-control.js');
  assert.ok(ui.includes('Verifikasi Tanggal Mulai Aktif Petugas'));
  assert.ok(ui.includes('dokumen HR/TMT'));
  assert.ok(ui.includes('PERLU VERIFIKASI'));
  assert.ok(ui.includes('TERVERIFIKASI'));
  assert.ok(ui.includes('data-anchor-reference'));
  assert.ok(ui.includes('window.verifyLhiAnchor'));
  assert.ok(ui.includes("callAccessApi('apiVerifyLhiActiveSince'"));
  assert.ok(ui.includes('tanggal mulai aktif petugas ini sudah dicocokkan dengan dokumen HR'));
});

test('browser API transport maps the anchor review and verification actions explicitly', async () => {
  const app = await read('../frontend/app.js');
  assert.ok(app.includes("case 'apiGetLhiAnchorReview':"));
  assert.ok(app.includes("case 'apiVerifyLhiActiveSince':"));
  assert.ok(app.includes('payload.activeSinceDate=args[1]||'));
  assert.ok(app.includes('payload.sourceReference=args[2]||'));
});

test('PostgreSQL integration verifies anchors through the same KA-only RPC', async () => {
  const integration = await read('../tests/integration/lhi-postgres-integration.sql');
  assert.ok(integration.includes('verify_lhi_active_since_v2('));
  assert.ok(integration.includes('TEST-UNAUTHORIZED-HR-REF'));
  assert.ok(integration.includes('Only authenticated KA IPSRS'));
  assert.ok(integration.includes('lhi_active_since_verifications'));
});

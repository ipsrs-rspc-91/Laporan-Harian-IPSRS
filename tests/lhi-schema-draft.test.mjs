import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile(
  new URL("../docs/drafts/2026-11-03-lhi-schema-v2-migration-review.sql", import.meta.url),
  "utf8",
);

test("schema v2 draft is explicitly review-only and transaction-wrapped", () => {
  assert.match(sql, /REVIEW DRAFT ONLY — NOT A SUPABASE MIGRATION/);
  assert.match(sql, /^BEGIN;/m);
  assert.match(sql, /^COMMIT;/m);
});

test("employment status and LHI access status are separate columns", () => {
  assert.match(sql, /ADD COLUMN IF NOT EXISTS lhi_access_status text/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS lhi_active_since timestamptz/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS lhi_active_since_source text/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS lhi_active_since_verified_at timestamptz/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS lhi_access_blocked_at timestamptz/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS lhi_access_block_reason text/);
});

test("legacy status normalization fails closed without an audit-proven Aktif-to-LHI transition", () => {
  assert.match(sql, /DO \$legacy_status_guard\$/);
  assert.match(sql, /a\.old_value = 'Aktif'/);
  assert.match(sql, /a\.new_value = s\.status/);
  assert.match(sql, /a\.action IN \('BLOCK_LOGIN_LHI_7_HARI', 'DEACTIVATE_LHI_DAY_8'\)/);
  assert.match(sql, /Backfill status LHI dihentikan/);
});

test("legacy LHI-only status is normalized to Aktif while LHI access remains blocked", () => {
  assert.match(sql, /lhi_access_status = 'BLOCKED_LHI'/);
  assert.match(sql, /WHERE status IN \('Nonaktif_LHI_HARI_8', 'DIBLOKIR_LHI_7_HARI'\)/);
  assert.match(sql, /SET status = 'Aktif',\s+updated_at = clock_timestamp\(\)/);
  assert.match(sql, /INSERT INTO public\.staff_employment_status_events/);
  assert.ok(sql.includes("app.lhi_status_change_reason"));
  assert.ok(sql.includes("Alasan perubahan status tidak disertakan oleh sumber perubahan"));
  assert.match(sql, /'BACKFILL'/);
  assert.match(sql, /lhi_access_before, lhi_access_after/);
  assert.match(sql, /Normalisasi status blokir lama yang dibuat scheduler LHI/);
});


test("grace snapshot is unique per incident, Reset cycle, and staff member", () => {
  assert.match(sql, /grace_cycle integer NOT NULL DEFAULT 0 CHECK \(grace_cycle >= 0\)/);
  assert.match(sql, /grace_cycle integer NOT NULL CHECK \(grace_cycle > 0\)/);
  assert.match(sql, /UNIQUE \(incident_id, grace_cycle, staff_id\)/);
  assert.match(sql, /obligation_status IN \('PENDING', 'COMPLETED', 'EXCLUDED_INACTIVE'\)/);
});

test("legacy snapshot may store NULL only when no valid historical LHI timestamp exists", () => {
  assert.ok(sql.includes("missed_full_days_at_snapshot integer CHECK (missed_full_days_at_snapshot >= 0)"));
  assert.ok(!sql.includes("missed_full_days_at_snapshot integer NOT NULL"));
});

test("obligation event audit history is protected against UPDATE and DELETE", () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.prevent_lhi_obligation_event_mutation\(\)/);
  assert.match(sql, /RAISE EXCEPTION 'Riwayat kewajiban LHI bersifat append-only\.'/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.prevent_lhi_obligation_event_mutation\(\)[\s\S]*FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(sql, /BEFORE UPDATE OR DELETE ON public\.lhi_discipline_obligation_events/);
  assert.match(sql, /BEFORE TRUNCATE ON public\.lhi_discipline_obligation_events/);
  assert.match(sql, /EXECUTE FUNCTION public\.prevent_lhi_obligation_event_mutation\(\)/);
});

test("new snapshot and event tables deny direct client access", () => {
  assert.equal((sql.match(/ENABLE ROW LEVEL SECURITY;/g) || []).length, 3);
  assert.match(sql, /REVOKE ALL ON public\.staff_employment_status_events FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /REVOKE ALL ON public\.lhi_discipline_snapshot_members FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /REVOKE ALL ON public\.lhi_discipline_obligation_events FROM PUBLIC, anon, authenticated/);
});

test("reactivation only clears an LHI-caused individual block", () => {
  assert.match(sql, /COALESCE\(OLD\.status, ''\)\) IN \('nonaktif', 'nonaktif_lhi_hari_8', 'diblokir_lhi_7_hari'\)/i);
  assert.match(sql, /COALESCE\(NEW\.status, ''\)\) = 'aktif'/i);
  assert.match(sql, /NEW\.status IS NULL OR NEW\.status NOT IN \('Aktif', 'Nonaktif'\)/);
  assert.match(sql, /OLD\.lhi_access_status = 'BLOCKED_LHI'/);
  assert.match(sql, /OLD\.lhi_access_block_reason = 'LHI_NONCOMPLIANCE'/);
  assert.doesNotMatch(sql, /UPDATE public\.access_settings/i);
});

test("report save reactivation trigger is removed without touching unrelated report triggers", () => {
  assert.match(sql, /DROP TRIGGER IF EXISTS trg_reactivate_lhi_staff_after_report ON public\.reports/);
  assert.match(sql, /DROP TRIGGER IF EXISTS trg_protect_lhi_manual_unblock_status ON public\.staff/);
  assert.match(sql, /unrelated[\s\S]*report identity\/category\/item\/timestamp triggers remain untouched/);
});

test("legacy anchor and status reconciliation are explicitly marked as required review", () => {
  assert.match(sql, /Provisional anchors for review only/);
  assert.match(sql, /do not enable discipline scheduler[\s\S]*until the values are reconciled/i);
  assert.match(sql, /ALTER TABLE public\.staff VALIDATE CONSTRAINT staff_lhi_access_status_check/);
});

test("SECURITY DEFINER employment trigger uses an empty search_path", () => {
  assert.match(sql, /SECURITY DEFINER\s+SET search_path = ''/);
  assert.doesNotMatch(sql, /SET search_path = public, pg_temp/);
});

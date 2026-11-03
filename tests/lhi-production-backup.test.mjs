import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const script = await readFile(
  new URL("../scripts/lhi-production-backup.ps1", import.meta.url),
  "utf8",
);

test("production backup script exports roles, schema, and data as separate files", () => {
  assert.match(script, /"db",\s*"dump"[\s\S]*?"--role-only"/);
  assert.match(script, /"db",\s*"dump"[\s\S]*?"schema\.sql"/);
  assert.match(script, /"db",\s*"dump"[\s\S]*?"--use-copy",\s*"--data-only"/);
  assert.match(script, /Assert-BackupFiles/);
});

test("backup manifest records SHA-256, critical row counts, and service exclusions", () => {
  assert.match(script, /Get-FileHash[\s\S]*?SHA256/);
  assert.match(script, /database_counts = \$counts/);
  assert.match(script, /scope_warning =/);
  assert.match(script, /Auth and Storage schemas/);
  assert.match(script, /restore_test = "NOT_RUN"/);
});

test("restore rehearsal validates hashes and requires an explicit isolated-target confirmation", () => {
  assert.match(script, /if \(\$actualHash -ne \$entry\.sha256\)/);
  assert.match(script, /RESTORE-TO-ISOLATED-TEST/);
  assert.match(script, /--single-transaction/);
  assert.match(script, /session_replication_role = replica/);
  assert.match(script, /RESTORE_REHEARSAL_PASSED/);
});

test("backup script never writes database URLs or secrets into its manifest", () => {
  assert.doesNotMatch(script, /SUPABASE_DB_URL\s*=/);
  assert.doesNotMatch(script, /RESTORE_DB_URL\s*=/);
  assert.doesNotMatch(script, /service_role_key|anon_key|password\s*=/i);
  assert.match(script, /No connection string was written to disk/);
});

test("backup script changes are included in the LHI CI path filters", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/lhi-discipline-tests.yml", import.meta.url),
    "utf8",
  );
  assert.equal(
    (workflow.match(/scripts\/lhi-production-backup\.ps1/g) || []).length,
    2,
  );
});

test("PowerShell backup script is syntax-parsed in CI", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/lhi-discipline-tests.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /Parse production backup PowerShell script/);
  assert.match(workflow, /shell: pwsh/);
  assert.match(workflow, /Language\]::Parser\]::ParseFile/);
});

test("backup and restore modes fail early when required local tools are missing", () => {
  assert.match(script, /foreach \(\$requiredCommand in @\("supabase", "psql", "docker"\)\)/);
  assert.match(script, /Get-Command "psql"/);
});

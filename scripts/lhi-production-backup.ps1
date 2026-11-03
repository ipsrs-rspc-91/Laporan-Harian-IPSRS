[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("Backup", "RestoreTest")]
  [string]$Mode,

  [Parameter(Mandatory = $true)]
  [string]$BackupDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][string]$FailureMessage
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw $FailureMessage
  }
}

function Get-CriticalCounts {
  param([Parameter(Mandatory = $true)][string]$DatabaseUrl)

  $query = @"
SELECT json_build_object(
  'staff', (SELECT count(*) FROM public.staff),
  'reports', (SELECT count(*) FROM public.reports),
  'master_data', (SELECT count(*) FROM public.master_data),
  'access_settings', (SELECT count(*) FROM public.access_settings),
  'lhi_discipline_incidents', (SELECT count(*) FROM public.lhi_discipline_incidents),
  'lhi_discipline_obligations', (SELECT count(*) FROM public.lhi_discipline_obligations)
)::text;
"@

  $output = & psql $DatabaseUrl --no-psqlrc --quiet --tuples-only --no-align --set ON_ERROR_STOP=1 --command $query
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($output -join ""))) {
    throw "Gagal membaca jumlah baris tabel kritis."
  }

  return (($output -join "").Trim() | ConvertFrom-Json)
}

function Assert-BackupFiles {
  param([Parameter(Mandatory = $true)][string]$Directory)

  foreach ($name in @("roles.sql", "schema.sql", "data.sql")) {
    $path = Join-Path $Directory $name
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
      throw "File backup tidak ditemukan: $name"
    }
    if ((Get-Item -LiteralPath $path).Length -le 0) {
      throw "File backup kosong: $name"
    }
  }
}

$resolvedBackupDirectory = [System.IO.Path]::GetFullPath($BackupDirectory)

if ($Mode -eq "Backup") {
  if ([string]::IsNullOrWhiteSpace($env:SUPABASE_DB_URL)) {
    throw "Set SUPABASE_DB_URL di terminal privat terlebih dahulu. Jangan kirim URL/password ke chat atau repository."
  }

  New-Item -ItemType Directory -Force -Path $resolvedBackupDirectory | Out-Null

  $cliVersion = (& supabase --version 2>&1 | Out-String).Trim()
  if ($LASTEXITCODE -ne 0) {
    throw "Supabase CLI tidak tersedia."
  }

  Invoke-CheckedCommand -Command "supabase" -Arguments @(
    "db", "dump", "--db-url", $env:SUPABASE_DB_URL, "-f", (Join-Path $resolvedBackupDirectory "roles.sql"), "--role-only"
  ) -FailureMessage "Dump roles gagal."

  Invoke-CheckedCommand -Command "supabase" -Arguments @(
    "db", "dump", "--db-url", $env:SUPABASE_DB_URL, "-f", (Join-Path $resolvedBackupDirectory "schema.sql")
  ) -FailureMessage "Dump schema gagal."

  Invoke-CheckedCommand -Command "supabase" -Arguments @(
    "db", "dump", "--db-url", $env:SUPABASE_DB_URL, "-f", (Join-Path $resolvedBackupDirectory "data.sql"), "--use-copy", "--data-only"
  ) -FailureMessage "Dump data gagal."

  Assert-BackupFiles -Directory $resolvedBackupDirectory
  $counts = Get-CriticalCounts -DatabaseUrl $env:SUPABASE_DB_URL

  $files = foreach ($name in @("roles.sql", "schema.sql", "data.sql")) {
    $file = Get-Item -LiteralPath (Join-Path $resolvedBackupDirectory $name)
    [pscustomobject]@{
      name = $name
      bytes = $file.Length
      sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
    }
  }

  $manifest = [ordered]@{
    created_at_utc = (Get-Date).ToUniversalTime().ToString("o")
    project_ref = "tcrmlhfsroyhaxdfwyll"
    supabase_cli_version = $cliVersion
    database_counts = $counts
    files = @($files)
    scope_warning = "Logical database dump only. Supabase-managed Auth and Storage schemas, Storage objects, dashboard configuration, Edge Function secrets, and external service state require separate supported backup/recovery procedures."
    restore_test = "NOT_RUN"
  }

  $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $resolvedBackupDirectory "manifest.json") -Encoding utf8
  Write-Output "BACKUP_FILES_CREATED"
  Write-Output "Manifest and SHA-256 checksums saved. No connection string was written to disk."
  Write-Output "This is not a complete Supabase-service backup until Auth, Storage, secrets, and configuration recovery are separately verified."
  exit 0
}

if ($Mode -eq "RestoreTest") {
  if ([string]::IsNullOrWhiteSpace($env:RESTORE_DB_URL)) {
    throw "Set RESTORE_DB_URL ke database uji kosong. Jangan gunakan URL produksi."
  }

  $manifestPath = Join-Path $resolvedBackupDirectory "manifest.json"
  if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "manifest.json tidak ditemukan."
  }

  Assert-BackupFiles -Directory $resolvedBackupDirectory
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

  foreach ($entry in $manifest.files) {
    $path = Join-Path $resolvedBackupDirectory $entry.name
    $actualHash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
    if ($actualHash -ne $entry.sha256) {
      throw "Checksum tidak cocok: $($entry.name). Restore dibatalkan."
    }
  }

  $confirmation = Read-Host "Ketik RESTORE-TO-ISOLATED-TEST hanya jika target adalah database uji kosong"
  if ($confirmation -cne "RESTORE-TO-ISOLATED-TEST") {
    throw "Konfirmasi target uji tidak cocok. Restore dibatalkan."
  }

  Invoke-CheckedCommand -Command "psql" -Arguments @(
    $env:RESTORE_DB_URL, "--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--file", (Join-Path $resolvedBackupDirectory "roles.sql")
  ) -FailureMessage "Restore role gagal."

  Invoke-CheckedCommand -Command "psql" -Arguments @(
    $env:RESTORE_DB_URL,
    "--no-psqlrc",
    "--single-transaction",
    "--set", "ON_ERROR_STOP=1",
    "--file", (Join-Path $resolvedBackupDirectory "schema.sql"),
    "--command", "SET session_replication_role = replica",
    "--file", (Join-Path $resolvedBackupDirectory "data.sql")
  ) -FailureMessage "Restore schema/data gagal."

  $restoredCounts = Get-CriticalCounts -DatabaseUrl $env:RESTORE_DB_URL
  foreach ($property in @("staff", "reports", "master_data", "access_settings", "lhi_discipline_incidents", "lhi_discipline_obligations")) {
    $expected = [long]$manifest.database_counts.$property
    $actual = [long]$restoredCounts.$property
    if ($expected -ne $actual) {
      throw "Jumlah baris tidak cocok pada $property. Expected=$expected Actual=$actual"
    }
  }

  $manifest.restore_test = "PASSED"
  $manifest.restore_test_at_utc = (Get-Date).ToUniversalTime().ToString("o")
  $manifest.restored_critical_counts = $restoredCounts
  $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding utf8

  Write-Output "RESTORE_REHEARSAL_PASSED_FOR_LISTED_DATABASE_TABLES"
  Write-Output "Auth, Storage objects, secrets, and dashboard/service configuration remain separate recovery gates."
  exit 0
}

throw "Mode tidak dikenal."

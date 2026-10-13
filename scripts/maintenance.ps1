param([string]$Container = 'repete-postgres')
$ErrorActionPreference = 'Stop'
$projectPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $projectPath
New-Item -ItemType Directory -Path (Join-Path $projectPath 'artifacts') -Force | Out-Null
$logPath = Join-Path $projectPath 'artifacts/maintenance.log'
& node (Join-Path $PSScriptRoot 'backup.mjs') --container $Container *>> $logPath
if ($LASTEXITCODE -ne 0) { throw 'Backup failed; cleanup was not executed.' }
& node (Join-Path $PSScriptRoot 'cleanup.mjs') *>> $logPath
if ($LASTEXITCODE -ne 0) { throw 'Cleanup failed. Inspect maintenance.log.' }
Add-Content -LiteralPath $logPath -Value ('Maintenance completed at ' + [DateTime]::UtcNow.ToString('o'))

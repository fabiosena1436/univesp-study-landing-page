param([string]$Container = 'repete-postgres')
$ErrorActionPreference = 'Stop'
if ($Container -notmatch '^[a-zA-Z0-9][a-zA-Z0-9_.-]*$') { throw 'Invalid container name.' }
$scriptPath = Join-Path $PSScriptRoot 'maintenance.ps1'
$nodePath = (Get-Command node -ErrorAction Stop).Source
$nodeDirectory = Split-Path -Parent $nodePath
$arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -Command "$env:PATH=''' + $nodeDirectory + ';''+$env:PATH; & ''' + $scriptPath + ''' -Container ''' + $Container + '''"'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Daily -At '02:00'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -MultipleInstances IgnoreNew -Hidden
$taskName = 'Aprova-UNIVESP-Manutencao-Local'
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) { throw 'The task already exists. Inspect it before changing its schedule.' }
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Local backup then cleanup; does not migrate or contact production services.' | Out-Null
Write-Output ('Task created: ' + $taskName + '. Daily at 02:00 in Windows time zone ' + (Get-TimeZone).Id + '.')

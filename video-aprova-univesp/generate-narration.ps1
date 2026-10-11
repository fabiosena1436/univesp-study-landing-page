$ErrorActionPreference = 'Stop'
$videoFolder = $PSScriptRoot
$audioFolder = Join-Path $videoFolder 'public/narracao'
New-Item -ItemType Directory -Path $audioFolder -Force | Out-Null
$voice = New-Object -ComObject SAPI.SpVoice
$maria = $voice.GetVoices() | Where-Object { $_.GetDescription() -match 'Maria.*Portuguese' } | Select-Object -First 1
if (-not $maria) { throw 'A voz Microsoft Maria em português não está instalada.' }
$voice.Voice = $maria
$voice.Volume = 100
$segments = Get-Content -LiteralPath (Join-Path $videoFolder 'narracao.json') -Raw -Encoding utf8 | ConvertFrom-Json
foreach ($segment in $segments) {
  $voice.Rate = 0
  $file = Join-Path $audioFolder ($segment.id + '.wav')
  $stream = New-Object -ComObject SAPI.SpFileStream
  $stream.Format.Type = 22
  $stream.Open($file, 3, $false)
  try {
    $voice.AudioOutputStream = $stream
    $null = $voice.Speak($segment.text, 0)
  } finally {
    $stream.Close()
  }
  Write-Output ($segment.id + ': narração salva')
}

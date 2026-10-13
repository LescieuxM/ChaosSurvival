param(
  [ValidateSet('dev', 'build', 'test', 'preview', 'install', 'start', 'dist', 'format', 'format:check', 'verify:music', 'verify:package', 'verify:portable')]
  [string]$Task = 'dev'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$localNodeMarker = Join-Path $projectRoot '.tools/node-path.txt'

if (Test-Path -LiteralPath $localNodeMarker) {
  $nodeFolder = Join-Path (Join-Path $projectRoot '.tools') ((Get-Content -LiteralPath $localNodeMarker -Raw).Trim())
  $nodeExecutable = Join-Path $nodeFolder 'node.exe'
  $npmCli = Join-Path $nodeFolder 'node_modules/npm/bin/npm-cli.js'
  $env:PATH = "$nodeFolder;$env:PATH"
} else {
  $nodeExecutable = (Get-Command node -ErrorAction Stop).Source
  $npmCli = Join-Path (Split-Path -Parent $nodeExecutable) 'node_modules/npm/bin/npm-cli.js'
}

if ($Task -eq 'install') {
  & $nodeExecutable $npmCli install --no-fund --no-audit
} else {
  if (!(Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules/vite')) -or
      !(Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules/electron/dist/electron.exe')) -or
      !(Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules/electron-builder'))) {
    Write-Host 'Installation des dépendances de Chaos Survival...'
    & $nodeExecutable $npmCli install --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
  & $nodeExecutable $npmCli run $Task
}
exit $LASTEXITCODE

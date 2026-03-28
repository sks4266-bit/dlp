$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

Write-Host "== Deploy started ==" -ForegroundColor Cyan

& "$PSScriptRoot\predeploy.ps1"

Write-Host "[4/4] API deploy" -ForegroundColor Yellow
cmd /c npx pnpm@9.12.0 --filter api deploy
if ($LASTEXITCODE -ne 0) { throw "API deploy failed" }

Write-Host "== Deploy finished successfully ==" -ForegroundColor Green

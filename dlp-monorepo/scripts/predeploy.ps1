$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

Write-Host "== Predeploy checks started ==" -ForegroundColor Cyan

Write-Host "[1/3] Install dependencies" -ForegroundColor Yellow
cmd /c npx pnpm@9.12.0 install
if ($LASTEXITCODE -ne 0) { throw "pnpm install failed" }

Write-Host "[2/3] API type-check" -ForegroundColor Yellow
cmd /c npx pnpm@9.12.0 --filter api typecheck
if ($LASTEXITCODE -ne 0) { throw "API type-check failed" }

Write-Host "[3/3] Web production build" -ForegroundColor Yellow
cmd /c npx pnpm@9.12.0 --filter web build
if ($LASTEXITCODE -ne 0) { throw "Web build failed" }

Write-Host "== Predeploy checks passed ==" -ForegroundColor Green

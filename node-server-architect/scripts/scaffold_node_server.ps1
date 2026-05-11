param(
  [Parameter(Mandatory = $false)]
  [string]$Root = ".",

  [Parameter(Mandatory = $false)]
  [ValidateSet("module", "layer")]
  [string]$Layout = "module",

  [Parameter(Mandatory = $false)]
  [ValidateSet("none", "express", "fastify")]
  [string]$Framework = "none",

  [switch]$WhatIf
)

$ErrorActionPreference = "Stop"

function Ensure-Dir([string]$Path) {
  if (Test-Path -LiteralPath $Path) { return }
  if ($WhatIf) { Write-Host "[WhatIf] mkdir $Path"; return }
  New-Item -ItemType Directory -Path $Path | Out-Null
  Write-Host "[OK] mkdir $Path"
}

function Ensure-File([string]$Path, [string]$Content) {
  if (Test-Path -LiteralPath $Path) { return }
  if ($WhatIf) { Write-Host "[WhatIf] write $Path"; return }
  $parent = Split-Path -Parent $Path
  if ($parent -and !(Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent | Out-Null }
  Set-Content -LiteralPath $Path -Value $Content -Encoding UTF8
  Write-Host "[OK] write $Path"
}

$rootPath = (Resolve-Path -LiteralPath $Root).Path

if ($Layout -eq "module") {
  $dirs = @(
    "src",
    "src/config",
    "src/modules",
    "src/shared/http",
    "src/shared/errors",
    "src/shared/logger",
    "src/shared/security",
    "src/shared/util",
    "src/types",
    "tests",
    "scripts"
  )
} else {
  $dirs = @(
    "src",
    "src/config",
    "src/routes",
    "src/controllers",
    "src/services",
    "src/repositories",
    "src/middleware",
    "src/validation",
    "src/shared",
    "src/types",
    "tests",
    "scripts"
  )
}

foreach ($d in $dirs) {
  Ensure-Dir (Join-Path $rootPath $d)
}

Ensure-File (Join-Path $rootPath "src/main.ts") @"
// Composition root. Keep wiring/bootstrap here (no business logic).
//
// Pick a framework (Express/Fastify/Nest) and start the server here.
//
// This file is intentionally a stub; fill it in according to your stack.
export {};
"@

if ($Framework -eq "express") {
  Ensure-File (Join-Path $rootPath "src/app.ts") @"
import express from "express";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  return app;
}
"@
} elseif ($Framework -eq "fastify") {
  Ensure-File (Join-Path $rootPath "src/app.ts") @"
import Fastify from "fastify";

export function createApp() {
  const app = Fastify({ logger: true });
  return app;
}
"@
}

Write-Host "[DONE] Scaffold complete at $rootPath"

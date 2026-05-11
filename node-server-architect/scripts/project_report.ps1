param(
  [Parameter(Mandatory = $false)]
  [string]$Root = "."
)

$ErrorActionPreference = "Stop"

function Test-AnyPath([string[]]$Paths) {
  foreach ($p in $Paths) {
    if (Test-Path -LiteralPath $p) { return $true }
  }
  return $false
}

$rootPath = (Resolve-Path -LiteralPath $Root).Path

$pkgPath = Join-Path $rootPath "package.json"
if (!(Test-Path -LiteralPath $pkgPath)) {
  Write-Host "[ERROR] package.json not found at $rootPath"
  exit 1
}

$pkg = Get-Content -LiteralPath $pkgPath -Raw | ConvertFrom-Json
$deps = @{}
foreach ($k in @("dependencies", "devDependencies", "peerDependencies", "optionalDependencies")) {
  if ($pkg.PSObject.Properties.Name -contains $k -and $pkg.$k) {
    foreach ($p in $pkg.$k.PSObject.Properties) {
      $deps[$p.Name] = $p.Value
    }
  }
}

$pm = "npm"
if (Test-Path -LiteralPath (Join-Path $rootPath "pnpm-lock.yaml")) { $pm = "pnpm" }
elseif (Test-Path -LiteralPath (Join-Path $rootPath "yarn.lock")) { $pm = "yarn" }

$framework = "unknown"
if ($deps.ContainsKey("@nestjs/core")) { $framework = "nestjs" }
elseif ($deps.ContainsKey("fastify")) { $framework = "fastify" }
elseif ($deps.ContainsKey("express")) { $framework = "express" }
elseif ($deps.ContainsKey("koa")) { $framework = "koa" }

$tsconfigPath = Join-Path $rootPath "tsconfig.json"
$hasTsconfig = Test-Path -LiteralPath $tsconfigPath
$hasTypeScriptDep = $deps.ContainsKey("typescript")

$eslintConfigured = Test-AnyPath @(
  (Join-Path $rootPath "eslint.config.js"),
  (Join-Path $rootPath ".eslintrc"),
  (Join-Path $rootPath ".eslintrc.js"),
  (Join-Path $rootPath ".eslintrc.cjs"),
  (Join-Path $rootPath ".eslintrc.json"),
  (Join-Path $rootPath ".eslintrc.yml"),
  (Join-Path $rootPath ".eslintrc.yaml")
)
$prettierConfigured = Test-AnyPath @(
  (Join-Path $rootPath "prettier.config.js"),
  (Join-Path $rootPath ".prettierrc"),
  (Join-Path $rootPath ".prettierrc.js"),
  (Join-Path $rootPath ".prettierrc.cjs"),
  (Join-Path $rootPath ".prettierrc.json"),
  (Join-Path $rootPath ".prettierrc.yml"),
  (Join-Path $rootPath ".prettierrc.yaml")
)

$scripts = @{}
if ($pkg.scripts) {
  foreach ($p in $pkg.scripts.PSObject.Properties) { $scripts[$p.Name] = $p.Value }
}

function Has-Script([string]$Name) { return $scripts.ContainsKey($Name) }

Write-Host "Project: $($pkg.name)"
Write-Host "Package manager: $pm"
Write-Host "Framework: $framework"
Write-Host ""

Write-Host ("TypeScript: " + ($(if ($hasTsconfig -and $hasTypeScriptDep) { "OK" } else { "MISSING/INCOMPLETE" })))
Write-Host ("ESLint config: " + ($(if ($eslintConfigured) { "OK" } else { "MISSING" })))
Write-Host ("Prettier config: " + ($(if ($prettierConfigured) { "OK" } else { "MISSING" })))
Write-Host ""

Write-Host "package.json scripts:"
foreach ($k in @("typecheck", "lint", "format", "test", "build", "dev", "start")) {
  if (Has-Script $k) {
    Write-Host ("  - " + $k + ": " + $scripts[$k])
  } else {
    Write-Host ("  - " + $k + ": (missing)")
  }
}

if ($hasTsconfig) {
  try {
    $ts = Get-Content -LiteralPath $tsconfigPath -Raw | ConvertFrom-Json
    $opts = $ts.compilerOptions
    if ($opts) {
      $strict = $opts.strict
      $outDir = $opts.outDir
      $rootDir = $opts.rootDir
      Write-Host ""
      Write-Host "tsconfig highlights:"
      Write-Host ("  - strict: " + ($(if ($strict -eq $true) { "true" } else { "false/unspecified" })))
      if ($rootDir) { Write-Host ("  - rootDir: " + $rootDir) }
      if ($outDir) { Write-Host ("  - outDir: " + $outDir) }
    }
  } catch {
    Write-Host ""
    Write-Host "[WARN] Failed to parse tsconfig.json (may contain comments)."
  }
}

Write-Host ""
Write-Host "Next actions (common):"
if (!$hasTsconfig) { Write-Host "  - Add tsconfig.json and set strict options" }
if (!$eslintConfigured) { Write-Host "  - Add ESLint config (TypeScript ESLint) and a lint script" }
if (!$prettierConfigured) { Write-Host "  - Add Prettier config and a format script" }
if (!(Has-Script "typecheck")) { Write-Host "  - Add package.json script: typecheck" }
if (!(Has-Script "lint")) { Write-Host "  - Add package.json script: lint" }
if (!(Has-Script "format")) { Write-Host "  - Add package.json script: format" }

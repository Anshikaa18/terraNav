# Script to create a clean, reproducible release archive (paths relative to repo root).
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$staging = Join-Path $repoRoot "terranav_release_staging"
$zipOutput = Join-Path $repoRoot "ChunkFlow_Release_v1.0.zip"

if (Test-Path $staging) {
    Remove-Item -Recurse -Force $staging
}
if (Test-Path $zipOutput) {
    Remove-Item -Force $zipOutput
}

New-Item -ItemType Directory -Path $staging | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging "terraNav") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging "ML") | Out-Null

function Copy-IfExists($source, $dest) {
    if (Test-Path $source) {
        Copy-Item $source $dest
    } else {
        Write-Warning "Skipping missing release input: $source"
    }
}

# 1. Optional root docs / trackers
$rootDocs = @(
    "TerraNav_Remaining_Work.md",
    "TerraNav_Pending_Work.md",
    "TerraNav_ChunkFlow_Pending_Tasks_v2.md",
    "TerraNav_ChunkFlow_Pending_Tasks.md",
    "TerraNav_ChunkFlow_Implementation_Roadmap.md",
    "TerraNav_Project_Audit.md",
    "benchmark_measurements.js"
)
foreach ($file in $rootDocs) {
    Copy-IfExists (Join-Path $repoRoot $file) (Join-Path $staging $file)
}

# 2. Copy ML directory (clean artifact set)
$mlFiles = @(
    "ChunkFlow_Trained_Models_and_Preprocessing.joblib",
    "compat.py",
    "chunkflow_pipeline.py",
    "chunkflow_inference.py",
    "build_bundle.py",
    "audit_and_evaluate.py",
    "audit_evaluation_results.json",
    "audit_feature_correlations.json",
    "ML_MODEL_AUDIT_REPORT.md",
    "README_ML_Handoff.md",
    "requirements.txt"
)
foreach ($file in $mlFiles) {
    Copy-IfExists (Join-Path $repoRoot "ML\$file") (Join-Path $staging "ML\$file")
}

# 3. Copy terraNav directory (no node_modules, no .git, no .env)
$terraRoot = Join-Path $repoRoot "terraNav"
Copy-IfExists (Join-Path $terraRoot "package.json") (Join-Path $staging "terraNav\package.json")
Copy-IfExists (Join-Path $terraRoot "package-lock.json") (Join-Path $staging "terraNav\package-lock.json")
Copy-IfExists (Join-Path $terraRoot ".env.example") (Join-Path $staging "terraNav\.env.example")
Copy-IfExists (Join-Path $terraRoot ".gitignore") (Join-Path $staging "terraNav\.gitignore")
Copy-IfExists (Join-Path $terraRoot "README.md") (Join-Path $staging "terraNav\README.md")
Copy-IfExists (Join-Path $terraRoot "requirements.md") (Join-Path $staging "terraNav\requirements.md")
Copy-IfExists (Join-Path $terraRoot "context.md") (Join-Path $staging "terraNav\context.md")

Copy-Item -Recurse (Join-Path $terraRoot "backend\api") (Join-Path $staging "terraNav\backend\api")
Copy-Item -Recurse (Join-Path $terraRoot "backend\database") (Join-Path $staging "terraNav\backend\database")
Copy-Item -Recurse (Join-Path $terraRoot "backend\tests") (Join-Path $staging "terraNav\backend\tests")
Copy-IfExists (Join-Path $terraRoot "backend\package.json") (Join-Path $staging "terraNav\backend\package.json")
Copy-IfExists (Join-Path $terraRoot "backend\.env.example") (Join-Path $staging "terraNav\backend\.env.example")

Copy-Item -Recurse (Join-Path $terraRoot "frontend\src") (Join-Path $staging "terraNav\frontend\src")
Copy-Item -Recurse (Join-Path $terraRoot "frontend\public") (Join-Path $staging "terraNav\frontend\public")
Copy-Item -Recurse (Join-Path $terraRoot "frontend\static") (Join-Path $staging "terraNav\frontend\static")
Copy-IfExists (Join-Path $terraRoot "frontend\index.html") (Join-Path $staging "terraNav\frontend\index.html")
Copy-IfExists (Join-Path $terraRoot "frontend\package.json") (Join-Path $staging "terraNav\frontend\package.json")
Copy-IfExists (Join-Path $terraRoot "frontend\package-lock.json") (Join-Path $staging "terraNav\frontend\package-lock.json")
Copy-IfExists (Join-Path $terraRoot "frontend\postcss.config.js") (Join-Path $staging "terraNav\frontend\postcss.config.js")
Copy-IfExists (Join-Path $terraRoot "frontend\tailwind.config.js") (Join-Path $staging "terraNav\frontend\tailwind.config.js")
Copy-IfExists (Join-Path $terraRoot "frontend\vite.config.js") (Join-Path $staging "terraNav\frontend\vite.config.js")
Copy-IfExists (Join-Path $terraRoot "frontend\README.md") (Join-Path $staging "terraNav\frontend\README.md")
Copy-IfExists (Join-Path $terraRoot "frontend\.env.example") (Join-Path $staging "terraNav\frontend\.env.example")
Copy-IfExists (Join-Path $terraRoot "frontend\.gitignore") (Join-Path $staging "terraNav\frontend\.gitignore")

if (Test-Path (Join-Path $terraRoot "docs")) {
    Copy-Item -Recurse (Join-Path $terraRoot "docs") (Join-Path $staging "terraNav\docs")
}
if (Test-Path (Join-Path $terraRoot "postman")) {
    Copy-Item -Recurse (Join-Path $terraRoot "postman") (Join-Path $staging "terraNav\postman")
}

$backupSqlFiles = Get-ChildItem -Recurse -Path $staging -Filter "*backup*.sql" -ErrorAction SilentlyContinue
if ($backupSqlFiles -and $backupSqlFiles.Count -gt 0) {
    foreach ($f in $backupSqlFiles) {
        Remove-Item -Force $f.FullName
    }
}

# Verify archive hygiene
$envFiles = Get-ChildItem -Recurse -Path $staging -Filter ".env" -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq ".env" }
if ($envFiles -and $envFiles.Count -gt 0) {
    Write-Error "Found real .env file in staging! Aborting release."
    exit 1
}

$staleZips = Get-ChildItem -Recurse -Path $staging -Filter "*.zip" -ErrorAction SilentlyContinue
if ($staleZips -and $staleZips.Count -gt 0) {
    Write-Error "Found zip archive in staging! Aborting release."
    exit 1
}

$forbidden = @("node_modules", ".git", ".vscode", ".idea", "__pycache__")
foreach ($name in $forbidden) {
    $hits = Get-ChildItem -Recurse -Path $staging -Directory -Filter $name -ErrorAction SilentlyContinue
    if ($hits -and $hits.Count -gt 0) {
        Write-Error "Forbidden directory '$name' found in staging. Aborting release."
        exit 1
    }
}

Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipOutput -CompressionLevel Optimal
Write-Output "Release archive created successfully: $zipOutput"
$zipSize = (Get-Item $zipOutput).Length / 1MB
Write-Output "Archive size: $([math]::Round($zipSize, 2)) MB"

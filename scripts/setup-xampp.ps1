# ============================================================================
# TradeCore XAMPP Local Setup Script
# ============================================================================
# Usage:
#   1. Ensure XAMPP is installed with Apache + MySQL running
#   2. Open PowerShell as Administrator
#   3. cd C:\Users\Administrator\OneDrive\Desktop\tradecore
#   4. .\scripts\setup-xampp.ps1
#
# What this script does:
#   - Builds the React/Vite frontend into dist/
#   - Creates the XAMPP deployment directory at C:\xampp\htdocs\tradecore\
#   - Copies all frontend + backend files into place
#   - Imports the MySQL database schema via XAMPP's mysql CLI
#   - Prints the local URL to open in your browser
# ============================================================================

param(
    [string]$XamppDir = "C:\xampp",
    [string]$DeployDir = "C:\xampp\htdocs\tradecore",
    [switch]$SkipBuild,
    [switch]$SkipDatabase
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot | Split-Path -Parent

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  TradeCore XAMPP Local Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ---- Check XAMPP installation ----
if (-not (Test-Path "$XamppDir\mysql\bin\mysql.exe")) {
    Write-Host "[ERROR] XAMPP not found at $XamppDir" -ForegroundColor Red
    Write-Host "  Install XAMPP from https://www.apachefriends.org/" -ForegroundColor Yellow
    Write-Host "  Or pass -XamppDir <path> if XAMPP is elsewhere." -ForegroundColor Yellow
    exit 1
}

# ---- Check Apache is running ----
try {
    $response = Invoke-WebRequest -Uri "http://localhost/" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    Write-Host "[OK] Apache is running on port 80" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Apache may not be running on port 80. Start Apache from XAMPP Control Panel." -ForegroundColor Yellow
    Write-Host "  Continuing anyway..." -ForegroundColor Yellow
}

# ---- Check MySQL is running ----
try {
    & "$XamppDir\mysql\bin\mysql.exe" -u root -e "SELECT 1" 2>$null | Out-Null
    Write-Host "[OK] MySQL is running and accessible" -ForegroundColor Green
} catch {
    Write-Host "[WARN] MySQL may not be running. Start MySQL from XAMPP Control Panel." -ForegroundColor Yellow
}

Write-Host ""

# ---- Step 1: Build the frontend ----
if (-not $SkipBuild) {
    Write-Host "[1/5] Building React/Vite frontend..." -ForegroundColor Cyan

    # Install dependencies if needed
    if (-not (Test-Path "$ProjectRoot\node_modules")) {
        Write-Host "  Installing npm dependencies..." -ForegroundColor Gray
        Push-Location $ProjectRoot
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] npm install failed" -ForegroundColor Red
            Pop-Location
            exit 1
        }
        Pop-Location
    }

    # Build
    Push-Location $ProjectRoot
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] npm run build failed" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
    Write-Host "  Build complete!" -ForegroundColor Green
} else {
    Write-Host "[1/5] Skipping build (using existing dist/)" -ForegroundColor Yellow
}

Write-Host ""

# ---- Step 2: Create deployment directory ----
Write-Host "[2/5] Creating deployment directory at $DeployDir..." -ForegroundColor Cyan

if (Test-Path $DeployDir) {
    Write-Host "  Removing existing deployment..." -ForegroundColor Gray
    Remove-Item -Recurse -Force $DeployDir
}

New-Item -ItemType Directory -Path $DeployDir -Force | Out-Null
New-Item -ItemType Directory -Path "$DeployDir\api" -Force | Out-Null
New-Item -ItemType Directory -Path "$DeployDir\cpanel\config" -Force | Out-Null
New-Item -ItemType Directory -Path "$DeployDir\cpanel\migrations" -Force | Out-Null

Write-Host "  Directory created." -ForegroundColor Green
Write-Host ""

# ---- Step 3: Copy frontend files ----
Write-Host "[3/5] Copying frontend files..." -ForegroundColor Cyan

# From dist/ (built Vite output)
if (Test-Path "$ProjectRoot\dist") {
    Copy-Item "$ProjectRoot\dist\*" -Destination $DeployDir -Recurse -Force
    Write-Host "  dist/ copied" -ForegroundColor Gray
} else {
    Write-Host "[ERROR] dist/ directory not found. Run without -SkipBuild first." -ForegroundColor Red
    exit 1
}

# .htaccess (SPA routing + API proxying)
if (Test-Path "$ProjectRoot\public\.htaccess") {
    Copy-Item "$ProjectRoot\public\.htaccess" -Destination "$DeployDir\.htaccess" -Force
    Write-Host "  .htaccess copied" -ForegroundColor Gray
}

# robots.txt
if (Test-Path "$ProjectRoot\public\robots.txt") {
    Copy-Item "$ProjectRoot\public\robots.txt" -Destination "$DeployDir\robots.txt" -Force
    Write-Host "  robots.txt copied" -ForegroundColor Gray
}

# sitemap.php
if (Test-Path "$ProjectRoot\public\sitemap.php") {
    Copy-Item "$ProjectRoot\public\sitemap.php" -Destination "$DeployDir\sitemap.php" -Force
    Write-Host "  sitemap.php copied" -ForegroundColor Gray
}

# manifest.json
if (Test-Path "$ProjectRoot\public\manifest.json") {
    Copy-Item "$ProjectRoot\public\manifest.json" -Destination "$DeployDir\manifest.json" -Force
    Write-Host "  manifest.json copied" -ForegroundColor Gray
}

# offline.html
if (Test-Path "$ProjectRoot\public\offline.html") {
    Copy-Item "$ProjectRoot\public\offline.html" -Destination "$DeployDir\offline.html" -Force
    Write-Host "  offline.html copied" -ForegroundColor Gray
}

# PWA icons
if (Test-Path "$ProjectRoot\public\icon-192.png") {
    Copy-Item "$ProjectRoot\public\icon-192.png" -Destination "$DeployDir\icon-192.png" -Force
    Copy-Item "$ProjectRoot\public\icon-512.png" -Destination "$DeployDir\icon-512.png" -Force
    Write-Host "  PWA icons copied" -ForegroundColor Gray
}

# version.json
if (Test-Path "$ProjectRoot\public\version.json") {
    Copy-Item "$ProjectRoot\public\version.json" -Destination "$DeployDir\version.json" -Force
    Write-Host "  version.json copied" -ForegroundColor Gray
}

# images directory (if exists)
if (Test-Path "$ProjectRoot\public\images") {
    Copy-Item "$ProjectRoot\public\images" -Destination "$DeployDir\images" -Recurse -Force
    Write-Host "  images/ copied" -ForegroundColor Gray
}

Write-Host "  Frontend files copied." -ForegroundColor Green
Write-Host ""

# ---- Step 4: Copy backend PHP files ----
Write-Host "[4/5] Copying PHP backend files..." -ForegroundColor Cyan

# cpanel/api.php (the main backend)
Copy-Item "$ProjectRoot\public\cpanel\api.php" -Destination "$DeployDir\cpanel\api.php" -Force
Write-Host "  cpanel/api.php copied" -ForegroundColor Gray

# cpanel/api_backup_500.php (extended backend)
if (Test-Path "$ProjectRoot\public\cpanel\api_backup_500.php") {
    Copy-Item "$ProjectRoot\public\cpanel\api_backup_500.php" -Destination "$DeployDir\cpanel\api_backup_500.php" -Force
    Write-Host "  cpanel/api_backup_500.php copied" -ForegroundColor Gray
}

# cpanel/config/db.php (production config - gets overridden by db.local.php)
Copy-Item "$ProjectRoot\public\cpanel\config\db.php" -Destination "$DeployDir\cpanel\config\db.php" -Force
Write-Host "  cpanel/config/db.php copied" -ForegroundColor Gray

# cpanel/config/db.local.php (XAMPP override)
Copy-Item "$ProjectRoot\public\cpanel\config\db.local.php" -Destination "$DeployDir\cpanel\config\db.local.php" -Force
Write-Host "  cpanel/config/db.local.php copied (XAMPP credentials)" -ForegroundColor Gray

# cpanel/migrations/
if (Test-Path "$ProjectRoot\public\cpanel\migrations") {
    Copy-Item "$ProjectRoot\public\cpanel\migrations\*" -Destination "$DeployDir\cpanel\migrations\" -Force
    Write-Host "  cpanel/migrations/ copied" -ForegroundColor Gray
}

# cpanel/database.sql (for reference)
Copy-Item "$ProjectRoot\public\cpanel\database.sql" -Destination "$DeployDir\cpanel\database.sql" -Force
Write-Host "  cpanel/database.sql copied" -ForegroundColor Gray

# api/php_sync.php (proxy to cpanel/api.php)
$phpSyncContent = @'
<?php
/**
 * php_sync.php — thin proxy that routes all requests to cpanel/api.php.
 * This file exists so the frontend's auto-discovery (/api/php_sync.php) resolves
 * to the real backend without needing Apache rewrite rules in all environments.
 */
require __DIR__ . '/../cpanel/api.php';
'@
Set-Content -Path "$DeployDir\api\php_sync.php" -Value $phpSyncContent -Encoding UTF8
Write-Host "  api/php_sync.php created (proxy)" -ForegroundColor Gray

# Also create api/api.php (second auto-discovery candidate)
Copy-Item "$DeployDir\api\php_sync.php" -Destination "$DeployDir\api\api.php" -Force
Write-Host "  api/api.php created (proxy)" -ForegroundColor Gray

Write-Host "  Backend files copied." -ForegroundColor Green
Write-Host ""

# ---- Step 5: Import MySQL database ----
if (-not $SkipDatabase) {
    Write-Host "[5/5] Importing MySQL database..." -ForegroundColor Cyan

    $mysqlPath = "$XamppDir\mysql\bin\mysql.exe"
    $sqlFile = "$ProjectRoot\scripts\setup-xampp-db.sql"

    if (-not (Test-Path $sqlFile)) {
        Write-Host "[ERROR] SQL file not found at $sqlFile" -ForegroundColor Red
        exit 1
    }

    try {
        Get-Content $sqlFile -Raw | & $mysqlPath -u root 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[WARN] MySQL import may have had warnings (this is usually OK)" -ForegroundColor Yellow
        } else {
            Write-Host "  Database imported successfully!" -ForegroundColor Green
        }
    } catch {
        Write-Host "[WARN] Could not auto-import database. Import manually:" -ForegroundColor Yellow
        Write-Host "  1. Open phpMyAdmin: http://localhost/phpmyadmin" -ForegroundColor Yellow
        Write-Host "  2. Click Import tab" -ForegroundColor Yellow
        Write-Host "  3. Select: $sqlFile" -ForegroundColor Yellow
        Write-Host "  4. Click Go" -ForegroundColor Yellow
    }
} else {
    Write-Host "[5/5] Skipping database import (-SkipDatabase)" -ForegroundColor Yellow
}

Write-Host ""

# ---- Done! ----
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend:  http://localhost/tradecore/" -ForegroundColor White
Write-Host "  API:       http://localhost/tradecore/cpanel/api.php?action=check_timestamp" -ForegroundColor White
Write-Host "  phpMyAdmin: http://localhost/phpmyadmin" -ForegroundColor White
Write-Host ""
Write-Host "  Deployment directory: $DeployDir" -ForegroundColor Gray
Write-Host ""
Write-Host "  Login credentials (from initialData.ts):" -ForegroundColor Yellow
Write-Host "    Username: root_mandate" -ForegroundColor White
Write-Host "    Password: (set during first login)" -ForegroundColor White
Write-Host "    Role:     Super Admin (ROOT_MANDATE)" -ForegroundColor White
Write-Host ""
Write-Host "  OR register a new company at:" -ForegroundColor Yellow
Write-Host "    http://localhost/tradecore/ (click Register)" -ForegroundColor White
Write-Host ""
Write-Host "  NOTE: db.local.php is present (XAMPP credentials)." -ForegroundColor Yellow
Write-Host "  DELETE it before deploying to production!" -ForegroundColor Red
Write-Host ""

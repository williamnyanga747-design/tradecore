param(
    [string]$Message = "",
    [string]$Version = ""
)

$ErrorActionPreference = "Stop"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
Set-Location "C:\Users\Administrator\OneDrive\Desktop\tradecore"

Write-Host "========================================" -ForegroundColor Yellow
Write-Host "   TRADECORE DEPLOYMENT WORKFLOW" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

# Check for changes
$status = git status --porcelain
if (-not $status) {
    Write-Host "No changes to deploy." -ForegroundColor Gray
    exit 0
}

# Show what changed
Write-Host "Changed files:" -ForegroundColor Cyan
git status --short
Write-Host ""

# Read current version from package.json
$packageJson = Get-Content "package.json" | ConvertFromJson
$currentVersion = $packageJson.version
Write-Host "Current version: v$currentVersion" -ForegroundColor Gray

# Version bump
if ($Version) {
    $newVersion = $Version
} else {
    Write-Host ""
    Write-Host "Version bump options:" -ForegroundColor Cyan
    Write-Host "  [M] Major (X.0.0) - Breaking changes" -ForegroundColor White
    Write-Host "  [m] Minor (0.X.0) - New features" -ForegroundColor White
    Write-Host "  [p] Patch (0.0.X) - Bug fixes" -ForegroundColor White
    Write-Host "  [s] Skip - Keep current version" -ForegroundColor White
    Write-Host ""
    $choice = Read-Host "Select version bump (M/m/p/s)"
    
    $parts = $currentVersion.Split('.')
    switch ($choice.ToUpper()) {
        "M" { $newVersion = "$([int]$parts[0] + 1).0.0" }
        "M" { $newVersion = "$([int]$parts[0] + 1).0.0" }
        "P" { $newVersion = "$($parts[0]).$($parts[1]).$([int]$parts[2] + 1)" }
        default { $newVersion = $currentVersion }
    }
}

Write-Host ""
Write-Host "New version: v$newVersion" -ForegroundColor Green

# Update package.json
$packageJson.version = $newVersion
$packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json"

# Update version.json
$versionJson = @{
    version = $newVersion
    name = "TradeCore ERP"
    date = Get-Date -Format "yyyy-MM-dd"
    description = $Message
}
$versionJson | ConvertTo-Json | Set-Content "public/version.json"

Write-Host "Updated package.json and version.json" -ForegroundColor Cyan

# Ask for commit message if not provided
if (-not $Message) {
    $Message = Read-Host "Enter commit message (or press Enter for default)"
    if (-not $Message) {
        $Message = "release: v$newVersion"
    }
}

# Ensure .cpanel.yml exists
if (-not (Test-Path ".cpanel.yml")) {
    Write-Host "ERROR: .cpanel.yml not found!" -ForegroundColor Red
    exit 1
}

# Deploy
Write-Host ""
Write-Host "[1/4] Staging files..." -ForegroundColor Cyan
git add .

Write-Host "[2/4] Committing: $Message" -ForegroundColor Cyan
git commit -m "release: v$newVersion - $Message"

Write-Host "[3/4] Creating git tag v$newVersion..." -ForegroundColor Cyan
git tag -a "v$newVersion" -m "Release v$newVersion - $Message"

Write-Host "[4/4] Pushing to GitHub with tags..." -ForegroundColor Cyan
git push origin main --tags

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   PUSH COMPLETE! Version: v$newVersion" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. Deploy on cPanel:" -ForegroundColor White
Write-Host "   - Go to cPanel -> Git Version Control" -ForegroundColor White
Write-Host "   - Click 'tradecore'" -ForegroundColor White
Write-Host "   - Click 'Pull or Deploy' tab" -ForegroundColor White
Write-Host "   - Click 'Update from Remote'" -ForegroundColor White
Write-Host "   - Click 'Deploy Head Commit'" -ForegroundColor White
Write-Host ""
Write-Host "2. Create GitHub Release:" -ForegroundColor White
Write-Host "   - Go to https://github.com/williamnyanga747-design/tradecore/releases" -ForegroundColor White
Write-Host "   - Click 'Create new release'" -ForegroundColor White
Write-Host "   - Select tag: v$newVersion" -ForegroundColor White
Write-Host "   - Add release notes from CHANGELOG.md" -ForegroundColor White
Write-Host ""
Write-Host "Your site: https://tanzaniatradecore.co.tz" -ForegroundColor Cyan

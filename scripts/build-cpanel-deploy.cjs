const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");
const stage = path.join(root, "cpanel_deploy_stage");
const zipPath = path.join(root, "cpanel_tradecore_deploy.zip");

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: true });
  if (res.status !== 0) {
    console.error(`Command failed: ${cmd} ${args.join(" ")}`);
    process.exit(res.status || 1);
  }
}

function copy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copy(srcPath, destPath);
    }
  }
}

console.log("=== 1/2 Building frontend (vite) ===");
run("npm", ["run", "build"]);

console.log("=== 2/2 Assembling cPanel deploy ZIP ===");
if (fs.existsSync(stage)) {
  fs.rmSync(stage, { recursive: true, force: true });
}
fs.mkdirSync(path.join(stage, "api"), { recursive: true });
fs.mkdirSync(path.join(stage, "assets"), { recursive: true });

// --- Frontend files ---
copy(path.join(distDir, "index.html"), path.join(stage, "index.html"));
copy(path.join(distDir, ".htaccess"), path.join(stage, ".htaccess"));
copy(path.join(distDir, "sitemap.php"), path.join(stage, "sitemap.php"));
copy(path.join(distDir, "robots.txt"), path.join(stage, "robots.txt"));
copy(
  path.join(distDir, "CPANEL_DEPLOYMENT_INSTRUCTIONS.txt"),
  path.join(stage, "CPANEL_DEPLOYMENT_INSTRUCTIONS.txt")
);

// --- PWA artifacts ---
const pwaFiles = ["manifest.json", "sw.js", "offline.html", "icon-192.png", "icon-512.png"];
for (const f of pwaFiles) {
  const src = path.join(distDir, f);
  if (fs.existsSync(src)) copy(src, path.join(stage, f));
}

// --- PHP Backend (cpanel/ directory structure) ---
// The .htaccess routes /api/* to cpanel/api.php, so we need the full cpanel/ dir.
const cpanelSrc = path.join(distDir, "cpanel");
const cpanelDest = path.join(stage, "cpanel");
fs.mkdirSync(path.join(cpanelDest, "config"), { recursive: true });
fs.mkdirSync(path.join(cpanelDest, "migrations"), { recursive: true });

// Core PHP files
copy(path.join(cpanelSrc, "api.php"), path.join(cpanelDest, "api.php"));
copy(path.join(cpanelSrc, "api_backup_500.php"), path.join(cpanelDest, "api_backup_500.php"));
copy(path.join(cpanelSrc, "api_entities.php"), path.join(cpanelDest, "api_entities.php"));
copy(path.join(cpanelSrc, "database.sql"), path.join(cpanelDest, "database.sql"));

// Config — include db.php (production credentials), but NOT db.local.php (dev only)
copy(path.join(cpanelSrc, "config", "db.php"), path.join(cpanelDest, "config", "db.php"));
copy(path.join(cpanelSrc, "config", ".htaccess"), path.join(cpanelDest, "config", ".htaccess"));

// Migrations — include all SQL migration files
const migrationsSrc = path.join(cpanelSrc, "migrations");
if (fs.existsSync(migrationsSrc)) {
  for (const f of fs.readdirSync(migrationsSrc)) {
    if (f.endsWith(".sql")) {
      copy(path.join(migrationsSrc, f), path.join(cpanelDest, "migrations", f));
    }
  }
}

// --- Backward-compatible aliases at root level ---
// Some setups route directly to api.php at root; provide copies for compatibility.
const apiSource = path.join(cpanelSrc, "api.php");
copy(apiSource, path.join(stage, "api.php"));
copy(apiSource, path.join(stage, "api", "api.php"));
copy(apiSource, path.join(stage, "api", "php_sync.php"));

// database.sql at root for phpMyAdmin import convenience
copy(path.join(cpanelSrc, "database.sql"), path.join(stage, "database.sql"));

// --- Compiled assets ---
const assetsSrc = path.join(distDir, "assets");
for (const f of fs.readdirSync(assetsSrc)) {
  const full = path.join(assetsSrc, f);
  if (fs.statSync(full).isFile()) {
    copy(full, path.join(stage, "assets", f));
  }
}

// --- Create ZIP ---
if (fs.existsSync(zipPath)) {
  fs.rmSync(zipPath, { force: true });
}
const psCommand = `Compress-Archive -Path '${path.join(stage, "*")}' -DestinationPath '${zipPath}' -CompressionLevel Optimal -Force`;
const zipRes = spawnSync("powershell", ["-NoProfile", "-Command", psCommand], { stdio: "inherit" });
if (zipRes.status !== 0) {
  console.error("Failed to create zip archive");
  process.exit(1);
}

fs.rmSync(stage, { recursive: true, force: true });

console.log("\nDeploy package ready:");
console.log("  " + zipPath);
console.log("\nContents:");
console.log("  - index.html, .htaccess, robots.txt, sitemap.php (SPA frontend)");
console.log("  - assets/ (compiled JS/CSS)");
console.log("  - cpanel/api.php, api_entities.php, api_backup_500.php (PHP backend)");
console.log("  - cpanel/config/db.php (production DB credentials)");
console.log("  - cpanel/migrations/*.sql (database schema + atomic tables)");
console.log("  - cpanel/database.sql (full schema for fresh install)");
console.log("  - api/api.php, api/php_sync.php (backward-compatible aliases)");
console.log("  - manifest.json, sw.js, offline.html, icons (PWA)");

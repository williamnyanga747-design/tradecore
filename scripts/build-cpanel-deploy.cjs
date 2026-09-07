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

console.log("=== 1/2 Building frontend (vite) ===");
run("npm", ["run", "build"]);

console.log("=== 2/2 Assembling cPanel deploy ZIP ===");
if (fs.existsSync(stage)) {
  fs.rmSync(stage, { recursive: true, force: true });
}
fs.mkdirSync(path.join(stage, "api"), { recursive: true });
fs.mkdirSync(path.join(stage, "assets"), { recursive: true });

copy(path.join(distDir, "index.html"), path.join(stage, "index.html"));
copy(path.join(distDir, ".htaccess"), path.join(stage, ".htaccess"));
copy(path.join(distDir, "sitemap.php"), path.join(stage, "sitemap.php"));
copy(path.join(distDir, "robots.txt"), path.join(stage, "robots.txt"));
copy(
  path.join(distDir, "CPANEL_DEPLOYMENT_INSTRUCTIONS.txt"),
  path.join(stage, "CPANEL_DEPLOYMENT_INSTRUCTIONS.txt")
);
copy(path.join(distDir, "cpanel", "database.sql"), path.join(stage, "database.sql"));

// PWA artifacts (copied verbatim from public/ into dist by Vite)
const pwaFiles = ["manifest.json", "sw.js", "offline.html", "icon-192.png", "icon-512.png"];
for (const f of pwaFiles) {
  const src = path.join(distDir, f);
  if (fs.existsSync(src)) copy(src, path.join(stage, f));
}

const apiSource = path.join(distDir, "cpanel", "api.php");
copy(apiSource, path.join(stage, "api.php"));
copy(apiSource, path.join(stage, "api", "api.php"));
copy(apiSource, path.join(stage, "api", "php_sync.php"));

const assetsSrc = path.join(distDir, "assets");
for (const f of fs.readdirSync(assetsSrc)) {
  const full = path.join(assetsSrc, f);
  if (fs.statSync(full).isFile()) {
    copy(full, path.join(stage, "assets", f));
  }
}

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

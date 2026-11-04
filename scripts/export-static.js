const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const nextDir = path.join(rootDir, ".next");
const outDir = path.join(rootDir, "out");
const serverAppDir = path.join(nextDir, "server", "app");
const staticDir = path.join(nextDir, "static");
const publicDir = path.join(rootDir, "public");

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  // 1. Prepare out directory
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  // 2. Copy static chunks to out/_next/static
  if (fs.existsSync(staticDir)) {
    copyDirSync(staticDir, path.join(outDir, "_next", "static"));
  }

  // 3. Copy public assets if any
  if (fs.existsSync(publicDir)) {
    copyDirSync(publicDir, outDir);
  }

  // 4. Copy pre-rendered HTML files
  if (fs.existsSync(serverAppDir)) {
    const files = fs.readdirSync(serverAppDir);
    for (const file of files) {
      if (file.endsWith(".html")) {
        const srcPath = path.join(serverAppDir, file);
        if (file === "index.html") {
          fs.copyFileSync(srcPath, path.join(outDir, "index.html"));
        } else if (file === "_not-found.html") {
          fs.copyFileSync(srcPath, path.join(outDir, "404.html"));
          fs.copyFileSync(srcPath, path.join(outDir, "_not-found.html"));
        } else {
          // e.g. collection.html -> out/collection.html and out/collection/index.html
          const baseName = file.replace(/\.html$/, "");
          fs.copyFileSync(srcPath, path.join(outDir, file));
          const subDir = path.join(outDir, baseName);
          fs.mkdirSync(subDir, { recursive: true });
          fs.copyFileSync(srcPath, path.join(subDir, "index.html"));
        }
      }
    }
  }

  console.log("Static export successfully generated in /out directory.");
} catch (err) {
  console.error("Error generating static export:", err);
  process.exit(1);
}

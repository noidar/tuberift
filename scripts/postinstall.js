#!/usr/bin/env node

// Downloads yt-dlp binary into bin/ after `npm install`

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const BIN_DIR = path.join(__dirname, "..", "bin");
const YTDLP_API = "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest";

function getYtdlpBinaryName() {
  const platform = process.env.npm_config_platform || process.platform;
  const arch = process.env.npm_config_arch || process.arch;
  if (platform === "win32") return "yt-dlp.exe";
  if (platform === "darwin") return "yt-dlp_macos";
  if (platform === "linux" && arch === "arm64") return "yt-dlp_linux_aarch64";
  return "yt-dlp_linux";
}

function getOutputName() {
  return process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
}

function get(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, { headers: { "User-Agent": "yt-downloader" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return get(res.headers.location).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        resolve(res);
      })
      .on("error", reject);
  });
}

async function getLatestTag(apiUrl) {
  const res = await get(apiUrl);
  let body = "";
  for await (const chunk of res) body += chunk;
  return JSON.parse(body).tag_name;
}

async function downloadFile(url, dest, label) {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await get(url);
      const total = parseInt(res.headers["content-length"], 10) || 0;
      let downloaded = 0;
      const file = fs.createWriteStream(dest);
      res.on("data", (chunk) => {
        downloaded += chunk.length;
        if (total > 0) {
          const pct = Math.round((downloaded / total) * 100);
          process.stdout.write(`\r  Downloading ${label}... ${pct}%`);
        }
      });
      res.pipe(file);
      file.on("finish", () => { file.close(); process.stdout.write("\n"); resolve(); });
      file.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

async function main() {
  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
  }

  const outputName = getOutputName();
  const outputPath = path.join(BIN_DIR, outputName);

  if (fs.existsSync(outputPath)) {
    console.log(`  ✓ yt-dlp already present at bin/${outputName}`);
    return;
  }

  console.log("  Downloading yt-dlp...");
  const binaryName = getYtdlpBinaryName();

  try {
    const tag = await getLatestTag(YTDLP_API);
    const downloadUrl = `https://github.com/yt-dlp/yt-dlp/releases/download/${tag}/${binaryName}`;
    console.log(`  Version: ${tag}, binary: ${binaryName}`);
    await downloadFile(downloadUrl, outputPath, "yt-dlp");
    if (process.platform !== "win32") {
      fs.chmodSync(outputPath, 0o755);
    }
    console.log(`  ✓ yt-dlp installed to bin/${outputName}`);
  } catch (err) {
    console.error(`  ✗ Failed to download yt-dlp: ${err.message}`);
    console.error("    Download manually from: https://github.com/yt-dlp/yt-dlp/releases");
    console.error(`    Place the binary at: bin/${outputName}`);
  }
}

main();

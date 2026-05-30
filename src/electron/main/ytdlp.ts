import { spawn, execFile } from "child_process";
import path from "path";
import fs from "fs";
import type { VideoInfo, VideoFormat, QualityPreset, DownloadOptions } from "../../shared/types";
import { log, logError } from "./utils";

function getFfmpegPath(): string {
  const ext = process.platform === "win32" ? ".exe" : "";

  try {
    const resBase = process.resourcesPath || "";
    const candidates = [
      path.join(resBase, "ffmpeg-static", "ffmpeg" + ext),
      path.join(resBase, "ffmpeg-static", "ffmpeg"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        log("Using extraResources ffmpeg:", p);
        return p;
      }
    }
  } catch {
    // ignore
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStatic: string = require("ffmpeg-static");
    if (ffmpegStatic) {
      const unpackedPath = ffmpegStatic.replace("app.asar", "app.asar.unpacked");
      if (fs.existsSync(unpackedPath)) {
        log("Using unpacked ffmpeg-static:", unpackedPath);
        return unpackedPath;
      }
      if (fs.existsSync(ffmpegStatic)) {
        log("Using ffmpeg-static:", ffmpegStatic);
        return ffmpegStatic;
      }
    }
  } catch {
    // ignore
  }

  log("Falling back to system ffmpeg");
  return "ffmpeg";
}

function getYtdlpPath(): string | null {
  const ext = process.platform === "win32" ? ".exe" : "";
  const binary = "yt-dlp" + ext;

  try {
    const resPath = path.join(process.resourcesPath || "", "bin", binary);
    if (fs.existsSync(resPath)) {
      log("Using extraResources yt-dlp:", resPath);
      return resPath;
    }
  } catch {
    // ignore
  }

  const devPath = path.join(__dirname, "..", "..", "..", "bin", binary);
  if (fs.existsSync(devPath)) {
    log("Using dev yt-dlp:", devPath);
    return devPath;
  }

  logError("yt-dlp binary not found!");
  return null;
}

export function checkDeps() {
  const ytdlpPath = getYtdlpPath();
  const ffmpegPath = getFfmpegPath();
  return {
    ytdlp: { found: !!ytdlpPath, path: ytdlpPath },
    ffmpeg: { found: !!ffmpegPath && ffmpegPath !== "ffmpeg", path: ffmpegPath },
  };
}

function execVersion(binPath: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(binPath, args, { encoding: "utf8", timeout: 10000 }, (err, stdout) => {
      if (err) {
        return resolve(null);
      }
      resolve(stdout);
    });
  });
}

export async function getVersions() {
  const versions = { ytdlp: null as string | null, ffmpeg: null as string | null };

  const ytdlpPath = getYtdlpPath();
  if (ytdlpPath) {
    try {
      const out = await execVersion(ytdlpPath, ["--version"]);
      if (out) {
        versions.ytdlp = out.trim();
      }
    } catch (err) {
      logError("yt-dlp version check failed:", (err as Error).message);
    }
  }

  const ffmpegPath = getFfmpegPath();
  if (ffmpegPath && ffmpegPath !== "ffmpeg") {
    try {
      const out = await execVersion(ffmpegPath, ["-version"]);
      if (out) {
        const match = out.match(/ffmpeg version (\S+)/);
        versions.ffmpeg = match ? match[1] : out.split("\n")[0].trim();
      }
    } catch (err) {
      logError("ffmpeg version check failed:", (err as Error).message);
    }
  }

  return versions;
}

interface RawFormat {
  format_id: string;
  ext: string;
  height?: number;
  fps?: number;
  vcodec?: string;
  acodec?: string;
  filesize?: number;
  filesize_approx?: number;
  tbr?: number;
  format_note?: string;
}

function cleanInfo(raw: Record<string, unknown>): VideoInfo {
  const rawFormats = (raw.formats as RawFormat[]) || [];
  const formats: VideoFormat[] = rawFormats.map((f) => ({
    format_id: f.format_id,
    ext: f.ext,
    height: f.height ?? null,
    fps: f.fps ?? null,
    vcodec: f.vcodec || "none",
    acodec: f.acodec || "none",
    filesize: f.filesize || f.filesize_approx || null,
    tbr: f.tbr ?? null,
    format_note: f.format_note || "",
  }));

  return {
    id: raw.id as string,
    title: (raw.title as string) || (raw.id as string),
    thumbnail: (raw.thumbnail as string) || null,
    duration: (raw.duration as number) || null,
    duration_string: (raw.duration_string as string) || null,
    uploader: (raw.uploader as string) || (raw.channel as string) || "",
    uploader_id: (raw.uploader_id as string) || (raw.channel_id as string) || "",
    channel: (raw.channel as string) || "",
    channel_url: (raw.channel_url as string) || "",
    view_count: (raw.view_count as number) || null,
    like_count: (raw.like_count as number) || null,
    upload_date: (raw.upload_date as string) || null,
    description: (raw.description as string) || null,
    categories: (raw.categories as string[]) || [],
    tags: (raw.tags as string[]) || [],
    extractor: (raw.extractor as string) || "",
    extractor_key: (raw.extractor_key as string) || "",
    webpage_url: (raw.webpage_url as string) || "",
    webpage_url_domain: (raw.webpage_url_domain as string) || "",
    age_limit: (raw.age_limit as number) || 0,
    live_status: (raw.live_status as string) || "not_live",
    formats,
    _fetched_at: Date.now(),
  };
}

export function buildPresets(formats: VideoFormat[]): QualityPreset[] {
  const heightSet = new Set<number>();
  for (const f of formats) {
    if (f.height) {
      heightSet.add(f.height);
    }
  }

  const heights = [...heightSet].sort((a, b) => b - a);
  const tags: Record<number, string> = { 2160: "4K", 1440: "2K", 1080: "Full HD", 720: "HD" };

  function estimateSize(h: number): number | null {
    const matching = formats.filter((f) => f.height === h && f.filesize);
    if (matching.length === 0) {
      return null;
    }
    return Math.max(...matching.map((f) => f.filesize!));
  }

  function formatBytes(bytes: number | null): string | null {
    if (!bytes) {
      return null;
    }
    if (bytes >= 1e9) {
      return (bytes / 1e9).toFixed(1) + " GB";
    }
    if (bytes >= 1e6) {
      return (bytes / 1e6).toFixed(1) + " MB";
    }
    return (bytes / 1e3).toFixed(0) + " KB";
  }

  const presets: QualityPreset[] = [];

  if (heights.length > 0) {
    presets.push({
      id: "best",
      label: "Best",
      tag: "",
      size: null,
      formatId: "bv*+ba/b",
      type: "video",
    });
  }

  for (const h of heights) {
    presets.push({
      id: `${h}p`,
      label: `${h}p`,
      tag: tags[h] || "",
      size: formatBytes(estimateSize(h)),
      formatId: `bv*[height<=${h}]+ba/b[height<=${h}]/b`,
      type: "video",
    });
  }

  const audioStreams = formats
    .filter((f) => f.vcodec === "none" && f.acodec !== "none" && f.filesize)
    .sort((a, b) => (b.tbr || 0) - (a.tbr || 0));

  const audioSize = (filterFn: (f: VideoFormat) => boolean): number | null => {
    const match = audioStreams.find(filterFn);
    return (match || audioStreams[0])?.filesize || null;
  };

  presets.push({
    id: "audio-mp3",
    label: "MP3",
    tag: "Audio",
    size: formatBytes(audioSize(() => true)),
    formatId: "ba/b",
    type: "audio",
    audioFormat: "mp3",
  });

  presets.push({
    id: "audio-m4a",
    label: "M4A",
    tag: "Audio",
    size: formatBytes(audioSize((f) => f.ext === "m4a")),
    formatId: "ba[ext=m4a]/ba/b",
    type: "audio",
    audioFormat: "m4a",
  });

  return presets;
}

export interface FetchInfoResult {
  info: VideoInfo;
}

export function fetchInfo(
  url: string,
  { onLog, cookiesBrowser }: { onLog?: (msg: string) => void; cookiesBrowser?: string } = {}
): Promise<FetchInfoResult> {
  const ytdlpBin = getYtdlpPath();
  if (!ytdlpBin) {
    throw new Error("yt-dlp not found. Run npm install to download it.");
  }

  const _log = (msg: string) => {
    log(msg);
    if (onLog) {
      onLog(msg);
    }
  };

  _log("Launching yt-dlp...");

  const args = [
    "--dump-json",
    "--no-playlist",
    "--no-warnings",
    "--ignore-config",
    "--no-check-formats",
    "--socket-timeout",
    "30",
  ];

  if (cookiesBrowser) {
    args.push("--cookies-from-browser", cookiesBrowser);
  }

  const ffmpeg = getFfmpegPath();
  if (ffmpeg && ffmpeg !== "ffmpeg") {
    args.push("--ffmpeg-location", path.dirname(ffmpeg));
  }
  args.push(url);

  return new Promise((resolve, reject) => {
    const proc = spawn(ytdlpBin, args);
    let stdout = "";
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      try {
        proc.kill("SIGTERM");
      } catch {
        // ignore
      }
      reject(new Error("Fetch timed out after 60 seconds"));
    }, 60000);

    proc.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
      _log("Receiving video data...");
    });

    proc.stderr.on("data", (d: Buffer) => {
      const text = d.toString();
      stderr += text;
      for (const line of text.split("\n")) {
        const t = line.trim();
        if (t && t.length < 200) {
          _log(t);
        }
      }
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (killed) {
        return;
      }
      if (code !== 0) {
        const msg = stderr.trim() || `yt-dlp exited with code ${code}`;
        logError("Fetch failed:", msg);
        return reject(new Error(msg));
      }
      try {
        const raw = JSON.parse(stdout);
        const info = cleanInfo(raw);
        _log(`Found: ${info.title}`);
        resolve({ info });
      } catch (e) {
        logError("Parse failed:", (e as Error).message);
        reject(new Error("Failed to parse video info"));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      if (killed) {
        return;
      }
      logError("Spawn error:", err.message);
      reject(new Error(`Cannot run yt-dlp: ${err.message}`));
    });
  });
}

export interface DownloadCallbacks {
  onProgress: (p: { percent: string; speed: string; eta: string }) => void;
  onLog: (msg: string) => void;
  _proc?: ReturnType<typeof spawn>;
}

export function download(
  {
    url,
    formatId,
    outputDir,
    extractAudio,
    audioFormat,
    options,
  }: {
    url: string;
    formatId: string;
    outputDir: string;
    extractAudio: boolean;
    audioFormat: string;
    options?: Partial<DownloadOptions>;
  },
  callbacks: DownloadCallbacks
): Promise<{ ok: boolean }> {
  const { onProgress, onLog } = callbacks;
  const ytdlpBin = getYtdlpPath();
  if (!ytdlpBin) {
    throw new Error("yt-dlp not found");
  }

  onLog("Starting download...");

  const args = [
    "--newline",
    "--no-warnings",
    "--ignore-config",
    "--no-playlist",
    "--socket-timeout",
    "30",
    "--progress-template",
    "download:DLPROG %(progress._percent_str)s %(progress._speed_str)s %(progress._eta_str)s",
    "-o",
    path.join(outputDir, "%(title)s [%(id)s].%(ext)s"),
  ];

  const ffmpeg = getFfmpegPath();
  if (ffmpeg && ffmpeg !== "ffmpeg") {
    args.push("--ffmpeg-location", path.dirname(ffmpeg));
  }

  if (extractAudio) {
    args.push("-x", "--audio-format", audioFormat || "mp3", "--audio-quality", "0");
  } else if (formatId) {
    args.push("-f", formatId, "--merge-output-format", "mp4");
    args.push("--postprocessor-args", "ffmpeg:-c:v copy -c:a aac");
  }

  // Subtitles
  if (options?.writeSubs && !extractAudio) {
    args.push("--write-subs", "--write-auto-subs");
    args.push("--sub-langs", options.subLangs || "en");
    if (options.embedSubs) {
      args.push("--embed-subs");
    }
  }

  // Metadata embedding
  if (options?.embedMetadata) {
    args.push("--embed-metadata");
  }
  if (options?.embedThumbnail) {
    args.push("--embed-thumbnail");
  }

  // SponsorBlock
  if (options?.sponsorBlock && options.sponsorBlockCategories?.length) {
    args.push("--sponsorblock-remove", options.sponsorBlockCategories.join(","));
  }

  // Rate limiting
  if (options?.rateLimit && options.rateLimit.trim()) {
    args.push("--limit-rate", options.rateLimit.trim());
  }

  // Cookie auth for protected videos
  if (options?.cookiesBrowser) {
    args.push("--cookies-from-browser", options.cookiesBrowser);
  }

  args.push(url);

  return new Promise((resolve, reject) => {
    const proc = spawn(ytdlpBin, args);
    callbacks._proc = proc;

    function parseOutput(data: Buffer) {
      const text = data.toString();
      for (const line of text.split("\n")) {
        if (line.startsWith("DLPROG ")) {
          const parts = line.slice(7).trim().split(/\s+/);
          onProgress({
            percent: (parts[0] || "0%").trim(),
            speed: (parts[1] || "").trim(),
            eta: (parts[2] || "").trim(),
          });
          continue;
        }
        const trimmed = line.trim();
        if (
          trimmed &&
          !trimmed.startsWith("WARNING") &&
          (trimmed.startsWith("[download]") ||
            trimmed.startsWith("[Merger]") ||
            trimmed.startsWith("[ExtractAudio]") ||
            trimmed.startsWith("[info]"))
        ) {
          onLog(trimmed);
        }
      }
    }

    proc.stdout.on("data", parseOutput);

    let stderrBuf = "";
    proc.stderr.on("data", (d: Buffer) => {
      stderrBuf += d.toString();
      parseOutput(d);
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        const msg = stderrBuf.trim() || `yt-dlp exited with code ${code}`;
        logError("Download failed:", msg);
        onLog("Download failed.");
        return reject(new Error(msg));
      }
      onLog("Download complete ✓");
      resolve({ ok: true });
    });

    proc.on("error", (err) => {
      logError("Download spawn error:", err.message);
      reject(new Error(`Cannot run yt-dlp: ${err.message}`));
    });
  });
}

export interface PlaylistItem {
  id: string;
  title: string;
  url: string;
  duration: number | null;
  duration_string: string | null;
  thumbnail: string | null;
  uploader: string;
  _playlist_index: number;
}

export interface FetchPlaylistResult {
  items: PlaylistItem[];
}

export function fetchPlaylist(
  url: string,
  { onLog, onItem, cookiesBrowser }: { onLog?: (msg: string) => void; onItem?: (item: PlaylistItem, count: number) => void; cookiesBrowser?: string } = {}
): Promise<FetchPlaylistResult> {
  const ytdlpBin = getYtdlpPath();
  if (!ytdlpBin) {
    throw new Error("yt-dlp not found. Run npm install to download it.");
  }

  const _log = (msg: string) => {
    log(msg);
    if (onLog) { onLog(msg); }
  };

  _log("Fetching playlist...");

  const args = [
    "--flat-playlist",
    "--dump-json",
    "--no-warnings",
    "--ignore-config",
    "--socket-timeout",
    "30",
  ];

  if (cookiesBrowser) {
    args.push("--cookies-from-browser", cookiesBrowser);
  }

  const ffmpeg = getFfmpegPath();
  if (ffmpeg && ffmpeg !== "ffmpeg") {
    args.push("--ffmpeg-location", path.dirname(ffmpeg));
  }
  args.push(url);

  return new Promise((resolve, reject) => {
    const proc = spawn(ytdlpBin, args);
    let stderr = "";
    const items: PlaylistItem[] = [];
    let buffer = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      try { proc.kill("SIGTERM"); } catch { /* ignore */ }
      if (items.length > 0) {
        _log(`Timed out after ${items.length} items`);
        resolve({ items });
      } else {
        reject(new Error("Playlist fetch timed out"));
      }
    }, 180000);

    proc.stdout.on("data", (d: Buffer) => {
      buffer += d.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) { continue; }
        try {
          const raw = JSON.parse(trimmed);
          const rawUrl: string = raw.webpage_url || raw.url || "";
          const videoId: string = raw.id || "";
          const resolvedUrl =
            rawUrl.startsWith("http")
              ? rawUrl
              : videoId
                ? `https://www.youtube.com/watch?v=${videoId}`
                : rawUrl;
          const item: PlaylistItem = {
            id: videoId,
            title: raw.title || videoId || "Untitled",
            url: resolvedUrl,
            duration: raw.duration || null,
            duration_string: raw.duration_string || null,
            thumbnail: raw.thumbnails?.[0]?.url || raw.thumbnail || null,
            uploader: raw.uploader || raw.channel || "",
            _playlist_index: items.length + 1,
          };
          items.push(item);
          if (onItem) { onItem(item, items.length); }
          _log(`Found ${items.length}: ${item.title}`);
        } catch { /* skip non-JSON lines */ }
      }
    });

    proc.stderr.on("data", (d: Buffer) => {
      const text = d.toString();
      stderr += text;
      for (const line of text.split("\n")) {
        const t = line.trim();
        if (t && !t.startsWith("WARNING") && t.length < 200) { _log(t); }
      }
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (killed) { return; }

      // flush remaining buffer
      if (buffer.trim()) {
        try {
          const raw = JSON.parse(buffer.trim());
          const rawUrl: string = raw.webpage_url || raw.url || "";
          const videoId: string = raw.id || "";
          const resolvedUrl =
            rawUrl.startsWith("http")
              ? rawUrl
              : videoId
                ? `https://www.youtube.com/watch?v=${videoId}`
                : rawUrl;
          items.push({
            id: videoId,
            title: raw.title || videoId || "Untitled",
            url: resolvedUrl,
            duration: raw.duration || null,
            duration_string: raw.duration_string || null,
            thumbnail: raw.thumbnails?.[0]?.url || raw.thumbnail || null,
            uploader: raw.uploader || raw.channel || "",
            _playlist_index: items.length + 1,
          });
        } catch { /* ignore */ }
      }

      if (code !== 0 && items.length === 0) {
        return reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
      }

      _log(`Playlist: ${items.length} item${items.length !== 1 ? "s" : ""} found`);
      resolve({ items });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      if (killed) { return; }
      reject(new Error(`Cannot run yt-dlp: ${err.message}`));
    });
  });
}

export function looksLikePlaylist(url: string): boolean {
  if (!url) { return false; }
  const u = url.toLowerCase();
  if (u.includes("list=")) { return true; }
  if (u.includes("/playlist")) { return true; }
  if (u.includes("/channel/") || u.includes("/c/") || u.includes("/@")) { return true; }
  if (u.includes("/sets/")) { return true; }
  if (u.includes("/album/") || u.includes("/albums/")) { return true; }
  return false;
}

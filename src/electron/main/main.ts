import { app, BrowserWindow, ipcMain, dialog, shell, Notification } from "electron";
import path from "path";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Store = require("electron-store");
import * as ytdlp from "./ytdlp";
import { queue } from "./queue";
import { DEV_MODE, log, logError } from "./utils";
import type { AddQueueItem, QueueItem, DownloadOptions, HistoryEntry, PlaylistItem } from "../../shared/types";

const APP_NAME = "YTDownloader";
const IS_DEV = DEV_MODE || !app.isPackaged;
const MAX_HISTORY = 100;

process.on("uncaughtException", (err) => {
  logError("Uncaught exception:", err.message);
});

process.on("unhandledRejection", (err) => {
  logError("Unhandled rejection:", (err as Error)?.message || err);
});

const store = new Store({
  name: "app-config",
  defaults: {
    downloadPath: path.join(app.getPath("downloads"), APP_NAME),
    history: [] as HistoryEntry[],
    downloadOptions: {},
    notifyOnComplete: true,
  },
});

let mainWindow: BrowserWindow | null = null;

function send(channel: string, data: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function addToHistory(entry: HistoryEntry): void {
  const history: HistoryEntry[] = store.get("history") || [];
  // dedupe by url
  const filtered = history.filter((h) => h.url !== entry.url);
  filtered.unshift(entry);
  store.set("history", filtered.slice(0, MAX_HISTORY));
}

function createWindow(): void {
  const isMac = process.platform === "darwin";

  mainWindow = new BrowserWindow({
    width: 960,
    height: 700,
    minWidth: 720,
    minHeight: 560,
    backgroundColor: isMac ? "#00000000" : "#0f172a",
    titleBarStyle: isMac ? "hiddenInset" : "default",
    ...(isMac ? { trafficLightPosition: { x: 16, y: 18 } } : {}),
    ...(isMac ? { vibrancy: "under-window" as const } : {}),
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: IS_DEV,
    },
    show: false,
  });

  if (IS_DEV) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "..", "dist", "index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow!.show();
    if (IS_DEV) {
      mainWindow!.webContents.openDevTools({ mode: "detach" });
    }
    log("Window ready");
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  log("App starting, DEV_MODE:", IS_DEV, "platform:", process.platform);
  createWindow();

  // Apply saved download options
  queue.setDownloadOptions(store.get("downloadOptions") as Partial<DownloadOptions>);

  queue.setCallbacks({
    onLog: (msg) => send("log", msg),
    onItemUpdate: (item) => send("queue:itemUpdate", item),
    onQueueUpdate: (data) => send("queue:update", data),
    onItemComplete: (item: QueueItem) => {
      log("Download complete:", item.title);
      // Add to history
      addToHistory({
        id: item.url,
        url: item.url,
        title: item.title,
        thumbnail: item.thumbnail,
        uploader: "",
        duration_string: null,
        downloadedAt: Date.now(),
        formatLabel: item.extractAudio ? item.audioFormat.toUpperCase() : item.formatId,
      });
      send("history:updated", store.get("history"));
    },
    onQueueComplete: () => {
      const notify: boolean = store.get("notifyOnComplete") as boolean;
      if (notify && Notification.isSupported() && (!mainWindow || !mainWindow.isFocused())) {
        new Notification({
          title: "Tuberift",
          body: "All downloads complete ✓",
        }).show();
      }
    },
  });

  queue.setDownloadPath(store.get("downloadPath") as string);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  queue.cancelCurrent();
});

// IPC — deps
ipcMain.handle("deps:check", () => ytdlp.checkDeps());

// IPC — video fetch
ipcMain.handle("video:fetch", async (_e, url: string) => {
  log("Fetch requested:", url);
  send("log", "Fetching video info...");
  try {
    const opts = store.get("downloadOptions") as Partial<DownloadOptions>;
    const { info } = await ytdlp.fetchInfo(url, {
      onLog: (msg) => send("log", msg),
      cookiesBrowser: opts?.cookiesBrowser || "",
    });
    const presets = ytdlp.buildPresets(info.formats);
    send("log", `Found: ${info.title}`);
    return { info, presets };
  } catch (err) {
    send("log", `Error: ${(err as Error).message}`);
    throw err;
  }
});

// IPC — settings
ipcMain.handle("settings:getDownloadPath", () => store.get("downloadPath"));

ipcMain.handle("settings:chooseDownloadPath", async () => {
  if (!mainWindow || mainWindow.isDestroyed()) { return store.get("downloadPath"); }
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
    title: "Choose download folder",
  });
  if (!result.canceled && result.filePaths[0]) {
    store.set("downloadPath", result.filePaths[0]);
    queue.setDownloadPath(result.filePaths[0]);
    return result.filePaths[0];
  }
  return store.get("downloadPath");
});

ipcMain.handle("settings:openFolder", (_e, p?: string) => {
  shell.openPath(p || (store.get("downloadPath") as string));
});

ipcMain.handle("settings:openExternal", (_e, url: string) => {
  if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
    shell.openExternal(url);
  }
});

ipcMain.handle("settings:getAll", () => ({
  downloadPath: store.get("downloadPath"),
  downloadOptions: store.get("downloadOptions"),
  notifyOnComplete: store.get("notifyOnComplete"),
}));

ipcMain.handle("settings:saveDownloadOptions", (_e, opts: Partial<DownloadOptions>) => {
  store.set("downloadOptions", opts);
  queue.setDownloadOptions(opts);
  return { ok: true };
});

ipcMain.handle("settings:setNotifyOnComplete", (_e, value: boolean) => {
  store.set("notifyOnComplete", value);
  return { ok: true };
});

// IPC — app info
ipcMain.handle("app:info", () => ({
  version: app.getVersion(),
  devMode: IS_DEV,
  platform: process.platform,
  arch: process.arch,
}));

// IPC — history
ipcMain.handle("history:get", () => store.get("history") || []);
ipcMain.handle("history:clear", () => {
  store.set("history", []);
  send("history:updated", []);
  return [];
});
ipcMain.handle("history:remove", (_e, id: string) => {
  const history: HistoryEntry[] = (store.get("history") as HistoryEntry[]) || [];
  const filtered = history.filter((h) => h.id !== id);
  store.set("history", filtered);
  send("history:updated", filtered);
  return filtered;
});

// IPC — playlist
ipcMain.handle("playlist:detect", (_e, url: string) => ytdlp.looksLikePlaylist(url));

ipcMain.handle("playlist:fetch", async (_e, url: string) => {
  log("Playlist fetch requested:", url);
  send("log", "Fetching playlist...");
  try {
    const opts = store.get("downloadOptions") as Partial<DownloadOptions>;
    const result = await ytdlp.fetchPlaylist(url, {
      onLog: (msg) => send("log", msg),
      onItem: (item: PlaylistItem, count: number) => send("playlist:item", { item, count }),
      cookiesBrowser: opts?.cookiesBrowser || "",
    });
    send("log", `Playlist: ${result.items.length} items found`);
    return result;
  } catch (err) {
    send("log", `Error: ${(err as Error).message}`);
    throw err;
  }
});

// IPC — queue
ipcMain.handle("queue:add", (_e, items: AddQueueItem[]) => {
  log("Queue: adding", items.length, "items");
  return queue.add(items);
});

ipcMain.handle("queue:getAll", () => queue.getAll());
ipcMain.handle("queue:getCounts", () => queue.counts);
ipcMain.handle("queue:cancelCurrent", () => { queue.cancelCurrent(); return { ok: true }; });
ipcMain.handle("queue:cancelAll", () => { queue.cancelAll(); return { ok: true }; });
ipcMain.handle("queue:retry", (_e, itemId: number) => { queue.retry(itemId); return { ok: true }; });
ipcMain.handle("queue:retryFailed", () => { queue.retryFailed(); return { ok: true }; });
ipcMain.handle("queue:clearCompleted", () => { queue.clearCompleted(); return { ok: true }; });
ipcMain.handle("queue:remove", (_e, itemId: number) => { queue.remove(itemId); return { ok: true }; });

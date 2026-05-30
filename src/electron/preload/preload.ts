import { contextBridge, ipcRenderer } from "electron";
import type {
  AddQueueItem,
  AppInfo,
  DepsCheck,
  DownloadOptions,
  FetchResult,
  FetchPlaylistResult,
  HistoryEntry,
  PlaylistItem,
  QueueCounts,
  QueueItem,
  QueueUpdate,
} from "../../shared/types";

const api = {
  // Video
  fetchVideo: (url: string): Promise<FetchResult> =>
    ipcRenderer.invoke("video:fetch", url),

  // Deps
  checkDeps: (): Promise<DepsCheck> => ipcRenderer.invoke("deps:check"),

  // Settings
  getDownloadPath: (): Promise<string> =>
    ipcRenderer.invoke("settings:getDownloadPath"),
  chooseDownloadPath: (): Promise<string> =>
    ipcRenderer.invoke("settings:chooseDownloadPath"),
  openFolder: (p?: string): Promise<void> =>
    ipcRenderer.invoke("settings:openFolder", p),
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke("settings:openExternal", url),
  getAllSettings: (): Promise<{
    downloadPath: string;
    downloadOptions: Partial<DownloadOptions>;
    notifyOnComplete: boolean;
  }> => ipcRenderer.invoke("settings:getAll"),
  saveDownloadOptions: (opts: Partial<DownloadOptions>): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("settings:saveDownloadOptions", opts),
  setNotifyOnComplete: (value: boolean): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("settings:setNotifyOnComplete", value),

  // App info
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke("app:info"),

  // History
  getHistory: (): Promise<HistoryEntry[]> => ipcRenderer.invoke("history:get"),
  clearHistory: (): Promise<HistoryEntry[]> => ipcRenderer.invoke("history:clear"),
  removeHistory: (id: string): Promise<HistoryEntry[]> =>
    ipcRenderer.invoke("history:remove", id),
  onHistoryUpdated: (cb: (entries: HistoryEntry[]) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, entries: HistoryEntry[]) => cb(entries);
    ipcRenderer.on("history:updated", handler);
    return () => ipcRenderer.removeListener("history:updated", handler);
  },

  // Playlist
  detectPlaylist: (url: string): Promise<boolean> =>
    ipcRenderer.invoke("playlist:detect", url),
  fetchPlaylist: (url: string): Promise<FetchPlaylistResult> =>
    ipcRenderer.invoke("playlist:fetch", url),
  onPlaylistItem: (cb: (data: { item: PlaylistItem; count: number }) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { item: PlaylistItem; count: number }) => cb(data);
    ipcRenderer.on("playlist:item", handler);
    return () => ipcRenderer.removeListener("playlist:item", handler);
  },

  // Queue
  queueAdd: (items: AddQueueItem[]): Promise<QueueItem[]> =>
    ipcRenderer.invoke("queue:add", items),
  queueGetAll: (): Promise<QueueItem[]> => ipcRenderer.invoke("queue:getAll"),
  queueGetCounts: (): Promise<QueueCounts> => ipcRenderer.invoke("queue:getCounts"),
  queueCancelCurrent: (): Promise<void> => ipcRenderer.invoke("queue:cancelCurrent"),
  queueCancelAll: (): Promise<void> => ipcRenderer.invoke("queue:cancelAll"),
  queueRetry: (itemId: number): Promise<void> => ipcRenderer.invoke("queue:retry", itemId),
  queueRetryFailed: (): Promise<void> => ipcRenderer.invoke("queue:retryFailed"),
  queueClearCompleted: (): Promise<void> => ipcRenderer.invoke("queue:clearCompleted"),
  queueRemove: (itemId: number): Promise<void> => ipcRenderer.invoke("queue:remove", itemId),

  // Events
  onLog: (cb: (msg: string) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, msg: string) => cb(msg);
    ipcRenderer.on("log", handler);
    return () => ipcRenderer.removeListener("log", handler);
  },
  onQueueUpdate: (cb: (data: QueueUpdate) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: QueueUpdate) => cb(data);
    ipcRenderer.on("queue:update", handler);
    return () => ipcRenderer.removeListener("queue:update", handler);
  },
  onQueueItemUpdate: (cb: (item: QueueItem) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, item: QueueItem) => cb(item);
    ipcRenderer.on("queue:itemUpdate", handler);
    return () => ipcRenderer.removeListener("queue:itemUpdate", handler);
  },
};

contextBridge.exposeInMainWorld("api", api);

export type ElectronAPI = typeof api;

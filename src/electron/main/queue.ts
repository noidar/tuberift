import type { QueueItem, QueueItemState, QueueCounts, QueueUpdate, AddQueueItem, DownloadOptions } from "../../shared/types";
import { log, logError } from "./utils";
import * as ytdlp from "./ytdlp";
import path from "path";
import fs from "fs";
import { app } from "electron";

const STATE: Record<string, QueueItemState> = {
  PENDING: "pending",
  DOWNLOADING: "downloading",
  COMPLETED: "completed",
  FAILED: "failed",
};

interface QueueCallbacks {
  onLog?: (msg: string) => void;
  onItemUpdate?: (item: QueueItem) => void;
  onQueueUpdate?: (data: QueueUpdate) => void;
  onItemComplete?: (item: QueueItem) => void;
  onQueueComplete?: () => void;
}

class DownloadQueue {
  private _items: QueueItem[] = [];
  private _isProcessing = false;
  private _aborted = false;
  private _cancelled = false;
  private _callbacks: QueueCallbacks | null = null;
  private _currentProc: ReturnType<typeof import("child_process").spawn> | null = null;
  private _idCounter = 0;
  private _downloadPath: string | null = null;
  private _downloadOptions: Partial<DownloadOptions> = {};

  setCallbacks(cbs: QueueCallbacks): void {
    this._callbacks = cbs;
  }

  setDownloadPath(p: string): void {
    this._downloadPath = p;
  }

  setDownloadOptions(opts: Partial<DownloadOptions>): void {
    this._downloadOptions = opts;
  }

  add(items: AddQueueItem[]): QueueItem[] {
    const added: QueueItem[] = [];
    for (const item of items) {
      const qItem: QueueItem = {
        id: ++this._idCounter,
        url: item.url,
        title: item.title || "Untitled",
        thumbnail: item.thumbnail || null,
        formatId: item.formatId,
        extractAudio: item.extractAudio || false,
        audioFormat: item.audioFormat || "mp3",
        state: STATE.PENDING,
        error: null,
        progress: null,
        addedAt: Date.now(),
      };
      this._items.push(qItem);
      added.push(qItem);
      log("Queue: added", qItem.title, "->", qItem.id);
    }

    this._emitQueueUpdate();

    if (!this._isProcessing) {
      this._processNext();
    }

    return added;
  }

  getAll(): QueueItem[] {
    return this._items.map((item) => ({ ...item }));
  }

  cancelCurrent(): void {
    if (this._currentProc) {
      log("Queue: cancelling current");
      this._cancelled = true;
      try {
        this._currentProc.kill("SIGTERM");
      } catch {
        // ignore
      }
      this._currentProc = null;
    }
  }

  cancelAll(): void {
    log("Queue: cancel all");
    this._aborted = true;
    this.cancelCurrent();

    for (const item of this._items) {
      if (item.state === STATE.PENDING) {
        item.state = STATE.FAILED;
        item.error = "Cancelled";
      }
    }

    this._isProcessing = false;
    this._emitQueueUpdate();
  }

  retry(itemId: number): void {
    const item = this._items.find((i) => i.id === itemId);
    if (!item || item.state !== STATE.FAILED) {
      return;
    }

    log("Queue: retrying", item.title);
    item.state = STATE.PENDING;
    item.error = null;
    item.progress = null;
    this._emitQueueUpdate();

    if (!this._isProcessing) {
      this._processNext();
    }
  }

  retryFailed(): void {
    let count = 0;
    for (const item of this._items) {
      if (item.state === STATE.FAILED) {
        item.state = STATE.PENDING;
        item.error = null;
        item.progress = null;
        count++;
      }
    }
    log("Queue: retrying", count, "failed items");
    this._emitQueueUpdate();

    if (!this._isProcessing && count > 0) {
      this._processNext();
    }
  }

  clearCompleted(): void {
    this._items = this._items.filter(
      (i) => i.state === STATE.PENDING || i.state === STATE.DOWNLOADING
    );
    if (this._items.length === 0) {
      this._idCounter = 0;
    }
    this._emitQueueUpdate();
  }

  remove(itemId: number): void {
    const item = this._items.find((i) => i.id === itemId);
    if (!item) {
      return;
    }
    if (item.state === STATE.DOWNLOADING) {
      this.cancelCurrent();
    }
    this._items = this._items.filter((i) => i.id !== itemId);
    this._emitQueueUpdate();
  }

  get isActive(): boolean {
    return this._isProcessing;
  }

  get counts(): QueueCounts {
    let pending = 0, downloading = 0, completed = 0, failed = 0;
    for (const item of this._items) {
      if (item.state === STATE.PENDING) { pending++; }
      else if (item.state === STATE.DOWNLOADING) { downloading++; }
      else if (item.state === STATE.COMPLETED) { completed++; }
      else if (item.state === STATE.FAILED) { failed++; }
    }
    return { total: this._items.length, pending, downloading, completed, failed };
  }

  private async _processNext(): Promise<void> {
    if (this._aborted) {
      this._aborted = false;
      this._isProcessing = false;
      return;
    }

    const nextItem = this._items.find((i) => i.state === STATE.PENDING);
    if (!nextItem) {
      this._isProcessing = false;
      log("Queue: all done");
      this._emit("log", "Queue complete");
      this._emitQueueUpdate();
      if (this._callbacks?.onQueueComplete) {
        this._callbacks.onQueueComplete();
      }
      return;
    }

    this._isProcessing = true;
    nextItem.state = STATE.DOWNLOADING;
    nextItem.progress = { percent: "0%", speed: "", eta: "" };
    this._emitItemUpdate(nextItem);
    this._emitQueueUpdate();

    const counts = this.counts;
    const position = counts.completed + counts.failed + 1;
    this._emit("log", `Downloading ${position}/${counts.total}: ${nextItem.title}`);

    try {
      this._cancelled = false;
      await this._downloadOne(nextItem);
      nextItem.state = STATE.COMPLETED;
      nextItem.progress = { percent: "100%", speed: "", eta: "" };
      this._emit("log", `Completed: ${nextItem.title} ✓`);
      this._emitItemComplete(nextItem);
    } catch (err) {
      if (this._cancelled) {
        nextItem.state = STATE.FAILED;
        nextItem.error = "Cancelled";
        this._emit("log", `Skipped: ${nextItem.title}`);
      } else {
        nextItem.state = STATE.FAILED;
        nextItem.error = (err as Error).message || "Download failed";
        this._emit("log", `Failed: ${nextItem.title} - ${nextItem.error}`);
        logError("Queue: failed", nextItem.title, (err as Error).message);
      }
      this._cancelled = false;
    }

    this._currentProc = null;
    this._emitItemUpdate(nextItem);
    this._emitQueueUpdate();

    setTimeout(() => this._processNext(), 0);
  }

  private _downloadOne(item: QueueItem): Promise<{ ok: boolean }> {
    const downloadPath =
      this._downloadPath ||
      path.join(app.getPath("downloads"), "YTDownloader");

    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    }

    const callbacks: ytdlp.DownloadCallbacks = {
      onProgress: (p) => {
        item.progress = p;
        this._emitItemUpdate(item);
      },
      onLog: (msg) => {
        this._emit("log", msg);
      },
    };

    const downloadPromise = ytdlp.download(
      {
        url: item.url,
        formatId: item.formatId,
        outputDir: downloadPath,
        extractAudio: item.extractAudio,
        audioFormat: item.audioFormat,
        options: this._downloadOptions,
      },
      callbacks
    );

    const pollInterval = setInterval(() => {
      if (callbacks._proc) {
        this._currentProc = callbacks._proc;
        clearInterval(pollInterval);
      }
    }, 50);

    return downloadPromise.finally(() => clearInterval(pollInterval));
  }

  private _emit(type: string, data: string): void {
    if (!this._callbacks) {
      return;
    }
    if (type === "log" && this._callbacks.onLog) {
      this._callbacks.onLog(data);
    }
  }

  private _emitItemUpdate(item: QueueItem): void {
    if (this._callbacks?.onItemUpdate) {
      this._callbacks.onItemUpdate({ ...item });
    }
  }

  private _emitItemComplete(item: QueueItem): void {
    if (this._callbacks?.onItemComplete) {
      this._callbacks.onItemComplete({ ...item });
    }
  }

  private _emitQueueUpdate(): void {
    if (this._callbacks?.onQueueUpdate) {
      this._callbacks.onQueueUpdate({
        items: this.getAll(),
        counts: this.counts,
        isActive: this.isActive,
      });
    }
  }
}

export const queue = new DownloadQueue();

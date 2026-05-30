import { useState, useCallback } from "react";
import type { FetchResult, QueueItem, QueueUpdate } from "src/shared/types";

export type AppView = "fetch" | "playlist" | "queue";

export interface AppState {
  view: AppView;
  fetchResult: FetchResult | null;
  isFetching: boolean;
  fetchError: string | null;
  selectedPresetId: string | null;
  queue: QueueItem[];
  queueActive: boolean;
  logs: string[];
  downloadPath: string;
}

export function useAppStore() {
  const [view, setView] = useState<AppView>("fetch");
  const [fetchResult, setFetchResult] = useState<FetchResult | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueActive, setQueueActive] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [downloadPath, setDownloadPath] = useState("");

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-199), msg]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const applyQueueUpdate = useCallback((data: QueueUpdate) => {
    setQueue(data.items);
    setQueueActive(data.isActive);
  }, []);

  const applyItemUpdate = useCallback((item: QueueItem) => {
    setQueue((prev) =>
      prev.map((q) => (q.id === item.id ? item : q))
    );
  }, []);

  return {
    view, setView,
    fetchResult, setFetchResult,
    isFetching, setIsFetching,
    fetchError, setFetchError,
    selectedPresetId, setSelectedPresetId,
    queue, setQueue,
    queueActive, setQueueActive,
    logs,
    downloadPath, setDownloadPath,
    addLog,
    clearLogs,
    applyQueueUpdate,
    applyItemUpdate,
  };
}

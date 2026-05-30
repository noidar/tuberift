import { useEffect, useCallback, useState } from "react";
import {
  Box,
  Container,
  TextField,
  Button,
  Stack,
  Typography,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Badge,
} from "@mui/material";
import logoUrl from "src/renderer/assets/logo.svg";
import SearchIcon from "@mui/icons-material/Search";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import DownloadIcon from "@mui/icons-material/Download";
import QueueIcon from "@mui/icons-material/Queue";
import PlaylistPlayIcon from "@mui/icons-material/PlaylistPlay";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import { VideoCard } from "src/renderer/components/VideoCard";
import { QueuePanel } from "src/renderer/components/QueuePanel";
import { PlaylistPanel } from "src/renderer/components/PlaylistPanel";
import { LogPanel } from "src/renderer/components/LogPanel";
import { useAppStore } from "src/renderer/stores/appStore";
import type { PlaylistItem } from "src/shared/types";

export default function App() {
  const [url, setUrl] = useState("");
  const store = useAppStore();

  // playlist state
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [isFetchingPlaylist, setIsFetchingPlaylist] = useState(false);

  // Init
  useEffect(() => {
    window.api.getDownloadPath().then(store.setDownloadPath);
    window.api.queueGetAll().then((items) => store.setQueue(items));

    const unLog = window.api.onLog(store.addLog);
    const unQueue = window.api.onQueueUpdate(store.applyQueueUpdate);
    const unItem = window.api.onQueueItemUpdate(store.applyItemUpdate);
    const unPlaylist = window.api.onPlaylistItem(({ item }) => {
      setPlaylistItems((prev) => [...prev, item]);
    });

    return () => { unLog(); unQueue(); unItem(); unPlaylist(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFetch = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) { return; }

    store.setIsFetching(true);
    store.setFetchError(null);
    store.setFetchResult(null);
    store.setSelectedPresetId(null);
    setPlaylistItems([]);

    try {
      // Detect playlist first
      const isPlaylist = await window.api.detectPlaylist(trimmed);

      if (isPlaylist) {
        store.setIsFetching(false);
        setIsFetchingPlaylist(true);
        store.setView("playlist");
        const result = await window.api.fetchPlaylist(trimmed);
        setPlaylistItems(result.items);
        setIsFetchingPlaylist(false);
      } else {
        const result = await window.api.fetchVideo(trimmed);
        store.setFetchResult(result);
        if (result.presets.length > 0) {
          store.setSelectedPresetId(result.presets[0].id);
        }
        store.setView("fetch");
        store.setIsFetching(false);
      }
    } catch (err) {
      store.setFetchError((err as Error).message || "Failed to fetch");
      store.setIsFetching(false);
      setIsFetchingPlaylist(false);
    }
  }, [url, store]);

  const handleAddToQueue = useCallback(async () => {
    if (!store.fetchResult || !store.selectedPresetId) { return; }
    const { info, presets } = store.fetchResult;
    const preset = presets.find((p) => p.id === store.selectedPresetId);
    if (!preset) { return; }

    await window.api.queueAdd([{
      url: info.webpage_url,
      title: info.title,
      thumbnail: info.thumbnail,
      formatId: preset.formatId,
      extractAudio: preset.type === "audio",
      audioFormat: preset.audioFormat || "mp3",
    }]);
    store.setView("queue");
  }, [store]);

  const handleAddPlaylistToQueue = useCallback(async (
    items: PlaylistItem[],
    formatId: string,
    extractAudio: boolean,
    audioFormat: string
  ) => {
    await window.api.queueAdd(
      items.map((item) => ({
        url: item.url,
        title: item.title,
        thumbnail: item.thumbnail,
        formatId,
        extractAudio,
        audioFormat,
      }))
    );
    store.setView("queue");
  }, [store]);

  const handleChoosePath = useCallback(async () => {
    const newPath = await window.api.chooseDownloadPath();
    if (newPath) { store.setDownloadPath(newPath); }
  }, [store]);

  const handleClearAll = useCallback(async () => {
    await window.api.queueCancelAll();
    await window.api.queueClearCompleted();
    await window.api.clearHistory();
    store.setQueue([]);
    store.clearLogs();
    setPlaylistItems([]);
    store.setFetchResult(null);
    store.setFetchError(null);
    store.setView("fetch");
  }, [store]);

  const pendingCount = store.queue.filter((q) => q.state === "pending").length;
  const activeCount = store.queue.filter((q) => q.state === "downloading").length;
  const queueBadge = pendingCount + activeCount;
  const isLoading = store.isFetching || isFetchingPlaylist;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", display: "flex", flexDirection: "column" }}>
      {/* Title bar */}
      <Box sx={{
        height: 40, WebkitAppRegion: "drag", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        pl: "80px", pr: 2,
        bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider",
      }}>
        <Stack direction="row" alignItems="center" gap={1} sx={{ WebkitAppRegion: "no-drag", lineHeight: 1 }}>
          <Box component="img" src={logoUrl} alt="Tuberift" sx={{ width: 24, height: 24, display: "block" }} />
          <Typography variant="body2" fontWeight={700} sx={{ color: "text.primary", letterSpacing: 0.3, lineHeight: 1 }}>
            tube<Box component="span" sx={{ color: "primary.main" }}>rift</Box>
          </Typography>
        </Stack>
        <Tooltip title="Clear everything (queue, history, logs)">
          <IconButton
            size="small"
            onClick={handleClearAll}
            sx={{ WebkitAppRegion: "no-drag", color: "text.secondary", "&:hover": { color: "error.main" } }}
          >
            <DeleteSweepIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Container maxWidth="md" sx={{ flex: 1, py: 3, display: "flex", flexDirection: "column", gap: 2 }}>
        {/* URL input */}
        <Stack direction="row" gap={1}>
          <TextField
            fullWidth
            placeholder="Paste a YouTube video or playlist URL..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { handleFetch(); } }}
            size="small"
            InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: "text.secondary", fontSize: 18 }} /> }}
            sx={{ bgcolor: "background.paper" }}
          />
          <Button
            variant="contained"
            onClick={handleFetch}
            disabled={isLoading || !url.trim()}
            sx={{ minWidth: 100, whiteSpace: "nowrap" }}
          >
            {isLoading ? <CircularProgress size={16} color="inherit" /> : "Fetch"}
          </Button>
        </Stack>

        {/* Tabs */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Tabs value={store.view} onChange={(_e, v) => store.setView(v)} sx={{ minHeight: 36 }}>
            <Tab label="Video" value="fetch"
              icon={<DownloadIcon sx={{ fontSize: 16 }} />} iconPosition="start"
              sx={{ minHeight: 36, fontSize: 13, py: 0 }} />
            <Tab
              label={
                <Stack direction="row" alignItems="center" gap={0.5}>
                  <PlaylistPlayIcon sx={{ fontSize: 16 }} />
                  <span>Playlist{playlistItems.length > 0 ? ` (${playlistItems.length})` : ""}</span>
                  {isFetchingPlaylist && <CircularProgress size={10} color="inherit" />}
                </Stack>
              }
              value="playlist"
              sx={{ minHeight: 36, fontSize: 13, py: 0 }} />
            <Tab
              label={
                <Badge badgeContent={queueBadge} color="primary" max={99}>
                  <Stack direction="row" alignItems="center" gap={0.5}>
                    <QueueIcon sx={{ fontSize: 16 }} />
                    <span>Queue</span>
                  </Stack>
                </Badge>
              }
              value="queue"
              sx={{ minHeight: 36, fontSize: 13, py: 0 }} />
          </Tabs>

          {/* Download folder */}
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Typography variant="caption" color="text.secondary" noWrap maxWidth={200}>
              {store.downloadPath}
            </Typography>
            <Tooltip title="Open folder">
              <IconButton size="small" onClick={() => window.api.openFolder()}>
                <FolderOpenIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Change folder">
              <IconButton size="small" onClick={handleChoosePath}>
                <SearchIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {/* Error */}
        {store.fetchError && (
          <Alert severity="error" onClose={() => store.setFetchError(null)} sx={{ fontSize: 13 }}>
            {store.fetchError}
          </Alert>
        )}

        {/* Video tab */}
        {store.view === "fetch" && (
          <>
            {store.fetchResult ? (
              <VideoCard
                result={store.fetchResult}
                selectedPresetId={store.selectedPresetId}
                onPresetSelect={store.setSelectedPresetId}
                onAddToQueue={handleAddToQueue}
                onOpenExternal={(u) => window.api.openExternal(u)}
              />
            ) : (
              !isLoading && (
                <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", py: 8, gap: 1, color: "text.secondary" }}>
                  <DownloadIcon sx={{ fontSize: 56, opacity: 0.3 }} />
                  <Typography>Paste a URL and click Fetch</Typography>
                  <Typography variant="caption">Detects playlists automatically</Typography>
                </Box>
              )
            )}
          </>
        )}

        {/* Playlist tab */}
        {store.view === "playlist" && (
          <PlaylistPanel
            items={playlistItems}
            isFetching={isFetchingPlaylist}
            onAddToQueue={handleAddPlaylistToQueue}
          />
        )}

        {/* Queue tab */}
        {store.view === "queue" && (
          <QueuePanel
            items={store.queue}
            counts={{
              total: store.queue.length,
              pending: store.queue.filter((q) => q.state === "pending").length,
              downloading: store.queue.filter((q) => q.state === "downloading").length,
              completed: store.queue.filter((q) => q.state === "completed").length,
              failed: store.queue.filter((q) => q.state === "failed").length,
            }}
            isActive={store.queueActive}
            onCancelCurrent={() => window.api.queueCancelCurrent()}
            onCancelAll={() => window.api.queueCancelAll()}
            onRetry={(id) => window.api.queueRetry(id)}
            onRetryFailed={() => window.api.queueRetryFailed()}
            onClearCompleted={() => window.api.queueClearCompleted()}
            onRemove={(id) => window.api.queueRemove(id)}
          />
        )}

        {/* Logs */}
        <LogPanel logs={store.logs} />
      </Container>
    </Box>
  );
}

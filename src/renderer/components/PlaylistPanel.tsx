import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Checkbox,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
  Chip,
  Divider,
  Tooltip,
} from "@mui/material";
import SelectAllIcon from "@mui/icons-material/SelectAll";
import DeselectIcon from "@mui/icons-material/Deselect";
import DownloadIcon from "@mui/icons-material/Download";
import PlaylistPlayIcon from "@mui/icons-material/PlaylistPlay";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import VideocamIcon from "@mui/icons-material/Videocam";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import type { PlaylistItem } from "src/shared/types";

interface IPlaylistPanelProps {
  items: PlaylistItem[];
  isFetching: boolean;
  onAddToQueue: (
    items: PlaylistItem[],
    formatId: string,
    extractAudio: boolean,
    audioFormat: string
  ) => void;
}

const VIDEO_PRESETS = [
  { id: "best", label: "Best", formatId: "bv*+ba/b" },
  { id: "1080p", label: "1080p", formatId: "bv*[height<=1080]+ba/b[height<=1080]/b" },
  { id: "720p", label: "720p", formatId: "bv*[height<=720]+ba/b[height<=720]/b" },
  { id: "480p", label: "480p", formatId: "bv*[height<=480]+ba/b[height<=480]/b" },
];

const AUDIO_PRESETS = [
  { id: "audio-mp3", label: "MP3", formatId: "ba/b", audioFormat: "mp3" },
  { id: "audio-m4a", label: "M4A", formatId: "ba[ext=m4a]/ba/b", audioFormat: "m4a" },
];

function formatDuration(s: number | null): string {
  if (!s) { return ""; }
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function PlaylistPanel({ items, isFetching, onAddToQueue }: IPlaylistPanelProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formatId, setFormatId] = useState("best");

  // Keep selection in sync as items stream in — auto-select new items
  const allIds = new Set(items.map((i) => i.id));
  const effectiveSelected = new Set([...selected].filter((id) => allIds.has(id)));
  // Auto-select newly arrived items
  for (const item of items) {
    if (!selected.has(item.id) && !effectiveSelected.has(item.id)) {
      effectiveSelected.add(item.id);
    }
  }

  const allSelected = items.length > 0 && effectiveSelected.size === items.length;
  const someSelected = effectiveSelected.size > 0 && !allSelected;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  }

  function toggleItem(id: string) {
    const next = new Set(effectiveSelected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  }

  function handleQueue() {
    const toDownload = items.filter((i) => effectiveSelected.has(i.id));
    const preset = [...VIDEO_PRESETS, ...AUDIO_PRESETS].find((p) => p.id === formatId);
    if (!preset || toDownload.length === 0) { return; }
    const isAudio = AUDIO_PRESETS.some((p) => p.id === formatId);
    const audioFormat = isAudio ? (preset as typeof AUDIO_PRESETS[0]).audioFormat : "mp3";
    onAddToQueue(toDownload, preset.formatId, isAudio, audioFormat);
  }

  if (!isFetching && items.length === 0) {
    return (
      <Card>
        <CardContent sx={{ textAlign: "center", py: 6 }}>
          <PlaylistPlayIcon sx={{ fontSize: 48, color: "text.secondary", mb: 1 }} />
          <Typography color="text.secondary">No playlist loaded</Typography>
          <Typography variant="caption" color="text.secondary">
            Paste a playlist URL and click Fetch
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const selectedPreset = [...VIDEO_PRESETS, ...AUDIO_PRESETS].find((p) => p.id === formatId);
  const isAudioPreset = AUDIO_PRESETS.some((p) => p.id === formatId);

  return (
    <Card>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} flexWrap="wrap">
          <Stack direction="row" alignItems="center" gap={1}>
            <Checkbox
              size="small"
              checked={allSelected}
              indeterminate={someSelected}
              onChange={toggleAll}
              sx={{ p: 0.25 }}
            />
            <Typography variant="subtitle1">
              {isFetching ? "Fetching playlist..." : `${items.length} videos`}
            </Typography>
            {isFetching && <CircularProgress size={14} />}
            {effectiveSelected.size > 0 && !allSelected && (
              <Chip label={`${effectiveSelected.size} selected`} size="small" sx={{ height: 20, fontSize: 11 }} />
            )}
          </Stack>
          <Stack direction="row" gap={0.5}>
            <Tooltip title="Select all">
              <span>
                <Button size="small" startIcon={<SelectAllIcon />} onClick={() => setSelected(new Set(items.map((i) => i.id)))}
                  disabled={allSelected} sx={{ fontSize: 12 }}>All</Button>
              </span>
            </Tooltip>
            <Tooltip title="Deselect all">
              <span>
                <Button size="small" startIcon={<DeselectIcon />} onClick={() => setSelected(new Set())}
                  disabled={effectiveSelected.size === 0} sx={{ fontSize: 12 }}>None</Button>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        {/* Format selector */}
        <Stack gap={1} mt={1.5}>
          <Stack direction="row" alignItems="center" gap={1}>
            <VideocamIcon sx={{ fontSize: 13, color: "text.secondary" }} />
            <Typography variant="caption" color="text.secondary">VIDEO</Typography>
          </Stack>
          <ToggleButtonGroup
            value={formatId} exclusive
            onChange={(_e, v) => { if (v) { setFormatId(v); } }}
            size="small" sx={{ flexWrap: "wrap", gap: 0.5 }}
          >
            {VIDEO_PRESETS.map((p) => (
              <ToggleButton key={p.id} value={p.id} sx={{
                border: "1px solid", borderColor: "divider", borderRadius: "6px !important",
                px: 1.5, py: 0.5, fontSize: 12, fontWeight: 600, textTransform: "none",
                "&.Mui-selected": { bgcolor: "primary.dark", borderColor: "primary.main", color: "#fff" },
              }}>
                {p.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Stack direction="row" alignItems="center" gap={1} mt={0.5}>
            <MusicNoteIcon sx={{ fontSize: 13, color: "text.secondary" }} />
            <Typography variant="caption" color="text.secondary">AUDIO ONLY</Typography>
          </Stack>
          <ToggleButtonGroup
            value={formatId} exclusive
            onChange={(_e, v) => { if (v) { setFormatId(v); } }}
            size="small" sx={{ flexWrap: "wrap", gap: 0.5 }}
          >
            {AUDIO_PRESETS.map((p) => (
              <ToggleButton key={p.id} value={p.id} sx={{
                border: "1px solid", borderColor: "divider", borderRadius: "6px !important",
                px: 1.5, py: 0.5, fontSize: 12, fontWeight: 600, textTransform: "none",
                "&.Mui-selected": { bgcolor: "rgba(139,92,246,0.25)", borderColor: "#8b5cf6", color: "#c4b5fd" },
              }}>
                {p.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>

        {/* Queue button */}
        <Button
          variant="contained" fullWidth
          startIcon={<DownloadIcon />}
          onClick={handleQueue}
          disabled={effectiveSelected.size === 0}
          sx={{ mt: 1.5, py: 0.75 }}
        >
          {effectiveSelected.size > 0
            ? `Download ${effectiveSelected.size} video${effectiveSelected.size !== 1 ? "s" : ""} as ${selectedPreset?.label}${isAudioPreset ? " (audio)" : ""}`
            : "Select videos to download"}
        </Button>
      </Box>

      <Divider />

      {/* Item list */}
      <Box sx={{ maxHeight: 360, overflowY: "auto" }}>
        {items.map((item) => (
          <Box
            key={item.id}
            onClick={() => toggleItem(item.id)}
            sx={{
              display: "flex", alignItems: "center", gap: 1.5,
              px: 2, py: 1,
              cursor: "pointer",
              borderBottom: "1px solid", borderColor: "divider",
              "&:last-child": { borderBottom: "none" },
              "&:hover": { bgcolor: "rgba(255,255,255,0.03)" },
              opacity: effectiveSelected.has(item.id) ? 1 : 0.45,
            }}
          >
            <Checkbox
              size="small"
              checked={effectiveSelected.has(item.id)}
              onChange={() => toggleItem(item.id)}
              onClick={(e) => e.stopPropagation()}
              sx={{ p: 0.25, flexShrink: 0 }}
            />

            {/* Index */}
            <Typography variant="caption" color="text.secondary" sx={{ width: 24, textAlign: "right", flexShrink: 0 }}>
              {item._playlist_index}
            </Typography>

            {/* Thumbnail */}
            {item.thumbnail ? (
              <Box component="img" src={item.thumbnail} alt=""
                sx={{ width: 56, height: 32, objectFit: "cover", borderRadius: 1, flexShrink: 0, bgcolor: "background.default" }} />
            ) : (
              <Box sx={{ width: 56, height: 32, borderRadius: 1, bgcolor: "background.default", flexShrink: 0 }} />
            )}

            {/* Info */}
            <Box flex={1} minWidth={0}>
              <Typography variant="body2" noWrap fontWeight={500}>{item.title}</Typography>
              <Stack direction="row" gap={1}>
                {item.uploader && <Typography variant="caption">{item.uploader}</Typography>}
                {item.duration && (
                  <Stack direction="row" alignItems="center" gap={0.3}>
                    <AccessTimeIcon sx={{ fontSize: 11, color: "text.secondary" }} />
                    <Typography variant="caption">{formatDuration(item.duration)}</Typography>
                  </Stack>
                )}
              </Stack>
            </Box>
          </Box>
        ))}
      </Box>
    </Card>
  );
}

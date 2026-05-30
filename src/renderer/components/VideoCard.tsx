import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  ToggleButtonGroup,
  ToggleButton,
  Button,
  Tooltip,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import VideocamIcon from "@mui/icons-material/Videocam";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import type { FetchResult } from "src/shared/types";

interface IVideoCardProps {
  result: FetchResult;
  selectedPresetId: string | null;
  onPresetSelect: (id: string) => void;
  onAddToQueue: () => void;
  onOpenExternal: (url: string) => void;
}

export function VideoCard({
  result,
  selectedPresetId,
  onPresetSelect,
  onAddToQueue,
  onOpenExternal,
}: IVideoCardProps) {
  const { info, presets } = result;

  const videoPresets = presets.filter((p) => p.type === "video");
  const audioPresets = presets.filter((p) => p.type === "audio");
  const selectedPreset = presets.find((p) => p.id === selectedPresetId);

  function formatViews(n: number | null): string {
    if (!n) {
      return "";
    }
    if (n >= 1e6) {
      return (n / 1e6).toFixed(1) + "M views";
    }
    if (n >= 1e3) {
      return (n / 1e3).toFixed(0) + "K views";
    }
    return n + " views";
  }

  return (
    <Card>
      <CardContent sx={{ p: 2.5 }}>
        {/* Thumbnail + meta */}
        <Stack direction="row" gap={2} mb={2.5}>
          {info.thumbnail && (
            <Box
              component="img"
              src={info.thumbnail}
              alt={info.title}
              sx={{
                width: 140,
                height: 80,
                objectFit: "cover",
                borderRadius: 1.5,
                flexShrink: 0,
                bgcolor: "background.default",
              }}
            />
          )}
          <Box flex={1} minWidth={0}>
            <Tooltip title={info.title} placement="top-start">
              <Typography
                variant="subtitle1"
                noWrap
                sx={{ cursor: "pointer" }}
                onClick={() => onOpenExternal(info.webpage_url)}
              >
                {info.title}
              </Typography>
            </Tooltip>
            <Stack direction="row" gap={1} mt={0.5} flexWrap="wrap">
              {info.uploader && (
                <Typography variant="caption">{info.uploader}</Typography>
              )}
              {info.duration_string && (
                <Stack direction="row" alignItems="center" gap={0.3}>
                  <AccessTimeIcon sx={{ fontSize: 12, color: "text.secondary" }} />
                  <Typography variant="caption">{info.duration_string}</Typography>
                </Stack>
              )}
              {info.view_count !== null && (
                <Typography variant="caption">{formatViews(info.view_count)}</Typography>
              )}
            </Stack>
            <Stack direction="row" gap={0.5} mt={0.75} flexWrap="wrap">
              {info.categories.slice(0, 2).map((cat) => (
                <Chip key={cat} label={cat} size="small" sx={{ fontSize: 11 }} />
              ))}
            </Stack>
          </Box>
          <Box>
            <Tooltip title="Open in browser">
              <Box
                component="span"
                sx={{ cursor: "pointer", color: "text.secondary", "&:hover": { color: "primary.main" } }}
                onClick={() => onOpenExternal(info.webpage_url)}
              >
                <OpenInNewIcon fontSize="small" />
              </Box>
            </Tooltip>
          </Box>
        </Stack>

        {/* Quality selector */}
        {videoPresets.length > 0 && (
          <Box mb={2}>
            <Stack direction="row" alignItems="center" gap={1} mb={1}>
              <VideocamIcon sx={{ fontSize: 14, color: "text.secondary" }} />
              <Typography variant="caption" color="text.secondary">
                VIDEO
              </Typography>
            </Stack>
            <ToggleButtonGroup
              value={selectedPresetId}
              exclusive
              onChange={(_e, val) => { if (val) { onPresetSelect(val); } }}
              size="small"
              sx={{ flexWrap: "wrap", gap: 0.5 }}
            >
              {videoPresets.map((preset) => (
                <ToggleButton
                  key={preset.id}
                  value={preset.id}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: "6px !important",
                    px: 1.5,
                    py: 0.5,
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: "none",
                    "&.Mui-selected": {
                      bgcolor: "primary.dark",
                      borderColor: "primary.main",
                      color: "#fff",
                    },
                  }}
                >
                  <Stack alignItems="center">
                    <span>{preset.label}</span>
                    {preset.tag && (
                      <Typography variant="caption" sx={{ fontSize: 10, opacity: 0.7, lineHeight: 1 }}>
                        {preset.tag}
                      </Typography>
                    )}
                    {preset.size && (
                      <Typography variant="caption" sx={{ fontSize: 10, opacity: 0.6, lineHeight: 1 }}>
                        ~{preset.size}
                      </Typography>
                    )}
                  </Stack>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        )}

        {/* Audio selector */}
        {audioPresets.length > 0 && (
          <Box mb={2.5}>
            <Stack direction="row" alignItems="center" gap={1} mb={1}>
              <MusicNoteIcon sx={{ fontSize: 14, color: "text.secondary" }} />
              <Typography variant="caption" color="text.secondary">
                AUDIO ONLY
              </Typography>
            </Stack>
            <ToggleButtonGroup
              value={selectedPresetId}
              exclusive
              onChange={(_e, val) => { if (val) { onPresetSelect(val); } }}
              size="small"
              sx={{ flexWrap: "wrap", gap: 0.5 }}
            >
              {audioPresets.map((preset) => (
                <ToggleButton
                  key={preset.id}
                  value={preset.id}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: "6px !important",
                    px: 1.5,
                    py: 0.5,
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: "none",
                    "&.Mui-selected": {
                      bgcolor: "rgba(139,92,246,0.25)",
                      borderColor: "#8b5cf6",
                      color: "#c4b5fd",
                    },
                  }}
                >
                  <Stack alignItems="center">
                    <span>{preset.label}</span>
                    {preset.size && (
                      <Typography variant="caption" sx={{ fontSize: 10, opacity: 0.6, lineHeight: 1 }}>
                        ~{preset.size}
                      </Typography>
                    )}
                  </Stack>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        )}

        {/* Actions */}
        <Stack direction="row" gap={1}>
          <Button
            variant="outlined"
            startIcon={<OpenInNewIcon />}
            onClick={() => onOpenExternal(info.webpage_url)}
            sx={{ py: 1, minWidth: 160 }}
          >
            Watch on YouTube
          </Button>
          <Button
            variant="contained"
            fullWidth
            disabled={!selectedPresetId}
            startIcon={<DownloadIcon />}
            onClick={onAddToQueue}
            sx={{ py: 1 }}
          >
            {selectedPreset
              ? `Download — ${selectedPreset.label}${selectedPreset.tag ? ` (${selectedPreset.tag})` : ""}`
              : "Select quality"}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

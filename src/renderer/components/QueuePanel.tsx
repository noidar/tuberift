import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  LinearProgress,
  IconButton,
  Chip,
  Button,
  Tooltip,
  Divider,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import ReplayIcon from "@mui/icons-material/Replay";
import StopIcon from "@mui/icons-material/Stop";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import DownloadingIcon from "@mui/icons-material/Downloading";
import type { QueueItem, QueueCounts } from "src/shared/types";

interface IQueuePanelProps {
  items: QueueItem[];
  counts: QueueCounts;
  isActive: boolean;
  onCancelCurrent: () => void;
  onCancelAll: () => void;
  onRetry: (id: number) => void;
  onRetryFailed: () => void;
  onClearCompleted: () => void;
  onRemove: (id: number) => void;
}

const STATE_COLORS: Record<string, "success" | "error" | "warning" | "info" | "default"> = {
  completed: "success",
  failed: "error",
  downloading: "info",
  pending: "default",
};

const STATE_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircleIcon sx={{ fontSize: 16, color: "success.main" }} />,
  failed: <ErrorIcon sx={{ fontSize: 16, color: "error.main" }} />,
  downloading: <DownloadingIcon sx={{ fontSize: 16, color: "info.main" }} />,
  pending: <HourglassEmptyIcon sx={{ fontSize: 16, color: "text.secondary" }} />,
};

function QueueItemRow({
  item,
  onRetry,
  onRemove,
}: {
  item: QueueItem;
  onRetry: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  const isDownloading = item.state === "downloading";
  const isFailed = item.state === "failed";
  const percent = item.progress
    ? parseFloat(item.progress.percent.replace("%", "")) || 0
    : 0;

  return (
    <Box
      sx={{
        py: 1.5,
        px: 2,
        borderBottom: "1px solid",
        borderColor: "divider",
        "&:last-child": { borderBottom: "none" },
        opacity: item.state === "completed" ? 0.7 : 1,
      }}
    >
      <Stack direction="row" alignItems="flex-start" gap={1.5}>
        {/* Thumbnail */}
        {item.thumbnail ? (
          <Box
            component="img"
            src={item.thumbnail}
            alt=""
            sx={{
              width: 56,
              height: 32,
              objectFit: "cover",
              borderRadius: 1,
              flexShrink: 0,
              bgcolor: "background.default",
            }}
          />
        ) : (
          <Box
            sx={{
              width: 56,
              height: 32,
              borderRadius: 1,
              bgcolor: "background.default",
              flexShrink: 0,
            }}
          />
        )}

        {/* Info */}
        <Box flex={1} minWidth={0}>
          <Stack direction="row" alignItems="center" gap={0.75} mb={0.25}>
            {STATE_ICONS[item.state]}
            <Typography variant="body2" noWrap fontWeight={500}>
              {item.title}
            </Typography>
          </Stack>

          {isDownloading && item.progress && (
            <>
              <LinearProgress
                variant="determinate"
                value={percent}
                sx={{ mb: 0.5 }}
              />
              <Stack direction="row" gap={1.5}>
                <Typography variant="caption">{item.progress.percent}</Typography>
                {item.progress.speed && (
                  <Typography variant="caption">{item.progress.speed}</Typography>
                )}
                {item.progress.eta && (
                  <Typography variant="caption">ETA {item.progress.eta}</Typography>
                )}
              </Stack>
            </>
          )}

          {isFailed && item.error && (
            <Typography variant="caption" color="error.main" sx={{ wordBreak: "break-all" }}>
              {item.error}
            </Typography>
          )}

          {!isDownloading && !isFailed && (
            <Chip
              label={item.state}
              size="small"
              color={STATE_COLORS[item.state]}
              sx={{ height: 18, fontSize: 10, mt: 0.25 }}
            />
          )}
        </Box>

        {/* Actions */}
        <Stack direction="row" gap={0.25} flexShrink={0}>
          {isFailed && (
            <Tooltip title="Retry">
              <IconButton size="small" onClick={() => onRetry(item.id)}>
                <ReplayIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Remove">
            <IconButton size="small" onClick={() => onRemove(item.id)} sx={{ color: "text.secondary" }}>
              <DeleteIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Box>
  );
}

export function QueuePanel({
  items,
  counts,
  isActive,
  onCancelCurrent,
  onCancelAll,
  onRetry,
  onRetryFailed,
  onClearCompleted,
  onRemove,
}: IQueuePanelProps) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent sx={{ textAlign: "center", py: 6 }}>
          <DownloadingIcon sx={{ fontSize: 48, color: "text.secondary", mb: 1 }} />
          <Typography color="text.secondary">Queue is empty</Typography>
          <Typography variant="caption" color="text.secondary">
            Fetch a video and add it to the queue
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" gap={1} alignItems="center">
            <Typography variant="subtitle1">Queue</Typography>
            <Stack direction="row" gap={0.5}>
              {counts.pending > 0 && (
                <Chip label={`${counts.pending} pending`} size="small" sx={{ height: 20, fontSize: 11 }} />
              )}
              {counts.downloading > 0 && (
                <Chip label="downloading" size="small" color="info" sx={{ height: 20, fontSize: 11 }} />
              )}
              {counts.completed > 0 && (
                <Chip label={`${counts.completed} done`} size="small" color="success" sx={{ height: 20, fontSize: 11 }} />
              )}
              {counts.failed > 0 && (
                <Chip label={`${counts.failed} failed`} size="small" color="error" sx={{ height: 20, fontSize: 11 }} />
              )}
            </Stack>
          </Stack>

          <Stack direction="row" gap={0.5}>
            {counts.failed > 0 && (
              <Button size="small" startIcon={<ReplayIcon />} onClick={onRetryFailed} sx={{ fontSize: 12 }}>
                Retry all
              </Button>
            )}
            {counts.completed > 0 && (
              <Button size="small" startIcon={<ClearAllIcon />} onClick={onClearCompleted} sx={{ fontSize: 12 }}>
                Clear done
              </Button>
            )}
            {isActive && (
              <>
                <Tooltip title="Cancel current">
                  <IconButton size="small" onClick={onCancelCurrent}>
                    <StopIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Cancel all">
                  <IconButton size="small" onClick={onCancelAll} color="error">
                    <ClearAllIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Stack>
        </Stack>
      </Box>

      <Divider />

      {/* Items */}
      <Box sx={{ maxHeight: 420, overflowY: "auto" }}>
        {items.map((item) => (
          <QueueItemRow
            key={item.id}
            item={item}
            onRetry={onRetry}
            onRemove={onRemove}
          />
        ))}
      </Box>
    </Card>
  );
}

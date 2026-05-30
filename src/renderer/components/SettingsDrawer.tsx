import { useState, useEffect } from "react";
import {
  Drawer,
  Box,
  Typography,
  Stack,
  Switch,
  FormControlLabel,
  TextField,
  Divider,
  Button,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import SaveIcon from "@mui/icons-material/Save";
import type { DownloadOptions } from "src/shared/types";
import { DEFAULT_DOWNLOAD_OPTIONS } from "src/shared/types";

interface ISettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  downloadPath: string;
  onPathChange: (p: string) => void;
}

const SPONSORBLOCK_CATS = [
  { id: "sponsor", label: "Sponsor" },
  { id: "intro", label: "Intro" },
  { id: "outro", label: "Outro" },
  { id: "selfpromo", label: "Self-promo" },
  { id: "interaction", label: "Interaction" },
  { id: "music_offtopic", label: "Music offtopic" },
];

export function SettingsDrawer({ open, onClose, downloadPath, onPathChange }: ISettingsDrawerProps) {
  const [opts, setOpts] = useState<DownloadOptions>({ ...DEFAULT_DOWNLOAD_OPTIONS });
  const [notifyOnComplete, setNotifyOnComplete] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) { return; }
    window.api.getAllSettings().then((s) => {
      setOpts({ ...DEFAULT_DOWNLOAD_OPTIONS, ...s.downloadOptions });
      setNotifyOnComplete(s.notifyOnComplete);
    });
  }, [open]);

  function set<K extends keyof DownloadOptions>(key: K, value: DownloadOptions[K]) {
    setOpts((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    await window.api.saveDownloadOptions(opts);
    await window.api.setNotifyOnComplete(notifyOnComplete);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function handleChoosePath() {
    const p = await window.api.chooseDownloadPath();
    if (p) { onPathChange(p); }
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: 380, bgcolor: "background.paper", p: 0 } }}
    >
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between"
        sx={{ px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="subtitle1" fontWeight={700}>Settings</Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Stack>

      <Box sx={{ overflowY: "auto", flex: 1, p: 2.5 }}>
        {/* Download folder */}
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
          Download Folder
        </Typography>
        <Stack direction="row" alignItems="center" gap={1} mt={1} mb={2.5}>
          <TextField
            size="small" fullWidth value={downloadPath} disabled
            sx={{ "& input": { fontSize: 12 } }}
          />
          <Tooltip title="Change folder">
            <IconButton size="small" onClick={handleChoosePath}>
              <FolderOpenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        <Divider sx={{ mb: 2.5 }} />

        {/* Subtitles */}
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
          Subtitles
        </Typography>
        <Stack gap={0.5} mt={1} mb={2.5}>
          <FormControlLabel
            control={<Switch size="small" checked={opts.writeSubs} onChange={(e) => set("writeSubs", e.target.checked)} />}
            label={<Typography variant="body2">Download subtitles</Typography>}
          />
          <FormControlLabel
            control={<Switch size="small" checked={opts.embedSubs} disabled={!opts.writeSubs}
              onChange={(e) => set("embedSubs", e.target.checked)} />}
            label={<Typography variant="body2" color={opts.writeSubs ? "text.primary" : "text.secondary"}>Embed into video file</Typography>}
          />
          {opts.writeSubs && (
            <TextField
              size="small" label="Languages" value={opts.subLangs}
              onChange={(e) => set("subLangs", e.target.value)}
              placeholder="en, de, fr — or 'all'"
              helperText="Comma-separated language codes"
              sx={{ mt: 1 }}
            />
          )}
        </Stack>

        <Divider sx={{ mb: 2.5 }} />

        {/* Metadata */}
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
          Metadata
        </Typography>
        <Stack gap={0.5} mt={1} mb={2.5}>
          <FormControlLabel
            control={<Switch size="small" checked={opts.embedMetadata} onChange={(e) => set("embedMetadata", e.target.checked)} />}
            label={<Typography variant="body2">Embed metadata (title, uploader, date)</Typography>}
          />
          <FormControlLabel
            control={<Switch size="small" checked={opts.embedThumbnail} onChange={(e) => set("embedThumbnail", e.target.checked)} />}
            label={<Typography variant="body2">Embed thumbnail</Typography>}
          />
        </Stack>

        <Divider sx={{ mb: 2.5 }} />

        {/* SponsorBlock */}
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
          SponsorBlock
        </Typography>
        <Stack gap={1} mt={1} mb={2.5}>
          <FormControlLabel
            control={<Switch size="small" checked={opts.sponsorBlock} onChange={(e) => set("sponsorBlock", e.target.checked)} />}
            label={<Typography variant="body2">Remove segments (YouTube only)</Typography>}
          />
          {opts.sponsorBlock && (
            <Box>
              <Typography variant="caption" color="text.secondary" mb={0.75} display="block">
                Categories to remove:
              </Typography>
              <ToggleButtonGroup
                value={opts.sponsorBlockCategories}
                onChange={(_e, val) => set("sponsorBlockCategories", val)}
                size="small" sx={{ flexWrap: "wrap", gap: 0.5 }}
              >
                {SPONSORBLOCK_CATS.map((cat) => (
                  <ToggleButton key={cat.id} value={cat.id} sx={{
                    border: "1px solid", borderColor: "divider", borderRadius: "6px !important",
                    px: 1.25, py: 0.4, fontSize: 11, fontWeight: 600, textTransform: "none",
                    "&.Mui-selected": { bgcolor: "rgba(239,68,68,0.2)", borderColor: "error.main", color: "error.light" },
                  }}>
                    {cat.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          )}
        </Stack>

        <Divider sx={{ mb: 2.5 }} />

        {/* Rate limit */}
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
          Bandwidth
        </Typography>
        <Stack gap={1} mt={1} mb={2.5}>
          <TextField
            size="small" label="Rate limit" value={opts.rateLimit}
            onChange={(e) => set("rateLimit", e.target.value)}
            placeholder="e.g. 2M, 500K (blank = unlimited)"
            helperText="Limit download speed"
          />
        </Stack>

        <Divider sx={{ mb: 2.5 }} />

        {/* Auth */}
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
          Protected Videos
        </Typography>
        <Stack gap={1} mt={1} mb={2.5}>
          <FormControl size="small" fullWidth>
            <InputLabel>Use cookies from browser</InputLabel>
            <Select
              value={opts.cookiesBrowser ?? ""}
              label="Use cookies from browser"
              onChange={(e) => set("cookiesBrowser", e.target.value as DownloadOptions["cookiesBrowser"])}
            >
              <MenuItem value=""><em>Disabled</em></MenuItem>
              <MenuItem value="chrome">Chrome</MenuItem>
              <MenuItem value="firefox">Firefox</MenuItem>
              <MenuItem value="safari">Safari</MenuItem>
              <MenuItem value="edge">Edge</MenuItem>
              <MenuItem value="brave">Brave</MenuItem>
            </Select>
          </FormControl>
          {opts.cookiesBrowser && (
            <Typography variant="caption" color="text.secondary">
              yt-dlp will read cookies from {opts.cookiesBrowser} to access age-restricted or login-required videos.
            </Typography>
          )}
        </Stack>

        <Divider sx={{ mb: 2.5 }} />

        {/* Notifications */}
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
          Notifications
        </Typography>
        <Stack mt={1} mb={2.5}>
          <FormControlLabel
            control={<Switch size="small" checked={notifyOnComplete}
              onChange={(e) => setNotifyOnComplete(e.target.checked)} />}
            label={<Typography variant="body2">Notify when queue finishes</Typography>}
          />
        </Stack>
      </Box>

      {/* Footer */}
      <Box sx={{ p: 2.5, borderTop: "1px solid", borderColor: "divider" }}>
        <Button variant="contained" fullWidth startIcon={saved ? undefined : <SaveIcon />}
          onClick={handleSave} color={saved ? "success" : "primary"}>
          {saved ? "Saved ✓" : "Save Settings"}
        </Button>
        {opts.sponsorBlock && (
          <Stack direction="row" alignItems="center" gap={0.5} mt={1} justifyContent="center">
            <Chip label="SponsorBlock active" size="small" color="error"
              sx={{ fontSize: 11, height: 20 }} />
          </Stack>
        )}
      </Box>
    </Drawer>
  );
}

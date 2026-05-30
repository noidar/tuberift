import { useEffect, useRef } from "react";
import { Box, Typography } from "@mui/material";

interface ILogPanelProps {
  logs: string[];
}

export function LogPanel({ logs }: ILogPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <Box
      sx={{
        bgcolor: "#0a0f1e",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1.5,
        p: 1.5,
        height: 140,
        overflowY: "auto",
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      }}
    >
      {logs.length === 0 ? (
        <Typography variant="caption" color="text.secondary">
          Logs will appear here...
        </Typography>
      ) : (
        logs.map((line, i) => (
          <Typography
            key={i}
            variant="caption"
            display="block"
            sx={{
              fontFamily: "inherit",
              lineHeight: 1.6,
              color: line.includes("Error") || line.includes("Failed")
                ? "error.light"
                : line.includes("✓") || line.includes("complete")
                ? "success.light"
                : "text.secondary",
            }}
          >
            {line}
          </Typography>
        ))
      )}
      <div ref={bottomRef} />
    </Box>
  );
}

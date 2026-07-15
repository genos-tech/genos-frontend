import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { Box, Button, Sheet, Stack, Typography } from "@mui/joy";

// The dead-end counterpart to `TaskPaneLoading`.
//
// The create-task form can't render until its backend scaffold row exists,
// so a failed/hung bootstrap left the loading pane spinning forever with no
// way out and (on the silent paths) nothing in the console. This is the
// escape hatch: say what happened, and offer Retry / Cancel.
//
// Deliberately styled as the same pane (`minHeight: 500`, matching gradient,
// border and accent bar) so nothing reflows when it replaces the loader.

type TaskPaneErrorProps = {
    isDark: boolean;
    message: string;
    retryLabel: string;
    cancelLabel: string;
    onRetry: () => void;
    onCancel: () => void;
};

export const TaskPaneError = ({
    isDark,
    message,
    retryLabel,
    cancelLabel,
    onRetry,
    onCancel,
}: TaskPaneErrorProps) => (
    <Sheet
        role="alert"
        sx={{
            flex: 1,
            minHeight: 500,
            borderRadius: "16px",
            p: 0,
            overflow: "hidden",
            background: isDark
                ? "linear-gradient(180deg, rgba(22,22,28,0.98) 0%, rgba(18,18,24,1) 100%)"
                : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(252,252,255,1) 100%)",
            border: "1px solid",
            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
            boxShadow: isDark
                ? "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)"
                : "0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            px: 3,
            textAlign: "center",
        }}
    >
        {/* Accent bar — amber rather than the loader's purple, so a glance
            at the pane's top edge already says "this one needs you". */}
        <Box
            sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "3px",
                background: "linear-gradient(90deg, #f59e0b 0%, #f97316 50%, #ef4444 100%)",
                borderRadius: "16px 16px 0 0",
                opacity: 0.85,
            }}
        />

        <Box
            sx={{
                width: 48,
                height: 48,
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: isDark ? "rgba(245,158,11,0.12)" : "rgba(245,158,11,0.1)",
                border: "1px solid",
                borderColor: isDark ? "rgba(245,158,11,0.25)" : "rgba(245,158,11,0.2)",
            }}
        >
            <ErrorOutlineRoundedIcon sx={{ fontSize: 26, color: "#f59e0b" }} />
        </Box>

        <Typography
            level="body-sm"
            sx={{
                maxWidth: 380,
                color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.65)",
            }}
        >
            {message}
        </Typography>

        <Stack direction="row" spacing={1.5}>
            <Button color="neutral" size="sm" variant="plain" onClick={onCancel}>
                {cancelLabel}
            </Button>
            <Button
                size="sm"
                startDecorator={<RefreshRoundedIcon sx={{ fontSize: 16 }} />}
                variant="solid"
                sx={{
                    fontWeight: 600,
                    borderRadius: "10px",
                    px: 2.5,
                    background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                }}
                onClick={onRetry}
            >
                {retryLabel}
            </Button>
        </Stack>
    </Sheet>
);

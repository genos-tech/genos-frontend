import ReplyIcon from "@mui/icons-material/Reply";
import { Box, IconButton, Tooltip } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

type BubbleReplyButtonTypes = {
    replayHandler: (e?: React.MouseEvent) => void;
};

export const BubbleReplyButton = (props: BubbleReplyButtonTypes) => {
    const { replayHandler } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    return (
        <Box sx={{ textAlign: "right" }}>
            <Tooltip
                size="sm"
                title="Reply in thread"
                placement="top"
                sx={{
                    borderRadius: "8px",
                    fontSize: "0.75rem",
                }}
            >
                <IconButton
                    size="sm"
                    onClick={replayHandler}
                    sx={{
                        width: 28,
                        height: 28,
                        borderRadius: "8px",
                        transition: "all 0.15s ease",
                        color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)",
                        background: "transparent",
                        "&:hover": {
                            background: isDark ? "rgba(99,102,241,0.15)" : "rgba(79,70,229,0.1)",
                            color: isDark ? "#818cf8" : "#6366f1",
                            transform: "scale(1.05)",
                        },
                        "&:active": {
                            transform: "scale(0.95)",
                        },
                    }}
                >
                    <ReplyIcon sx={{ fontSize: 16 }} />
                </IconButton>
            </Tooltip>
        </Box>
    );
};

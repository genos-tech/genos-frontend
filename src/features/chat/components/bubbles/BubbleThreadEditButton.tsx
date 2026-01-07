import EditIcon from "@mui/icons-material/Edit";
import { Box, IconButton, Tooltip } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { ThreadMessageProps } from "../../../../types/chat";

type BubbleThreadEditButtonTypes = {
    message: ThreadMessageProps;
    setIsInEdit: (value: boolean) => void;
    setEditTargetMessage: (value: ThreadMessageProps) => void;
    currentMessageIndex: number;
    setTargetMessageIndex: (value: number) => void;
};

export const BubbleThreadEditButton = (props: BubbleThreadEditButtonTypes) => {
    const {
        message,
        setIsInEdit,
        setEditTargetMessage,
        currentMessageIndex,
        setTargetMessageIndex,
    } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    return (
        <Box sx={{ textAlign: "right" }}>
            <Tooltip
                size="sm"
                title="Edit"
                placement="top"
                sx={{
                    borderRadius: "8px",
                    fontSize: "0.75rem",
                }}
            >
                <IconButton
                    size="sm"
                    onClick={() => {
                        setIsInEdit(true);
                        setEditTargetMessage(message);
                        setTargetMessageIndex(currentMessageIndex);
                    }}
                    sx={{
                        width: 28,
                        height: 28,
                        borderRadius: "8px",
                        transition: "all 0.15s ease",
                        color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)",
                        background: "transparent",
                        "&:hover": {
                            background: isDark ? "rgba(251,191,36,0.15)" : "rgba(245,158,11,0.1)",
                            color: isDark ? "#fbbf24" : "#f59e0b",
                            transform: "scale(1.05)",
                        },
                        "&:active": {
                            transform: "scale(0.95)",
                        },
                    }}
                >
                    <EditIcon sx={{ fontSize: 16 }} />
                </IconButton>
            </Tooltip>
        </Box>
    );
};

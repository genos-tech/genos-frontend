import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import KeyboardArrowLeftRoundedIcon from "@mui/icons-material/KeyboardArrowLeftRounded";
import { Box, Stack, Typography, useColorScheme } from "@mui/joy";
import { Panel } from "react-resizable-panels";

interface SelectChatPanelProps {
    setMainChatPanelSize: (size: number) => void;
}

export const SelectChatPanel = ({ setMainChatPanelSize }: SelectChatPanelProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    return (
        <Panel
            defaultSize={70}
            id={"9"}
            maxSize={80}
            minSize={30}
            order={9}
            onResize={setMainChatPanelSize}
        >
            <Box
                sx={{
                    height: "100%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    width: "100%",
                    background: isDark
                        ? "radial-gradient(ellipse at center, rgba(99,102,241,0.03) 0%, transparent 70%)"
                        : "radial-gradient(ellipse at center, rgba(99,102,241,0.04) 0%, transparent 70%)",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                {/* Decorative background elements */}
                <Box
                    sx={{
                        position: "absolute",
                        width: 300,
                        height: 300,
                        borderRadius: "50%",
                        background: isDark
                            ? "radial-gradient(circle, rgba(139,92,246,0.04) 0%, transparent 70%)"
                            : "radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)",
                        top: "20%",
                        right: "15%",
                        pointerEvents: "none",
                    }}
                />
                <Box
                    sx={{
                        position: "absolute",
                        width: 200,
                        height: 200,
                        borderRadius: "50%",
                        background: isDark
                            ? "radial-gradient(circle, rgba(59,130,246,0.03) 0%, transparent 70%)"
                            : "radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 70%)",
                        bottom: "25%",
                        left: "20%",
                        pointerEvents: "none",
                    }}
                />

                {/* Main content */}
                <Stack
                    alignItems="center"
                    spacing={2.5}
                    sx={{
                        maxWidth: 280,
                        textAlign: "center",
                        zIndex: 1,
                    }}
                >
                    {/* Icon container */}
                    <Box
                        sx={{
                            width: 80,
                            height: 80,
                            borderRadius: "20px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: isDark
                                ? "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.12) 100%)"
                                : "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.08) 100%)",
                            border: isDark
                                ? "1px solid rgba(99,102,241,0.15)"
                                : "1px solid rgba(99,102,241,0.1)",
                            boxShadow: isDark
                                ? "0 8px 32px rgba(0,0,0,0.2)"
                                : "0 8px 32px rgba(99,102,241,0.08)",
                        }}
                    >
                        <ChatBubbleOutlineRoundedIcon
                            sx={{
                                fontSize: 36,
                                color: isDark ? "#a5b4fc" : "#6366f1",
                                opacity: 0.8,
                            }}
                        />
                    </Box>

                    {/* Text content */}
                    <Stack spacing={1}>
                        <Typography
                            level="h4"
                            sx={{
                                fontWeight: 700,
                                fontSize: "1.25rem",
                                color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.8)",
                                letterSpacing: "-0.02em",
                            }}
                        >
                            No conversation selected
                        </Typography>
                        <Typography
                            level="body-sm"
                            sx={{
                                color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
                                fontSize: "0.875rem",
                                lineHeight: 1.5,
                            }}
                        >
                            Choose a chat from the sidebar to start messaging
                        </Typography>
                    </Stack>

                    {/* Hint indicator */}
                    <Stack
                        direction="row"
                        alignItems="center"
                        spacing={0.5}
                        sx={{
                            mt: 1,
                            px: 1.5,
                            py: 0.75,
                            borderRadius: "8px",
                            background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                        }}
                    >
                        <KeyboardArrowLeftRoundedIcon
                            sx={{
                                fontSize: 18,
                                color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)",
                            }}
                        />
                        <Typography
                            level="body-xs"
                            sx={{
                                color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)",
                                fontWeight: 500,
                                fontSize: "0.75rem",
                            }}
                        >
                            Select from sidebar
                        </Typography>
                    </Stack>
                </Stack>
            </Box>
        </Panel>
    );
};

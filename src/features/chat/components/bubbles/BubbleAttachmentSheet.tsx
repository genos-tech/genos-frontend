import InsertDriveFileRoundedIcon from "@mui/icons-material/InsertDriveFileRounded";
import { Avatar, Box, Sheet, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

type BubbleAttachmentSheetTypes = {
    fileName: string;
    fileSize: string;
    isSent: boolean;
};

export const BubbleAttachmentSheet = (props: BubbleAttachmentSheetTypes) => {
    const { fileName, fileSize, isSent } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    // Attachment color scheme
    const attachmentColor = {
        dark: { primary: "#60a5fa", secondary: "#3b82f6" },
        light: { primary: "#3b82f6", secondary: "#2563eb" },
    };
    const colors = isDark ? attachmentColor.dark : attachmentColor.light;

    return (
        <Sheet
            sx={{
                px: 1.5,
                py: 1.25,
                borderRadius: "16px",
                position: "relative",
                overflow: "hidden",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                cursor: "pointer",
                // Variant-specific border radius
                ...(isSent ? { borderTopRightRadius: "4px" } : { borderTopLeftRadius: "4px" }),
                // Background styling
                background: isDark
                    ? `linear-gradient(135deg, ${colors.primary}15 0%, ${colors.secondary}08 100%)`
                    : `linear-gradient(135deg, ${colors.primary}10 0%, ${colors.secondary}05 100%)`,
                // Border styling
                border: "1px solid",
                borderColor: isDark ? `${colors.primary}30` : `${colors.primary}20`,
                // Shadow
                boxShadow: isDark
                    ? "0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)"
                    : "0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.5)",
                "&:hover": {
                    borderColor: isDark ? `${colors.primary}50` : `${colors.primary}35`,
                    boxShadow: isDark
                        ? `0 4px 16px ${colors.primary}20, inset 0 1px 0 rgba(255,255,255,0.05)`
                        : `0 4px 16px ${colors.primary}15, inset 0 1px 0 rgba(255,255,255,0.6)`,
                    transform: "translateY(-1px)",
                },
                "&:active": {
                    transform: "translateY(0)",
                },
            }}
        >
            {/* Subtle gradient overlay */}
            <Box
                sx={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: "40%",
                    height: "100%",
                    background: isDark
                        ? `radial-gradient(ellipse at top right, ${colors.primary}08 0%, transparent 70%)`
                        : `radial-gradient(ellipse at top right, ${colors.primary}06 0%, transparent 70%)`,
                    pointerEvents: "none",
                }}
            />

            <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center", position: "relative", zIndex: 1 }}
            >
                <Avatar
                    sx={{
                        width: 42,
                        height: 42,
                        background: isDark
                            ? `linear-gradient(135deg, ${colors.primary}25 0%, ${colors.secondary}18 100%)`
                            : `linear-gradient(135deg, ${colors.primary}20 0%, ${colors.secondary}12 100%)`,
                        border: "1px solid",
                        borderColor: isDark ? `${colors.primary}35` : `${colors.primary}25`,
                    }}
                >
                    <InsertDriveFileRoundedIcon
                        sx={{
                            fontSize: 20,
                            color: isDark ? colors.primary : colors.secondary,
                        }}
                    />
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                    <Typography
                        sx={{
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {fileName}
                    </Typography>
                    <Typography
                        level="body-xs"
                        sx={{
                            fontSize: "0.7rem",
                            fontWeight: 500,
                            color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)",
                        }}
                    >
                        {fileSize}
                    </Typography>
                </Box>
            </Stack>
        </Sheet>
    );
};

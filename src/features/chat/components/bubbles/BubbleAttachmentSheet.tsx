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

    // Attachment color scheme (palette purple — single accent for the
    // attachment chip; not encoding attachment-type differences).
    //
    // Each accent carries two forms: the plain `var(--gp-…)` token for
    // opaque use (the file icon) and its `-rgb` companion triplet for
    // tints, which must be composed as `rgba(var(--…-rgb), α)`. These are
    // theme tokens, not hex, so the previous hex-alpha concatenation
    // produced `var(--gp-brand-700)15` — not a color — and CSS discarded
    // the whole declaration, leaving the chip with no background, border
    // or glow at all.
    const attachmentColor = {
        dark: {
            primary: "var(--gp-brandalt-400)",
            primaryRgb: "var(--gp-brandalt-400-rgb)",
            secondary: "var(--gp-brand-700)",
            secondaryRgb: "var(--gp-brand-700-rgb)",
        },
        light: {
            primary: "var(--gp-brand-700)",
            primaryRgb: "var(--gp-brand-700-rgb)",
            secondary: "var(--gp-brand-800)",
            secondaryRgb: "var(--gp-brand-800-rgb)",
        },
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
                    ? `linear-gradient(135deg, rgba(${colors.primaryRgb}, 0.08) 0%, rgba(${colors.secondaryRgb}, 0.03) 100%)`
                    : `linear-gradient(135deg, rgba(${colors.primaryRgb}, 0.06) 0%, rgba(${colors.secondaryRgb}, 0.02) 100%)`,
                // Border styling
                border: "1px solid",
                borderColor: isDark
                    ? `rgba(${colors.primaryRgb}, 0.19)`
                    : `rgba(${colors.primaryRgb}, 0.13)`,
                // Shadow
                boxShadow: isDark
                    ? "0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)"
                    : "0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.5)",
                "&:hover": {
                    borderColor: isDark
                        ? `rgba(${colors.primaryRgb}, 0.31)`
                        : `rgba(${colors.primaryRgb}, 0.21)`,
                    boxShadow: isDark
                        ? `0 4px 16px rgba(${colors.primaryRgb}, 0.13), inset 0 1px 0 rgba(255,255,255,0.05)`
                        : `0 4px 16px rgba(${colors.primaryRgb}, 0.08), inset 0 1px 0 rgba(255,255,255,0.6)`,
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
                        ? `radial-gradient(ellipse at top right, rgba(${colors.primaryRgb}, 0.03) 0%, transparent 70%)`
                        : `radial-gradient(ellipse at top right, rgba(${colors.primaryRgb}, 0.02) 0%, transparent 70%)`,
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
                            ? `linear-gradient(135deg, rgba(${colors.primaryRgb}, 0.15) 0%, rgba(${colors.secondaryRgb}, 0.09) 100%)`
                            : `linear-gradient(135deg, rgba(${colors.primaryRgb}, 0.13) 0%, rgba(${colors.secondaryRgb}, 0.07) 100%)`,
                        border: "1px solid",
                        borderColor: isDark
                            ? `rgba(${colors.primaryRgb}, 0.21)`
                            : `rgba(${colors.primaryRgb}, 0.15)`,
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

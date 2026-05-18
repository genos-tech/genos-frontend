import SendRoundedIcon from "@mui/icons-material/SendRounded";
import { Box, Button, Tooltip, Typography } from "@mui/joy";

import { useTranslation } from "../../../i18n";
import { isMac } from "../../../utils/platform";

type EditorSendButtonProps = {
    /** Disable the button (typically when the editor is empty). */
    disabled: boolean;
    /** Click / keyboard-shortcut handler. */
    onSend: () => void;
};

/**
 * Send button shared by every chat-style BlockNote editor (chat, thread, task
 * comment). Replaces the legacy inline `<IconButton color="success">` blocks.
 *
 * Notes:
 * - Uses Joy `Button` (not `IconButton`) so the "Send" label + icon are
 *   semantically a single labeled action — `IconButton` is meant for icon-only.
 * - Anchored bottom-right of the parent (which must be `position: relative`)
 *   with a fixed pixel offset so the button does not drift as the editor grows
 *   line by line — the old `bottom: "5%"` percentage moved with content size.
 * - The tooltip surfaces the keyboard shortcut (⌘+⏎ on Mac, Ctrl+⏎ elsewhere)
 *   so users learn the faster path.
 * - `pointerEvents: "auto"` on the wrapper keeps the tooltip alive even when
 *   the button is disabled (Joy disables pointer events by default).
 */
export const EditorSendButton = ({ disabled, onSend }: EditorSendButtonProps) => {
    const { t } = useTranslation();
    const modKey = isMac() ? "⌘" : "Ctrl";

    return (
        <Tooltip
            arrow
            placement="top-end"
            size="sm"
            title={
                <Box
                    component="span"
                    sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.75,
                    }}
                >
                    <Typography level="body-xs" sx={{ color: "inherit", fontWeight: 600 }}>
                        {t.common.editor.send}
                    </Typography>
                    <Box
                        component="span"
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.3,
                            opacity: 0.85,
                        }}
                    >
                        <Box component="kbd" sx={kbdSx}>
                            {modKey}
                        </Box>
                        <Typography
                            level="body-xs"
                            sx={{ color: "inherit", opacity: 0.6, lineHeight: 1 }}
                        >
                            +
                        </Typography>
                        <Box component="kbd" sx={kbdSx}>
                            ⏎
                        </Box>
                    </Box>
                </Box>
            }
            variant="outlined"
        >
            <Box
                sx={{
                    position: "absolute",
                    bottom: 8,
                    right: 8,
                    zIndex: 2,
                    pointerEvents: "auto",
                }}
            >
                <Button
                    aria-label={t.common.editor.sendAriaLabel}
                    color="success"
                    disabled={disabled}
                    endDecorator={<SendRoundedIcon sx={{ fontSize: 15 }} />}
                    size="sm"
                    variant="solid"
                    onClick={onSend}
                    sx={{
                        borderRadius: "10px",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        letterSpacing: "0.01em",
                        minHeight: 30,
                        px: 1.5,
                        py: 0.5,
                        gap: 0.6,
                        background:
                            "linear-gradient(135deg, rgba(34,197,94,1) 0%, rgba(22,163,74,1) 100%)",
                        boxShadow:
                            "0 2px 8px rgba(34, 197, 94, 0.3), inset 0 1px 0 rgba(255,255,255,0.18)",
                        transition:
                            "transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease, background 0.12s ease",
                        "&:hover:not(.Mui-disabled)": {
                            transform: "translateY(-1px)",
                            boxShadow:
                                "0 4px 14px rgba(34, 197, 94, 0.42), inset 0 1px 0 rgba(255,255,255,0.22)",
                            background:
                                "linear-gradient(135deg, rgba(34,197,94,1) 0%, rgba(21,128,61,1) 100%)",
                        },
                        "&:active:not(.Mui-disabled)": {
                            transform: "translateY(0)",
                            boxShadow:
                                "0 1px 4px rgba(34, 197, 94, 0.25), inset 0 1px 0 rgba(255,255,255,0.12)",
                        },
                        "&.Mui-disabled": {
                            opacity: 0.45,
                            boxShadow: "none",
                            background:
                                "linear-gradient(135deg, rgba(34,197,94,0.6) 0%, rgba(22,163,74,0.6) 100%)",
                            color: "rgba(255,255,255,0.85)",
                        },
                    }}
                >
                    {t.common.editor.send}
                </Button>
            </Box>
        </Tooltip>
    );
};

const kbdSx = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 16,
    height: 16,
    px: 0.4,
    borderRadius: "3px",
    fontFamily: '"SF Mono", "Menlo", "Consolas", monospace',
    fontSize: "0.65rem",
    fontWeight: 700,
    lineHeight: 1,
    color: "inherit",
    bgcolor: "rgba(127, 127, 127, 0.18)",
    border: "1px solid rgba(127, 127, 127, 0.28)",
};

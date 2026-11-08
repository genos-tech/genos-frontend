import SendRoundedIcon from "@mui/icons-material/SendRounded";
import { Box, Button, Typography } from "@mui/joy";

import { useTranslation } from "../../../i18n";
import { isMac } from "../../../utils/platform";
import { AppTooltip } from "../../ui/AppTooltip";

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
        <AppTooltip
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
            arrow
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
                >
                    {t.common.editor.send}
                </Button>
            </Box>
        </AppTooltip>
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

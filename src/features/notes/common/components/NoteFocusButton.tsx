import FullscreenExitRoundedIcon from "@mui/icons-material/FullscreenExitRounded";
import FullscreenRoundedIcon from "@mui/icons-material/FullscreenRounded";
import { IconButton } from "@mui/joy";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { useTranslation } from "../../../../i18n";

interface NoteFocusButtonProps {
    /** The note already has the page to itself. */
    focused: boolean;
    onToggle: () => void;
}

/**
 * One click gives the note the whole page (hides the table / board /
 * dashboard / preview, or the chat panes); the same button gives it back.
 * Rendered by the task-note and chat-note headers, next to Close.
 */
export const NoteFocusButton = ({ focused, onToggle }: NoteFocusButtonProps) => {
    const { t } = useTranslation();
    const label = focused ? t.notes.header.exitFocusNote : t.notes.header.focusNote;
    return (
        <AppTooltip size="sm" title={label}>
            <IconButton
                aria-label={label}
                aria-pressed={focused}
                data-testid="note-focus-button"
                size="sm"
                variant="plain"
                onClick={onToggle}
            >
                {focused ? (
                    <FullscreenExitRoundedIcon sx={{ fontSize: 20 }} />
                ) : (
                    <FullscreenRoundedIcon sx={{ fontSize: 20 }} />
                )}
            </IconButton>
        </AppTooltip>
    );
};

import { useEffect, useRef, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SentimentSatisfiedAltIcon from "@mui/icons-material/SentimentSatisfiedAlt";
import { Box, Button, FormControl, FormLabel, IconButton } from "@mui/joy";

import { AppTooltip } from "../../../components/ui/AppTooltip";
import { EmojiPicker } from "../../../components/ui/emoji/EmojiPicker";
import { useTranslation } from "../../../i18n";

type Props = {
    /** The icon as stored: an emoji, or the text an older skill was given. */
    value: string;
    disabled: boolean;
    onChange: (icon: string) => void;
};

// The size of emoji-mart's picker, to place it inside the viewport (the same numbers the quick
// reactions setting uses to place the same picker).
const PICKER_HEIGHT = 435;
const PICKER_WIDTH = 352;

/** Moves the keyboard into the picker: its search box lives in emoji-mart's shadow root, which
 *  is lazy-loaded, so this looks for it for a moment after opening. */
const focusPickerSearch = (): (() => void) => {
    let tries = 0;
    const timer = window.setInterval(() => {
        const input = document
            .querySelector("em-emoji-picker")
            ?.shadowRoot?.querySelector<HTMLInputElement>("input[type='search']");
        tries += 1;
        if (input) input.focus();
        if (input || tries >= 20) window.clearInterval(timer);
    }, 50);
    return () => window.clearInterval(timer);
};

/**
 * The "Icon" of a skill: the app's emoji picker (MIP-2209), not a text box.
 *
 * It stores the emoji in the same `icon` field as before. An older skill whose icon is plain text
 * keeps showing that text on the button until the person picks an emoji or removes it. The team's
 * custom emoji are left out: an icon is shown in lists and menus that cannot resolve a `:name:`.
 *
 * The picker is a fixed-position popup, so the field closes it on Escape, on scroll or resize
 * (it would otherwise float over other fields), and when the skill turns read-only; the button
 * toggles it, and focus goes into the picker when it opens and back to the button when it closes.
 */
export const SkillIconField = ({ value, disabled, onChange }: Props) => {
    const { t } = useTranslation();
    const f = t.settings.genosSkills.fields;
    const anchorRef = useRef<HTMLButtonElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    // The picker closes itself on any mouse press outside it, the button's included, which would
    // make the click that follows reopen it. The press is noted first (React's handler runs
    // before the picker's document listener) so the click can tell it was a "close".
    const wasOpenOnPress = useRef(false);
    const isOpen = pos !== null && !disabled;

    const close = (returnFocus: boolean) => {
        setPos(null);
        if (returnFocus) anchorRef.current?.focus();
    };

    const open = () => {
        const rect = anchorRef.current?.getBoundingClientRect();
        if (!rect) return;
        // Below the button; above it when there is no room; never outside the viewport.
        const top =
            window.innerHeight - rect.bottom > PICKER_HEIGHT + 20
                ? rect.bottom + 8
                : Math.max(20, rect.top - PICKER_HEIGHT - 8);
        const left = Math.max(20, Math.min(rect.left, window.innerWidth - PICKER_WIDTH - 20));
        setPos({ top, left });
    };

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") close(true);
        };
        const onMove = () => setPos(null);
        document.addEventListener("keydown", onKey, true);
        window.addEventListener("scroll", onMove, true);
        window.addEventListener("resize", onMove);
        const stopFocusing = focusPickerSearch();
        return () => {
            document.removeEventListener("keydown", onKey, true);
            window.removeEventListener("scroll", onMove, true);
            window.removeEventListener("resize", onMove);
            stopFocusing();
        };
    }, [isOpen]);

    return (
        <FormControl>
            <FormLabel>{f.icon}</FormLabel>
            {/* A row, so the clear button never covers the button (and follows the reading
                direction): the emoji button gives up the width the clear button takes. */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                <Button
                    ref={anchorRef}
                    aria-expanded={isOpen}
                    aria-label={value ? `${f.iconChoose}: ${value}` : f.iconChoose}
                    color="neutral"
                    disabled={disabled}
                    variant="outlined"
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        // The height of the title field beside it.
                        height: 36,
                        minHeight: 36,
                        px: 0.5,
                        fontSize: "20px",
                        fontWeight: 400,
                        lineHeight: 1,
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                    }}
                    onClick={() => {
                        const wasOpen = wasOpenOnPress.current || pos !== null;
                        wasOpenOnPress.current = false;
                        if (wasOpen) close(false);
                        else open();
                    }}
                    onMouseDown={() => {
                        wasOpenOnPress.current = pos !== null;
                    }}
                >
                    {value || <SentimentSatisfiedAltIcon sx={{ color: "text.tertiary" }} />}
                </Button>
                {value !== "" && !disabled && (
                    <AppTooltip size="sm" title={f.iconClear}>
                        <IconButton
                            aria-label={f.iconClear}
                            color="neutral"
                            size="sm"
                            variant="plain"
                            onClick={() => onChange("")}
                        >
                            <CloseRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </AppTooltip>
                )}
            </Box>
            {isOpen && (
                <EmojiPicker
                    includeCustom={false}
                    pickerLeftPosition={pos.left}
                    pickerRightPosition="auto"
                    pickerTopPosition={pos.top}
                    setSelectedEmoji={(emoji) => {
                        // The picker also reports `null` for a click outside it.
                        if (emoji) {
                            onChange(emoji);
                            anchorRef.current?.focus();
                        }
                    }}
                    setShowEmojiPicker={(shown) => {
                        // A click elsewhere closes it too: focus stays where that click put it.
                        if (!shown) close(false);
                    }}
                    showEmojiPicker
                    useFixedPosition
                />
            )}
        </FormControl>
    );
};

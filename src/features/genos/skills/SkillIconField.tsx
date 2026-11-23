import { useRef, useState } from "react";
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

/**
 * The "Icon" of a skill: the app's emoji picker (MIP-2209), not a text box.
 *
 * It stores the emoji in the same `icon` field as before. An older skill whose icon is plain text
 * keeps showing that text on the button until the person picks an emoji or removes it. The team's
 * custom emoji are left out: an icon is shown in lists and menus that cannot resolve a `:name:`.
 */
export const SkillIconField = ({ value, disabled, onChange }: Props) => {
    const { t } = useTranslation();
    const f = t.settings.genosSkills.fields;
    const anchorRef = useRef<HTMLButtonElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

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

    return (
        <FormControl>
            <FormLabel>{f.icon}</FormLabel>
            <Box sx={{ position: "relative" }}>
                <Button
                    ref={anchorRef}
                    aria-expanded={pos !== null}
                    aria-haspopup="dialog"
                    aria-label={value ? `${f.iconChoose}: ${value}` : f.iconChoose}
                    color="neutral"
                    disabled={disabled}
                    variant="outlined"
                    sx={{
                        width: "100%",
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
                    onClick={open}
                >
                    {value || <SentimentSatisfiedAltIcon sx={{ color: "text.tertiary" }} />}
                </Button>
                {value !== "" && !disabled && (
                    <AppTooltip size="sm" title={f.iconClear}>
                        <IconButton
                            aria-label={f.iconClear}
                            size="sm"
                            variant="soft"
                            sx={{
                                position: "absolute",
                                top: -8,
                                right: -8,
                                "--IconButton-size": "20px",
                                minHeight: 20,
                                borderRadius: "50%",
                                // A touch screen gets a 44px target through the pseudo-element,
                                // not a bigger badge.
                                "@media (pointer: coarse)": {
                                    "&::after": {
                                        content: '""',
                                        position: "absolute",
                                        inset: -12,
                                    },
                                },
                            }}
                            onClick={() => onChange("")}
                        >
                            <CloseRoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                    </AppTooltip>
                )}
            </Box>
            {pos !== null && (
                <EmojiPicker
                    includeCustom={false}
                    pickerLeftPosition={pos.left}
                    pickerRightPosition="auto"
                    pickerTopPosition={pos.top}
                    setSelectedEmoji={(emoji) => {
                        // The picker also reports `null` for a click outside it.
                        if (emoji) onChange(emoji);
                    }}
                    setShowEmojiPicker={(shown) => {
                        if (!shown) setPos(null);
                    }}
                    showEmojiPicker
                    useFixedPosition
                />
            )}
        </FormControl>
    );
};

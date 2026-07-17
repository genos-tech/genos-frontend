import "@blocknote/mantine/style.css";

import { DefaultReactSuggestionItem, useComponentsContext } from "@blocknote/react";
import GifBoxOutlinedIcon from "@mui/icons-material/GifBoxOutlined";
import { useColorScheme } from "@mui/joy/styles";

import { useTranslation } from "../../i18n";

// "/gif" slash-menu entry. The toolbar button only appears on text
// selection (notes/task body) or isn't discoverable (mobile), so the
// slash menu is the always-available path to the GIF picker. BlockNote
// removes the typed "/gif" text itself when the item is clicked.
export const gifSlashMenuItem = (
    setShowGifPicker: (value: boolean) => void
): DefaultReactSuggestionItem => ({
    title: "GIF",
    subtext: "Search GIPHY and insert a GIF",
    aliases: ["gif", "giphy"],
    group: "Media",
    icon: <GifBoxOutlinedIcon style={{ fontSize: 18 }} />,
    onItemClick: () => setShowGifPicker(true),
});

type GifToolbarButtonProps = {
    setShowGifPicker: (value: boolean) => void;
};

// Formatting-toolbar button that opens the GIF search picker. Sibling
// of CustomEmojiToolbar — same placement and mobile gating rules.
export const GifToolbarButton = (props: GifToolbarButtonProps) => {
    const { setShowGifPicker } = props;
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const Components = useComponentsContext()!;

    return (
        <Components.FormattingToolbar.Button
            mainTooltip={t.common.editor.gif}
            onClick={() => setShowGifPicker(true)}
        >
            <GifBoxOutlinedIcon
                sx={{ fontSize: "17px", color: mode === "dark" ? "white" : "black" }}
            />
        </Components.FormattingToolbar.Button>
    );
};

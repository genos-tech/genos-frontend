import "@blocknote/mantine/style.css";

import { DefaultReactSuggestionItem, useComponentsContext } from "@blocknote/react";
import GifBoxOutlinedIcon from "@mui/icons-material/GifBoxOutlined";
import { useColorScheme } from "@mui/joy/styles";

import { getMessages, useTranslation } from "../../i18n";

// "/gif" slash-menu entry. The toolbar button only appears on text
// selection (notes/task body) or isn't discoverable (mobile), so the
// slash menu is the always-available path to the GIF picker. BlockNote
// removes the typed "/gif" text itself when the item is clicked.
export const gifSlashMenuItem = (
    setShowGifPicker: (value: boolean) => void,
    mediaGroup?: string
): DefaultReactSuggestionItem => {
    const copy = getMessages().common.editor;
    return {
        title: copy.gif,
        subtext: copy.gifSlashDescription,
        aliases: ["gif", "giphy"],
        group: mediaGroup ?? copy.gifSlashGroup,
        icon: <GifBoxOutlinedIcon style={{ fontSize: 18 }} />,
        onItemClick: () => setShowGifPicker(true),
    };
};

// Splice the GIF item INTO the existing Media group instead of
// appending it. BlockNote's menu emits one group label per group
// TRANSITION and keys labels by the group name — an out-of-place
// second "Media" run renders a duplicate label whose stale DOM node
// then survives query narrowing (the "Media Media Media" bug).
export const withGifSlashItem = (
    items: DefaultReactSuggestionItem[],
    setShowGifPicker: (value: boolean) => void
): DefaultReactSuggestionItem[] => {
    // BlockNote localizes its built-in group names. Its image aliases retain
    // `imageUpload` in every shipped dictionary, so use that item to discover
    // the active locale's Media label instead of comparing against English.
    const mediaGroup =
        items.find((item) => item.aliases?.includes("imageUpload"))?.group ??
        getMessages().common.editor.gifSlashGroup;
    const gif = gifSlashMenuItem(setShowGifPicker, mediaGroup);
    const lastMedia = items.map((i) => i.group).lastIndexOf(mediaGroup);
    if (lastMedia === -1) {
        return [...items, gif];
    }
    return [...items.slice(0, lastMedia + 1), gif, ...items.slice(lastMedia + 1)];
};

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

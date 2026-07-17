import "@blocknote/mantine/style.css";

import { useComponentsContext } from "@blocknote/react";
import GifBoxOutlinedIcon from "@mui/icons-material/GifBoxOutlined";
import { useColorScheme } from "@mui/joy/styles";

import { useTranslation } from "../../i18n";

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

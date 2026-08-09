import "@blocknote/mantine/style.css";

import { useComponentsContext } from "@blocknote/react";
import AddIcon from "@mui/icons-material/Add";
import { useColorScheme } from "@mui/joy/styles";

import { useTranslation } from "../../i18n";

type AttachFileToolbarButtonProps = {
    onClick: () => void;
};

// Formatting-toolbar button that opens the OS file picker so images /
// files can be attached from a phone, where BlockNote's drag-drop and
// side-menu insert paths aren't reachable. Sibling of CustomEmojiToolbar
// / GifToolbarButton — same placement and styling. The hidden <input>
// and upload/insert loop live in the owning editor; this button just
// triggers it.
export const AttachFileToolbarButton = (props: AttachFileToolbarButtonProps) => {
    const { onClick } = props;
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const Components = useComponentsContext()!;

    return (
        <Components.FormattingToolbar.Button
            mainTooltip={t.common.editor.attachFile}
            onClick={onClick}
        >
            <AddIcon sx={{ fontSize: "17px", color: mode === "dark" ? "white" : "black" }} />
        </Components.FormattingToolbar.Button>
    );
};

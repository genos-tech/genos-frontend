import "@blocknote/mantine/style.css";

import { useComponentsContext } from "@blocknote/react";
import SentimentSatisfiedAltIcon from "@mui/icons-material/SentimentSatisfiedAlt";
import { useColorScheme } from "@mui/joy/styles";

type CustomEmojiToolbarProps = {
    setShowEmojiPicker: (value: boolean) => void;
};

// Custom Formatting Toolbar Button to toggle blue text & background color.
export const CustomEmojiToolbar = (props: CustomEmojiToolbarProps) => {
    const { setShowEmojiPicker } = props;
    const { mode } = useColorScheme();
    const Components = useComponentsContext()!;

    return (
        <Components.FormattingToolbar.Button
            mainTooltip={"Emoji"}
            secondaryTooltip=":+typing"
            onClick={() => setShowEmojiPicker(true)}
        >
            <SentimentSatisfiedAltIcon
                sx={{ fontSize: "17px", color: mode === "dark" ? "white" : "black" }}
            />
        </Components.FormattingToolbar.Button>
    );
};

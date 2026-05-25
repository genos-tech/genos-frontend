import "@blocknote/mantine/style.css";

import { useComponentsContext } from "@blocknote/react";
import CodeIcon from "@mui/icons-material/Code";
import WrapTextIcon from "@mui/icons-material/WrapText";
import { useColorScheme } from "@mui/joy/styles";

type WrapToggleToolbarButtonsProps = {
    unwrapAll: boolean;
    setUnwrapAll: (value: boolean) => void;
    unwrapCode: boolean;
    setUnwrapCode: (value: boolean) => void;
};

// Toolbar-integrated variant of `WrapToggleButtons`. Lives inside the
// always-visible BlockNote `FormattingToolbar` in the chat and thread
// editors, so it must use `Components.FormattingToolbar.Button` to
// match the surrounding bold/italic/etc. buttons visually.
// Behaviour matches the floating variant: state is local to the parent
// editor (no persistence) and the two toggles are independent.
export const WrapToggleToolbarButtons = (props: WrapToggleToolbarButtonsProps) => {
    const { unwrapAll, setUnwrapAll, unwrapCode, setUnwrapCode } = props;
    const { mode } = useColorScheme();
    const Components = useComponentsContext()!;
    const iconColor = mode === "dark" ? "white" : "black";

    return (
        <>
            <Components.FormattingToolbar.Button
                mainTooltip={unwrapAll ? "Wrap all content" : "Unwrap all content"}
                isSelected={unwrapAll}
                onClick={() => setUnwrapAll(!unwrapAll)}
            >
                <WrapTextIcon sx={{ fontSize: "17px", color: iconColor }} />
            </Components.FormattingToolbar.Button>
            <Components.FormattingToolbar.Button
                mainTooltip={unwrapCode ? "Wrap code blocks" : "Unwrap code blocks only"}
                isSelected={unwrapCode}
                onClick={() => setUnwrapCode(!unwrapCode)}
            >
                <CodeIcon sx={{ fontSize: "17px", color: iconColor }} />
            </Components.FormattingToolbar.Button>
        </>
    );
};

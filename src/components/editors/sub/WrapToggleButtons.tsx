import CodeIcon from "@mui/icons-material/Code";
import WrapTextIcon from "@mui/icons-material/WrapText";
import { IconButton, Stack } from "@mui/joy";

import { AppTooltip } from "../../ui/AppTooltip";

type WrapToggleButtonsProps = {
    unwrapAll: boolean;
    setUnwrapAll: (value: boolean) => void;
    unwrapCode: boolean;
    setUnwrapCode: (value: boolean) => void;
};

// Two independent toggles rendered as a tight horizontal IconButton row.
// Designed to be placed by the parent inside an absolutely-positioned
// container at the top-right of the editor (matches the Comments-toggle
// pattern in the note editors).
//
//   • Unwrap-all   → ONE editor-wide horizontal scrollbar. Every block
//                    stops wrapping and the editor itself scrolls
//                    horizontally — so all content slides together.
//   • Unwrap-code  → per-block scroll, scoped to code blocks. Prose
//                    stays readable.
//
// Both are independent and state lives in the parent editor component,
// so it resets when the editor unmounts (no persistence by design).
export const WrapToggleButtons = (props: WrapToggleButtonsProps) => {
    const { unwrapAll, setUnwrapAll, unwrapCode, setUnwrapCode } = props;

    return (
        <Stack direction="row" spacing={0.5}>
            <AppTooltip
                placement="top"
                size="sm"
                title={unwrapAll ? "Wrap all content" : "Unwrap all content"}
            >
                <IconButton
                    color="neutral"
                    size="sm"
                    variant={unwrapAll ? "solid" : "outlined"}
                    onClick={() => setUnwrapAll(!unwrapAll)}
                >
                    <WrapTextIcon sx={{ fontSize: 16 }} />
                </IconButton>
            </AppTooltip>
            <AppTooltip
                placement="top"
                size="sm"
                title={unwrapCode ? "Wrap code blocks" : "Unwrap code blocks only"}
            >
                <IconButton
                    color="neutral"
                    size="sm"
                    variant={unwrapCode ? "solid" : "outlined"}
                    onClick={() => setUnwrapCode(!unwrapCode)}
                >
                    <CodeIcon sx={{ fontSize: 16 }} />
                </IconButton>
            </AppTooltip>
        </Stack>
    );
};

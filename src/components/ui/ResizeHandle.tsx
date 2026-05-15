import { useColorScheme } from "@mui/joy/styles";
import { PanelResizeHandle } from "react-resizable-panels";

import { purplePalette } from "../../theme/purplePalette";

interface ResizeHandleProps {
    className?: string;
    direction?: "horizontal" | "vertical";
}

// Canonical thin resize handle for react-resizable-panels.
// Pass className to keep feature-scoped hover-width CSS animations that are
// already defined in each Home's <style> block.
export const ResizeHandle = ({
    className = "resize-handle",
    direction = "horizontal",
}: ResizeHandleProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const color = isDark ? purplePalette.dark.border : purplePalette.light.border;

    return (
        <PanelResizeHandle
            className={className}
            style={{
                [direction === "horizontal" ? "width" : "height"]: "1px",
                backgroundColor: color,
                transition: "all 0.3s ease-in-out",
                cursor: direction === "horizontal" ? "col-resize" : "row-resize",
            }}
        />
    );
};

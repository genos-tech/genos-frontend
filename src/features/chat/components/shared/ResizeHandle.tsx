import { useColorScheme } from "@mui/joy/styles";
import { PanelResizeHandle } from "react-resizable-panels";

interface ResizeHandleProps {
    className?: string;
}
export const ResizeHandle = (props: ResizeHandleProps) => {
    const { className = "chat-resize-handle" } = props;
    const { mode } = useColorScheme();

    return (
        <PanelResizeHandle
            className={className}
            style={{
                width: "1px",
                backgroundColor: mode === "dark" ? "black" : "white",
                transition: "all 0.3s ease-in-out",
                cursor: "col-resize",
            }}
        />
    );
};

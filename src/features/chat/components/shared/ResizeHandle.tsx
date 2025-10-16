import { useColorScheme } from "@mui/joy/styles";
import { PanelResizeHandle } from "react-resizable-panels";

interface ResizeHandleProps {
    key: string;
    className?: string;
}

export const ResizeHandle = ({ key, className = "chat-resize-handle" }: ResizeHandleProps) => {
    const { mode } = useColorScheme();

    return (
        <PanelResizeHandle
            key={key}
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

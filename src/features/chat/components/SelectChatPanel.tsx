import { Box, IconButton } from "@mui/joy";
import { Panel } from "react-resizable-panels";

interface SelectChatPanelProps {
    mainChatPanelSize: number;
    setMainChatPanelSize: (size: number) => void;
}

export const SelectChatPanel = ({
    mainChatPanelSize,
    setMainChatPanelSize,
}: SelectChatPanelProps) => {
    return (
        <Panel
            defaultSize={70}
            id={"9"}
            maxSize={80}
            minSize={30}
            order={9}
            onResize={setMainChatPanelSize}
        >
            <Box
                sx={{
                    height: "100%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    width: "100%",
                }}
            >
                <IconButton
                    color="neutral"
                    component="button"
                    variant="soft"
                    sx={{
                        fontSize: "15px",
                        padding: "10px",
                    }}
                >
                    No Chat Selected
                </IconButton>
            </Box>
        </Panel>
    );
};

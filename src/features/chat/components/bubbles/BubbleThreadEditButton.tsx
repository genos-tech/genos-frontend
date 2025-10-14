import EditIcon from "@mui/icons-material/Edit";
import { Box, IconButton, Tooltip } from "@mui/joy";

import { ThreadMessageProps } from "../../../../types/chat";

type BubbleThreadEditButtonTypes = {
    message: ThreadMessageProps;
    setIsInEdit: (value: boolean) => void;
    setEditTargetMessage: (value: ThreadMessageProps) => void;
    currentMessageIndex: number;
    setTargetMessageIndex: (value: number) => void;
};
export const BubbleThreadEditButton = (props: BubbleThreadEditButtonTypes) => {
    const {
        message,
        setIsInEdit,
        setEditTargetMessage,
        currentMessageIndex,
        setTargetMessageIndex,
    } = props;
    return (
        <Box sx={{ textAlign: "right" }}>
            <>
                <Tooltip size="sm" title="Edit">
                    <IconButton
                        size="sm"
                        sx={{ ml: "0px" }}
                        onClick={() => {
                            setIsInEdit(true);
                            setEditTargetMessage(message);
                            setTargetMessageIndex(currentMessageIndex);
                        }}
                    >
                        <EditIcon />
                    </IconButton>
                </Tooltip>
            </>
        </Box>
    );
};

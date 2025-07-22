import { Tooltip, Box, IconButton } from "@mui/joy";
import EditIcon from "@mui/icons-material/Edit";
import { MessageProps } from "../../../../types/chat";

type BubbleEditButtonTypes = {
    message: MessageProps;
    setIsInEdit: (value: boolean) => void;
    setEditTargetMessage: (value: MessageProps) => void;
    currentMessageIndex: number;
    setTargetMessageIndex: (value: number) => void;
};
export const BubbleEditButton = (props: BubbleEditButtonTypes) => {
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
                <Tooltip title="Edit" size="sm">
                    <IconButton
                        size="sm"
                        onClick={() => {
                            setIsInEdit(true);
                            setEditTargetMessage(message);
                            setTargetMessageIndex(currentMessageIndex);
                        }}
                        sx={{ ml: "0px" }}
                    >
                        <EditIcon />
                    </IconButton>
                </Tooltip>
            </>
        </Box>
    );
};

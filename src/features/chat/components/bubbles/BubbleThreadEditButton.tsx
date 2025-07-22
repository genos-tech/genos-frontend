import { Tooltip, Box, IconButton } from "@mui/joy";
import EditIcon from "@mui/icons-material/Edit";
import { ThreadMessageProps } from "../../../../types/chat";

type BubbleThreadEditButtonTypes = {
    message: ThreadMessageProps;
    setIsInEdit: (value: boolean) => void;
    setEditTargetMessage: (value: ThreadMessageProps) => void;
};
export const BubbleThreadEditButton = (props: BubbleThreadEditButtonTypes) => {
    const { message, setIsInEdit, setEditTargetMessage } = props;
    return (
        <Box sx={{ textAlign: "right" }}>
            <>
                <Tooltip title="Edit" size="sm">
                    <IconButton
                        size="sm"
                        onClick={() => {
                            setIsInEdit(true);
                            setEditTargetMessage(message);
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

import EditIcon from "@mui/icons-material/Edit";
import { Box, IconButton, Tooltip } from "@mui/joy";

import { MessageProps } from "../../../../types/chat";

type BubbleEditButtonTypes = {
    message: MessageProps;
    setIsInEdit: (value: boolean) => void;
    setEditTargetMessage: (value: MessageProps) => void;
};
export const BubbleEditButton = (props: BubbleEditButtonTypes) => {
    const { message, setIsInEdit, setEditTargetMessage } = props;
    return (
        <Box sx={{ textAlign: "right" }}>
            <>
                <Tooltip size="sm" title="Edit" variant="outlined">
                    <IconButton
                        size="sm"
                        sx={{ ml: "0px" }}
                        onClick={() => {
                            setIsInEdit(true);
                            setEditTargetMessage(message);
                        }}
                    >
                        <EditIcon />
                    </IconButton>
                </Tooltip>
            </>
        </Box>
    );
};

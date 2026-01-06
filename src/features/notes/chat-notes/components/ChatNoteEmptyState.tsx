import { Box, IconButton } from "@mui/joy";

export const ChatNoteEmptyState = () => {
    return (
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
                No Note Selected
            </IconButton>
        </Box>
    );
};

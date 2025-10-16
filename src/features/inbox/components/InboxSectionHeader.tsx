import { Box, Chip, Typography } from "@mui/joy";

type InboxSectionHeaderProps = {
    title: string;
    unreadCount?: number;
};

export const InboxSectionHeader = ({ title, unreadCount }: InboxSectionHeaderProps) => {
    return (
        <Box
            sx={{
                width: "50%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
            }}
        >
            {unreadCount && unreadCount > 0 ? (
                <>
                    <Typography level="h4">{title}</Typography>
                    <Chip color="primary" size="sm" sx={{ ml: "5px" }} variant="solid">
                        {unreadCount}
                    </Chip>
                </>
            ) : (
                <Typography level="h4" sx={{ mt: "10px" }}>
                    {title}
                </Typography>
            )}
        </Box>
    );
};

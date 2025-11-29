import AllInboxIcon from "@mui/icons-material/AllInbox";
import { Card, Typography } from "@mui/joy";

export const InboxHeader = () => {
    return (
        <Card
            className="Sidebar-overlay"
            variant="soft"
            sx={{
                height: "50px",
                justifyContent: "center",
                borderRadius: "0",
            }}
        >
            <Typography level="h4" startDecorator={<AllInboxIcon />}>
                Inbox
            </Typography>
        </Card>
    );
};

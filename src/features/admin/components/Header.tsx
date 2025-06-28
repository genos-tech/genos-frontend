import { Box, IconButton, Typography } from "@mui/joy";
import BusinessIcon from "@mui/icons-material/Business";

import { ColorSchemeToggle } from "../../../components/layout/colorSchemeToggle";

export const AdminHeader = () => {
    return (
        <Box component="header" sx={{ py: 3, display: "flex", justifyContent: "space-between" }}>
            <Box sx={{ gap: 2, display: "flex", alignItems: "center" }}>
                <IconButton component="a" variant="soft" color="neutral" size="sm">
                    <BusinessIcon />
                </IconButton>
                <Typography level="title-lg">Origin</Typography>
            </Box>
            <ColorSchemeToggle />
        </Box>
    );
};

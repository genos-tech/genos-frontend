import BusinessIcon from "@mui/icons-material/Business";
import { Box, IconButton, Typography } from "@mui/joy";

import { ColorSchemeToggle } from "../../../components/layout/colorSchemeToggle";

export const AdminHeader = () => {
    return (
        <Box component="header" sx={{ py: 3, display: "flex", justifyContent: "space-between" }}>
            <Box sx={{ gap: 2, display: "flex", alignItems: "center" }}>
                <IconButton color="neutral" component="a" size="sm" variant="soft">
                    <BusinessIcon />
                </IconButton>
                <Typography level="title-lg">Origin</Typography>
            </Box>
            <ColorSchemeToggle />
        </Box>
    );
};

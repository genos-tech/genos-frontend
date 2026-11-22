import { Box, Typography } from "@mui/joy";

import { g, type } from "../../../theme/tokens";

/** Heading between groups of cards: one `h2` per group (the page `h1` is the PageHeader's). */
export const SectionHeading = ({
    title,
    description,
}: {
    title: string;
    description?: string;
}) => (
    <Box sx={{ minWidth: 0 }}>
        <Typography component="h2" sx={{ ...type("title-md"), color: g.text.primary, m: 0 }}>
            {title}
        </Typography>
        {description && (
            <Typography sx={{ ...type("body-sm"), color: g.text.secondary }}>
                {description}
            </Typography>
        )}
    </Box>
);

/** Section rhythm: 24 px between page sections (20 on phone), 12 px between cards in a grid. */
export const DashboardGrid = ({
    cols = "auto",
    children,
}: {
    cols?: "auto" | 2;
    children: React.ReactNode;
}) => (
    <Box
        sx={{
            display: "grid",
            gap: 1.5,
            minWidth: 0,
            gridTemplateColumns:
                cols === "auto"
                    ? "repeat(auto-fit, minmax(280px, 1fr))"
                    : { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
        }}
    >
        {children}
    </Box>
);

import { memo, ReactNode, useState } from "react";
import { Box, List, ListItem } from "@mui/joy";

import { NavItem } from "../../../../components/ui/nav/NavItem";
import { navNestedListSx } from "../../../../components/ui/nav/navStyles";

interface FavoriteNoteSectionProps {
    groupKey: string;
    groupLabel: string;
    icon: ReactNode;
    children: ReactNode;
    defaultExpanded?: boolean;
}

function FavoriteNoteSectionComponent({
    groupKey,
    groupLabel,
    icon,
    children,
    defaultExpanded = false,
}: FavoriteNoteSectionProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <Box key={groupKey}>
            <ListItem sx={{ p: 0 }} nested>
                <NavItem
                    as="div"
                    expanded={isExpanded}
                    icon={icon}
                    label={groupLabel}
                    onClick={() => setIsExpanded(!isExpanded)}
                />

                {/* Children with smooth animation */}
                <Box
                    sx={{
                        display: "grid",
                        transition: "grid-template-rows 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        gridTemplateRows: isExpanded ? "1fr" : "0fr",
                        "& > *": {
                            overflow: "hidden",
                        },
                    }}
                >
                    <List sx={navNestedListSx}>{children}</List>
                </Box>
            </ListItem>
        </Box>
    );
}

export const FavoriteNoteSection = memo(FavoriteNoteSectionComponent);

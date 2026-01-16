import { memo, ReactNode, useState } from "react";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { Box, List, ListItem, ListItemButton, ListItemContent, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

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
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <Box key={groupKey}>
            <ListItem nested>
                <ListItemButton
                    onClick={() => setIsExpanded(!isExpanded)}
                    sx={{
                        borderRadius: "8px",
                        py: 0.5,
                        px: 1,
                        my: 0.25,
                        gap: 0.75,
                        minHeight: 32,
                        transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                        backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
                        "&:hover": {
                            backgroundColor: isDark
                                ? "rgba(255,255,255,0.06)"
                                : "rgba(0,0,0,0.04)",
                        },
                    }}
                >
                    {/* Chevron */}
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 16,
                            height: 16,
                            borderRadius: "4px",
                            flexShrink: 0,
                            transition: "all 0.15s ease",
                        }}
                    >
                        <ChevronRightRoundedIcon
                            sx={{
                                fontSize: 13,
                                color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.35)",
                                transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                            }}
                        />
                    </Box>

                    {/* Icon */}
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)",
                            flexShrink: 0,
                        }}
                    >
                        {icon}
                    </Box>

                    <ListItemContent sx={{ minWidth: 0 }}>
                        <Typography
                            level="body-xs"
                            sx={{
                                fontWeight: 600,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)",
                                fontSize: "0.75rem",
                                letterSpacing: "-0.01em",
                            }}
                        >
                            {groupLabel}
                        </Typography>
                    </ListItemContent>
                </ListItemButton>

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
                    <List
                        sx={{
                            pl: 1.5,
                            "--List-nestedInsetStart": "16px",
                        }}
                    >
                        {children}
                    </List>
                </Box>
            </ListItem>
        </Box>
    );
}

export const FavoriteNoteSection = memo(FavoriteNoteSectionComponent);

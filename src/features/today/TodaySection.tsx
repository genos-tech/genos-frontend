import { ReactNode } from "react";
import type { SvgIconComponent } from "@mui/icons-material";
import { Box, Typography } from "@mui/joy";

import { g, type } from "../../theme/tokens";
import {
    SECTION_BADGE_PX,
    SECTION_HEADER_SX,
    SECTION_LOOK,
    sectionCardSx,
    TodayCourt,
    TodayHue,
} from "./sectionStyles";

type Props = {
    title: string;
    count: number;
    icon: SvgIconComponent;
    hue?: TodayHue;
    court?: TodayCourt;
    id?: string;
    children: ReactNode;
};

export const TodaySection = ({
    title,
    count,
    icon: Icon,
    hue = "neutral",
    court = "mine",
    id,
    children,
}: Props) => {
    const look = SECTION_LOOK[hue];
    const mine = court === "mine";
    return (
        <Box
            aria-label={title}
            component="section"
            data-court={court}
            data-hue={hue}
            id={id}
            sx={sectionCardSx(court, look.rule)}
        >
            <Typography component="h3" level="title-sm" sx={SECTION_HEADER_SX}>
                <Box
                    aria-hidden="true"
                    component="span"
                    data-testid="today-section-badge"
                    sx={{
                        display: "inline-flex",
                        flexShrink: 0,
                        alignItems: "center",
                        justifyContent: "center",
                        boxSizing: "border-box",
                        width: SECTION_BADGE_PX,
                        height: SECTION_BADGE_PX,
                        borderRadius: g.radius.sm,
                        ...(mine
                            ? { bgcolor: look.tint, color: look.ink }
                            : {
                                  border: `1px dashed ${g.border.strong}`,
                                  color: g.text.secondary,
                              }),
                        "& svg": { fontSize: 16 },
                    }}
                >
                    <Icon />
                </Box>
                <Box
                    component="span"
                    data-testid="today-section-title"
                    sx={{ minWidth: 0, color: g.text.primary }}
                >
                    {title}
                </Box>
                <Box
                    component="span"
                    sx={{
                        ...type("body-xs"),
                        flexShrink: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 20,
                        height: 20,
                        px: 0.75,
                        boxSizing: "border-box",
                        borderRadius: g.radius.full,
                        bgcolor: look.tint,
                        color: look.countInk,
                        fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {count}
                </Box>
            </Typography>
            <Box component="ul" sx={{ m: 0, p: 0 }}>
                {children}
            </Box>
        </Box>
    );
};

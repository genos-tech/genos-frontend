import { ReactNode } from "react";
import { Box, Typography } from "@mui/joy";

import { g, type } from "../../../theme/tokens";
import { EmptyState } from "../feedback/EmptyState";
import { CHART_H } from "./chartUtils";
import { DashboardCard, DashboardCardProps } from "./DashboardCard";

export type LegendItem = {
    key: string;
    label: string;
    /** A chart-series token (`g.chart.series1`) or any `g` colour. */
    color: string;
};

/**
 * A chart inside a DashboardCard (MIP-1963): fixed plot height so loading, empty and ready
 * do not jump, the legend ABOVE the plot, an empty plot shown as `EmptyState size="xs"` at
 * the same height, and a `role="img"` summary of the totals for assistive tech. Series
 * colours come from `g.chart.series1-4`; status / priority / effort from the tone maps.
 */
export const ChartFrame = ({
    legend,
    summary,
    empty,
    emptyText,
    children,
    ...card
}: Omit<DashboardCardProps, "state" | "children" | "minBodyHeight"> & {
    legend?: LegendItem[];
    /** Reads the totals ("Created 4, closed 2, ..."). Localised by the caller. */
    summary: string;
    empty?: boolean;
    emptyText?: string;
    state?: DashboardCardProps["state"];
    children: ReactNode;
}) => {
    return (
        <DashboardCard {...card} state={card.state ?? "ready"}>
            {legend && legend.length > 0 && (
                <Box
                    component="ul"
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 2,
                        listStyle: "none",
                        m: 0,
                        mb: 1,
                        p: 0,
                    }}
                >
                    {legend.map((l) => (
                        <Box
                            key={l.key}
                            component="li"
                            sx={{ display: "flex", alignItems: "center", gap: 0.75 }}
                        >
                            <Box
                                sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: g.radius.full,
                                    background: l.color,
                                }}
                                aria-hidden
                            />
                            <Typography sx={{ ...type("body-xs"), color: g.text.secondary }}>
                                {l.label}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            )}
            <Box
                aria-label={summary}
                role="img"
                sx={{
                    height: { xs: CHART_H.phone, sm: CHART_H.desktop },
                    minWidth: 0,
                    position: "relative",
                }}
                data-chart-plot
            >
                {empty ? <EmptyState size="xs" title={emptyText} /> : children}
            </Box>
        </DashboardCard>
    );
};

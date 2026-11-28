import { Box, Typography } from "@mui/joy";

import {
    ProportionBar,
    StatStrip,
    StatTile,
    useNumberFormat,
} from "../../components/ui/dashboard";
import { fmt, useTranslation } from "../../i18n";
import { g, type } from "../../theme/tokens";
import type { BriefingToday } from "./briefingToday";
import type { TodayCopy } from "./briefingWords";
import { SUMMARY_GRID_SX } from "./sectionStyles";
import { greetingKey, progressOf, summarySentence } from "./todaySummary";

type Props = {
    data: BriefingToday;
    copy: TodayCopy;
    /** Where a tile scrolls to: the id of the section it counts. */
    anchors: { overdue: string; dueToday: string; waiting: string; changed: string };
};

const jump = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ block: "start" });
};

/**
 * The top of the Today page (MIP-1992): a greeting with the date, the day in one sentence, four
 * numbers that each jump to their section, and how far through the day's work the viewer is. It
 * says things the lists below cannot: how big the day is and whether it is going well.
 */
export const TodaySummary = ({ data: d, copy: a, anchors }: Props) => {
    const { locale } = useTranslation();
    const nf = useNumberFormat();
    const now = new Date();
    const greeting = a.greeting[greetingKey(now.getHours())];
    const dateText = now.toLocaleDateString(locale, {
        weekday: "short",
        month: "short",
        day: "numeric",
    });
    const progress = progressOf(d);
    const waiting = d.requests.length + d.mentions.length;
    const allDone = progress != null && progress.left === 0;
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, minWidth: 0 }}>
            <Box sx={{ minWidth: 0 }}>
                <Typography level="body-sm" sx={{ color: g.text.secondary }}>
                    {greeting} · {dateText}
                </Typography>
                <Typography
                    aria-live="polite"
                    data-testid="today-summary"
                    sx={{ ...type("h4"), color: g.text.primary, mt: 0.25 }}
                >
                    {summarySentence(d, a)}
                </Typography>
            </Box>
            <Box sx={SUMMARY_GRID_SX}>
                <StatStrip ariaLabel={a.heading}>
                    <StatTile
                        edge="danger"
                        label={a.tiles.overdue}
                        raw={d.overdueCount}
                        tone="danger"
                        value={nf.number(d.overdueCount)}
                        onClick={() => jump(anchors.overdue)}
                    />
                    <StatTile
                        edge="warning"
                        label={a.dueToday}
                        raw={d.dueTodayCount}
                        tone="warning"
                        value={nf.number(d.dueTodayCount)}
                        onClick={() => jump(anchors.dueToday)}
                    />
                    <StatTile
                        edge="info"
                        label={a.sections.waiting}
                        raw={waiting}
                        tone="info"
                        value={nf.number(waiting)}
                        onClick={() => jump(anchors.waiting)}
                    />
                    <StatTile
                        edge="neutral"
                        label={a.tiles.changed}
                        raw={d.changed.total}
                        value={nf.number(d.changed.total)}
                        onClick={() => jump(anchors.changed)}
                    />
                </StatStrip>
                {progress ? (
                    <Box
                        data-testid="today-progress"
                        sx={{
                            border: `1px solid ${g.border.subtle}`,
                            borderRadius: g.radius.md,
                            bgcolor: g.surface.default,
                            p: 1.5,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            gap: 1,
                            minWidth: 0,
                        }}
                    >
                        <Typography level="title-sm" sx={{ color: g.text.primary }}>
                            {allDone ? a.progress.allDone : a.progress.label}
                        </Typography>
                        <ProportionBar
                            ariaLabel={fmt(a.progress.aria, {
                                done: progress.done,
                                total: progress.planned,
                            })}
                            segments={[
                                {
                                    key: "done",
                                    label: a.progress.done,
                                    value: progress.done,
                                    tone: "success",
                                },
                                {
                                    key: "left",
                                    label: a.progress.toGo,
                                    value: progress.left,
                                    tone: "warning",
                                },
                            ]}
                        />
                    </Box>
                ) : null}
            </Box>
        </Box>
    );
};

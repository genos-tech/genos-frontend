import { memo, useMemo } from "react";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import { Box, Button, Chip, Typography } from "@mui/joy";
import { useNavigate } from "react-router-dom";

import { GenosReportCard } from "../../../features/inbox/components/GenosReportCard";
import { parseGenosReportV2 } from "../../../features/inbox/utils/genosReportV2";
import { fmt, useTranslation } from "../../../i18n";
import { focusRing, g, type } from "../../../theme/tokens";

/** The two schedules a Core member starts with, as the server seeds them (MIP-1178). */
const EXAMPLES = [
    { key: "morning", emoji: "🌅", time: "09:00" },
    { key: "evening", emoji: "🌙", time: "17:00" },
] as const;

const pad = (n: number) => String(n).padStart(2, "0");
const isoDaysAgo = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

type Props = {
    /** The member has schedules that are kept (paused by the plan, or about to be). */
    hasKept: boolean;
    /** Close the host (the Settings dialog) before going to the plans page. */
    onNavigateAway?: () => void;
};

/**
 * What a Free member sees INSTEAD of the schedules form (MIP-1228): schedules are a Core-and-up
 * feature (genos-api MIP-1213), and this is the one place that says what they are. A short
 * pitch, the two schedules a Core member starts with, a sample of the report they file, and one
 * way forward: the plans page.
 *
 * The sample is a hard-coded typed report drawn by the real Inbox card, so it looks like what
 * arrives, and it is inert: no links, and out of the tab order and the accessibility tree (the
 * two example rows above it say the same in words). Its words are this page's own strings, in
 * the member's language; nothing here comes from the server (its `planMessage` is English-only).
 */
export const SchedulesUpgradePrompt = memo(({ hasKept, onNavigateAway }: Props) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const s = t.settings.schedules;

    const sample = useMemo(
        () =>
            parseGenosReportV2({
                version: 2,
                title: s.sampleTitle,
                text: s.sampleSummary,
                stats: [
                    { key: "overdue", count: 1, emoji: "🔥" },
                    { key: "due_today", count: 2, emoji: "📅" },
                ],
                sections: [
                    {
                        heading: s.sampleOverdue,
                        key: "overdue",
                        emoji: "🔥",
                        items: [
                            {
                                text: s.sampleTaskLate,
                                kind: "task",
                                project: { id: 1, name: s.sampleProject, code: "LNC" },
                                display_id: "LNC-4",
                                title: s.sampleTaskLate,
                                status: "WIP",
                                priority: "High",
                                due_date: isoDaysAgo(3),
                                overdue_days: 3,
                            },
                        ],
                    },
                    {
                        heading: s.sampleDueToday,
                        key: "due_today",
                        emoji: "📅",
                        items: [
                            {
                                text: s.sampleTaskToday1,
                                kind: "task",
                                project: { id: 1, name: s.sampleProject, code: "LNC" },
                                display_id: "LNC-7",
                                title: s.sampleTaskToday1,
                                status: "Open",
                                due_date: isoDaysAgo(0),
                            },
                            {
                                text: s.sampleTaskToday2,
                                kind: "task",
                                project: { id: 1, name: s.sampleProject, code: "LNC" },
                                display_id: "LNC-9",
                                title: s.sampleTaskToday2,
                                status: "Open",
                                due_date: isoDaysAgo(0),
                            },
                        ],
                    },
                ],
            }),
        [s]
    );

    return (
        <Box
            data-testid="schedules-upgrade"
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
                minWidth: 0,
                p: { xs: 1.5, sm: 2 },
                borderRadius: g.radius.lg,
                border: "1px solid",
                borderColor: g.accent.border,
                background: g.accent.subtle,
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                <Typography
                    component="h3"
                    sx={{ ...type("title-md"), color: g.text.primary, m: 0, minWidth: 0 }}
                >
                    {s.upgradeTitle}
                </Typography>
                <Chip color="primary" size="sm" variant="soft">
                    {s.upgradeChip}
                </Chip>
            </Box>
            <Typography sx={{ ...type("body-sm"), color: g.text.secondary }}>
                {s.upgradeBody}
            </Typography>

            <Box
                component="ul"
                sx={{ m: 0, p: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 1 }}
            >
                {EXAMPLES.map((example) => (
                    <Box
                        key={example.key}
                        component="li"
                        data-testid="schedules-upgrade-example"
                        sx={{
                            flex: "1 1 14rem",
                            minWidth: 0,
                            display: "flex",
                            alignItems: "center",
                            gap: 1.25,
                            px: 1.25,
                            py: 1,
                            borderRadius: g.radius.md,
                            background: g.surface.raised,
                            border: "1px solid",
                            borderColor: g.border.subtle,
                        }}
                    >
                        <Box aria-hidden sx={{ fontSize: 22, lineHeight: 1 }}>
                            {example.emoji}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography
                                sx={{
                                    ...type("title-sm"),
                                    color: g.text.primary,
                                    overflowWrap: "anywhere",
                                }}
                            >
                                {example.key === "morning"
                                    ? s.suggestMorningName
                                    : s.suggestEveningName}
                            </Typography>
                            <Typography sx={{ ...type("body-xs"), color: g.text.secondary }}>
                                {fmt(s.suggestDaily, { time: example.time })}
                                {" · "}
                                {example.key === "morning"
                                    ? s.suggestMorningBlurb
                                    : s.suggestEveningBlurb}
                            </Typography>
                        </Box>
                    </Box>
                ))}
            </Box>

            {sample && (
                <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ ...type("caption"), color: g.text.tertiary, mb: 0.5 }}>
                        {s.sampleLabel}
                    </Typography>
                    {/* Inert and hidden from assistive tech: a picture of a report, not one. */}
                    <Box
                        aria-hidden
                        // React 19 passes `inert` through as the boolean attribute.
                        inert
                        data-testid="schedules-upgrade-sample"
                        sx={{
                            p: { xs: 1.25, sm: 1.5 },
                            borderRadius: g.radius.md,
                            background: g.surface.raised,
                            border: "1px solid",
                            borderColor: g.border.subtle,
                            pointerEvents: "none",
                            userSelect: "none",
                            minWidth: 0,
                            overflow: "hidden",
                        }}
                    >
                        <GenosReportCard report={sample} />
                    </Box>
                </Box>
            )}

            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
                <Button
                    size="md"
                    startDecorator={<EventRepeatRoundedIcon />}
                    sx={{ "&:focus-visible": focusRing }}
                    onClick={() => {
                        // The dialog would otherwise stay open on top of the plans page.
                        onNavigateAway?.();
                        navigate("/workspace/plans");
                    }}
                >
                    {s.upgradeCta}
                </Button>
                <Typography
                    sx={{ ...type("body-xs"), color: g.text.secondary, flex: "1 1 12rem" }}
                >
                    {s.upgradeHint}
                </Typography>
            </Box>
            {hasKept && (
                <Typography
                    data-testid="schedules-upgrade-kept"
                    sx={{ ...type("body-xs"), color: g.text.secondary }}
                >
                    {s.upgradeKept}
                </Typography>
            )}
        </Box>
    );
});
SchedulesUpgradePrompt.displayName = "SchedulesUpgradePrompt";

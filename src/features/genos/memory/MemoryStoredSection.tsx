import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import { Box, Sheet, Stack, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import type { Overview } from "./memoryApi";
import { formatDay } from "./memoryWords";

interface Props {
    overview: Overview;
}

/**
 * "What Genos has stored": the plain-words inventory behind the delete buttons. Counts and
 * since-when for the three kinds of thing the secretary keeps (the activity record, the daily
 * summaries, the importance settings), account-wide, because that is exactly what a delete
 * removes. No ids, no text. The switch itself is the "Note my activity" section above: this
 * only says which state it is in.
 */
export const MemoryStoredSection = ({ overview }: Props) => {
    const { t, locale } = useTranslation();
    const m = t.settings.genosMemory.control.stored;
    const { ledger, summaries, importance } = overview.stored;
    const day = (value: string | null) => formatDay(value, locale);

    const rows: Array<{ key: string; label: string; value: string | null }> = [
        {
            key: "activity",
            label: m.activityLabel,
            value:
                ledger.entries > 0
                    ? fmt(m.activityValue, {
                          count: ledger.entries,
                          aiApp: ledger.aiApp,
                          own: ledger.ownChanges,
                          from: day(ledger.from),
                          days: ledger.keptDays,
                      })
                    : null,
        },
        {
            key: "summaries",
            label: m.summariesLabel,
            value:
                summaries.rows > 0
                    ? fmt(m.summariesValue, {
                          rows: summaries.rows,
                          items: summaries.items,
                          from: day(summaries.from),
                          days: summaries.keptDays,
                      })
                    : null,
        },
        {
            key: "importance",
            label: m.importanceLabel,
            value:
                importance.marks > 0 || importance.tunedSignals > 0
                    ? fmt(m.importanceValue, {
                          marks: importance.marks,
                          tuned: importance.tunedSignals,
                      })
                    : null,
        },
    ];

    return (
        <Sheet
            data-memory-stored=""
            sx={{ p: 2, borderRadius: "lg", minWidth: 0 }}
            variant="outlined"
        >
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <StorageRoundedIcon />
                <Typography level="title-md" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                    {m.heading}
                </Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {m.description}
            </Typography>
            <Typography
                data-memory-recording={overview.recording ? "on" : "off"}
                level="body-sm"
                role="status"
                sx={{ mb: 1.5, fontWeight: 500 }}
            >
                {overview.recording ? m.recordingOn : m.recordingOff}
            </Typography>
            <Box component="dl" sx={{ m: 0, minWidth: 0 }}>
                {rows.map((row) => (
                    <Box
                        key={row.key}
                        sx={{
                            py: 1,
                            minWidth: 0,
                            borderTop: "1px solid",
                            borderColor: g.border.subtle,
                        }}
                    >
                        <Typography component="dt" level="title-sm">
                            {row.label}
                        </Typography>
                        <Typography
                            component="dd"
                            data-memory-stored-row={row.key}
                            level="body-sm"
                            sx={{
                                m: 0,
                                overflowWrap: "anywhere",
                                color: row.value === null ? g.text.tertiary : g.text.secondary,
                            }}
                        >
                            {row.value ?? m.empty}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Sheet>
    );
};

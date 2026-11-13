import { useState } from "react";
import BalanceRoundedIcon from "@mui/icons-material/BalanceRounded";
import { Box, Button, Option, Select, Sheet, Stack, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { g, type } from "../../../theme/tokens";
import {
    LEVELS,
    SIGNALS,
    type Failure,
    type LevelKey,
    type Overview,
    type SignalKey,
} from "./memoryApi";

interface Props {
    overview: Overview;
    setLevel: (signal: SignalKey, level: LevelKey) => Promise<Failure | null>;
    resetTuning: () => Promise<Failure | null>;
}

const isSignal = (value: string): value is SignalKey =>
    (SIGNALS as readonly string[]).includes(value);
const isLevel = (value: string): value is LevelKey =>
    (LEVELS as readonly string[]).includes(value);

/**
 * "How Genos weighs things": the eight signals the ranking uses, each with a plain name and
 * meaning, and four levels (off / low / normal / high) as one compact select per signal, plus
 * "Reset to default". The levels are the member's, for this team; a change is one request that
 * answers with all eight rows, and applies from the next ranking.
 *
 * Names and meanings come from this app's own catalog (all seven languages); the server's
 * English only fills in a signal or level this app does not know yet. Writes are refused while
 * recording is off, so the controls are disabled then and the section says why.
 */
export const MemoryTuningSection = ({ overview, setLevel, resetTuning }: Props) => {
    const { t } = useTranslation();
    const m = t.settings.genosMemory.control.tuning;
    const words = t.settings.genosMemory.control;
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const off = !overview.recording;
    const changed = overview.tuning.some((row) => row.level !== "normal");

    const levelName = (key: string, fallback: string) =>
        isLevel(key) ? words.levels[key].name : fallback || key;
    const levelMeans = (key: string, fallback: string) =>
        isLevel(key) ? words.levels[key].means : fallback;

    const run = async (id: string, action: () => Promise<Failure | null>) => {
        setBusy(id);
        setError(null);
        const failure = await action();
        setBusy(null);
        if (failure) setError(failure.reason === "recording_off" ? m.recordingOff : m.failed);
    };

    return (
        <Sheet
            data-memory-tuning=""
            sx={{ p: 2, borderRadius: "lg", minWidth: 0 }}
            variant="outlined"
        >
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <BalanceRoundedIcon />
                <Typography level="title-md" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                    {m.heading}
                </Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1 }}>
                {m.description}
            </Typography>
            {off && (
                <Typography level="body-sm" role="status" sx={{ mb: 1, fontWeight: 500 }}>
                    {m.recordingOff}
                </Typography>
            )}
            <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, minWidth: 0 }}>
                {overview.tuning.map((row) => {
                    const own = isSignal(row.signal) ? words.signals[row.signal] : null;
                    const name = own ? own.name : row.name || row.signal;
                    const means = own ? own.means : row.means;
                    const options = [...LEVELS] as string[];
                    if (!options.includes(row.level)) options.push(row.level);
                    return (
                        <Box
                            key={row.signal}
                            component="li"
                            data-memory-signal={row.signal}
                            sx={{
                                py: 1,
                                minWidth: 0,
                                display: "flex",
                                flexWrap: "wrap",
                                alignItems: "center",
                                columnGap: 2,
                                rowGap: 0.75,
                                borderTop: "1px solid",
                                borderColor: g.border.subtle,
                            }}
                        >
                            <Box sx={{ flex: "1 1 14rem", minWidth: 0 }}>
                                <Typography level="title-sm" sx={{ overflowWrap: "anywhere" }}>
                                    {name}
                                </Typography>
                                <Typography
                                    level="body-xs"
                                    sx={{ color: g.text.secondary, overflowWrap: "anywhere" }}
                                >
                                    {means}
                                </Typography>
                            </Box>
                            <Select
                                disabled={off || busy !== null}
                                size="sm"
                                value={row.level}
                                renderValue={(option) =>
                                    option ? levelName(String(option.value), "") : null
                                }
                                slotProps={{
                                    button: {
                                        "aria-label": fmt(words.tuning.levelAria, {
                                            signal: name,
                                        }),
                                    },
                                }}
                                sx={{
                                    flex: "0 1 11rem",
                                    minWidth: 0,
                                    width: "11rem",
                                    maxWidth: "100%",
                                }}
                                onChange={(_, next) => {
                                    if (next && isLevel(next) && isSignal(row.signal)) {
                                        const signal = row.signal;
                                        void run(row.signal, () => setLevel(signal, next));
                                    }
                                }}
                            >
                                {options.map((level) => (
                                    <Option
                                        key={level}
                                        sx={{ alignItems: "flex-start" }}
                                        value={level}
                                    >
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography level="body-sm">
                                                {levelName(
                                                    level,
                                                    overview.catalog.levels.find(
                                                        (c) => c.key === level
                                                    )?.name ?? ""
                                                )}
                                            </Typography>
                                            <Typography
                                                level="body-xs"
                                                sx={{
                                                    ...type("body-xs"),
                                                    color: g.text.secondary,
                                                }}
                                            >
                                                {levelMeans(
                                                    level,
                                                    overview.catalog.levels.find(
                                                        (c) => c.key === level
                                                    )?.means ?? ""
                                                )}
                                            </Typography>
                                        </Box>
                                    </Option>
                                ))}
                            </Select>
                        </Box>
                    );
                })}
            </Box>
            {error && (
                <Typography level="body-xs" role="alert" sx={{ mt: 1, color: g.danger.text }}>
                    {error}
                </Typography>
            )}
            <Box sx={{ mt: 1.5 }}>
                <Button
                    color="neutral"
                    disabled={off || !changed || busy !== null}
                    loading={busy === "reset"}
                    size="sm"
                    variant="outlined"
                    onClick={() => void run("reset", resetTuning)}
                >
                    {m.reset}
                </Button>
            </Box>
        </Sheet>
    );
};

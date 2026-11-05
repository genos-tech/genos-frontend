// Agent activity strip — renders each tool the agent has fired so the
// user sees progress in real time. Used by every agent surface
// (Spotlight, per-thread Ask, future per-note Ask) so the surfaces
// report progress identically.
//
// Rules:
//   - Pending step → spinner + a friendly label for the tool
//   - Done step    → green ✓ + the backend-produced `summary`
//   - Errored step → red ✗ + the friendly label and the error text
//
// The pending / error label comes from `getToolLabel` (the localized
// tool_name → phrase map) so a non-technical user never sees a raw
// engineering identifier like `search_knowledge_base` or an arg dump
// like `create_task(title="…", project_id=3)`.

import { Box, Chip, CircularProgress, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../i18n";
import { clipText, parsePath, showValue, specFor } from "./approval/editableFields";
import { DARK_TEXT_STRONG } from "./markdownAnswerSx";
import { getToolLabel } from "./toolLabels";
import type { ToolEvent } from "./types";

// Mid-strength dark-mode body color used only here; kept local rather
// than threading through markdownAnswerSx since it's an intermediate
// state (pending-tool label) the typography block doesn't cover.
const DARK_TEXT_MEDIUM = "#cebfeb";

// "230ms" below a second, "1.8s" above — SI notation, deliberately not
// localized (matches how every locale reads durations in tech UIs, so
// the strip and the per-turn total can share it without label props).
export const formatDurationMs = (ms: number): string =>
    ms < 1000 ? `${Math.max(ms, 0)}ms` : `${(ms / 1000).toFixed(1)}s`;

interface ToolProgressListProps {
    events: ToolEvent[];
    isDark: boolean;
}

export const ToolProgressList = ({ events, isDark }: ToolProgressListProps) => {
    if (events.length === 0) return null;
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.25,
                mb: 0.75,
                pl: 0.25,
                borderLeft: "2px solid",
                borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
            }}
        >
            {events.map((e) => (
                <ToolProgressRow key={`${e.step}:${e.tool_name}`} event={e} isDark={isDark} />
            ))}
        </Box>
    );
};

// What the person changed before approving, as it ran: `Title: ...`, and for a
// bulk row `PRJ-12 · Priority: High`. A long body is clipped to a few words; the
// values are the ones typed, so no `current -> new` is shown (the snapshot a
// card carries describes the proposal, not the edit).
const EditedValues = ({ event, isDark }: { event: ToolEvent; isDark: boolean }) => {
    const { t } = useTranslation();
    const edited = event.edited_arguments;
    if (!event.edited || !edited) return null;
    const words = {
        cleared: t.agentApproval.cleared,
        noTags: t.agentApproval.edit.noTags,
        meta: t.tasks.filters,
    };
    const timeZone =
        typeof event.arguments?.time_zone === "string" ? event.arguments.time_zone : undefined;
    const rows = Array.isArray(event.arguments?.updates)
        ? (event.arguments.updates as Array<{ display_id?: string } | null>)
        : [];

    const lines = Object.entries(edited).map(([path, value]) => {
        const spec = specFor(event.tool_name, path);
        if (!spec) return { path, text: `${path}: ${clipText(JSON.stringify(value))}` };
        const label = t.agentApproval.edit.fields[spec.label];
        const row = parsePath(path)?.row;
        const where =
            row === undefined
                ? ""
                : `${rows[row]?.display_id || fmt(t.agentApproval.edit.row, { n: row + 1 })} · `;
        const shown = showValue(spec, value, words, timeZone);
        return {
            path,
            text: `${where}${label}: ${spec.kind === "body" ? clipText(shown) : shown}`,
        };
    });
    const muted = isDark ? DARK_TEXT_MEDIUM : "text.tertiary";

    return (
        <Box
            sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "baseline",
                columnGap: 0.75,
                rowGap: 0.1,
                pl: "34px",
                pb: 0.25,
            }}
        >
            <Chip
                color="warning"
                size="sm"
                sx={{ fontSize: "0.6875rem", "--Chip-minHeight": "16px" }}
                variant="soft"
            >
                {t.agentApproval.edit.edited}
            </Chip>
            {lines.map(({ path, text }) => (
                <Typography
                    key={path}
                    level="body-xs"
                    sx={{ color: muted, overflowWrap: "anywhere", minWidth: 0 }}
                >
                    {text}
                </Typography>
            ))}
        </Box>
    );
};

const ToolProgressRow = ({ event, isDark }: { event: ToolEvent; isDark: boolean }) => {
    const { t } = useTranslation();
    const isPending = event.status === "pending";
    const isError = event.status === "error";

    const label = event.summary || getToolLabel(event.tool_name, t);

    return (
        <>
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    pl: 1,
                    py: 0.25,
                    fontSize: "0.9375rem",
                }}
            >
                {isPending && (
                    <CircularProgress size="sm" sx={{ "--CircularProgress-size": "11px" }} />
                )}
                {!isPending && !isError && (
                    <Box
                        component="span"
                        sx={{
                            color: "success.500",
                            fontWeight: 700,
                            width: 14,
                            textAlign: "center",
                        }}
                    >
                        ✓
                    </Box>
                )}
                {isError && (
                    <Box
                        component="span"
                        sx={{
                            color: "danger.500",
                            fontWeight: 700,
                            width: 14,
                            textAlign: "center",
                        }}
                    >
                        ✗
                    </Box>
                )}
                <Typography
                    level="body-sm"
                    sx={{
                        opacity: isPending ? (isDark ? 1 : 0.8) : 1,
                        color: isError
                            ? "danger.500"
                            : isDark
                              ? isPending
                                  ? DARK_TEXT_MEDIUM
                                  : DARK_TEXT_STRONG
                              : undefined,
                    }}
                >
                    {isError ? `${getToolLabel(event.tool_name, t)}: ${event.error}` : label}
                </Typography>
                {/* Server-measured execution time (absent while pending, on
                cache hits, and against older backends). Dim + tabular so
                a column of steps reads like a profile. */}
                {typeof event.duration_ms === "number" && (
                    <Typography
                        level="body-xs"
                        sx={{
                            flexShrink: 0,
                            whiteSpace: "nowrap",
                            fontVariantNumeric: "tabular-nums",
                            color: isDark ? DARK_TEXT_MEDIUM : "text.tertiary",
                            opacity: isDark ? 0.8 : 1,
                        }}
                    >
                        {formatDurationMs(event.duration_ms)}
                    </Typography>
                )}
            </Box>
            {!isPending && !isError && <EditedValues event={event} isDark={isDark} />}
        </>
    );
};

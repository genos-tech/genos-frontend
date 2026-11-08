import { useEffect, useId, useRef, useState } from "react";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import LightbulbRoundedIcon from "@mui/icons-material/LightbulbRounded";
import { Box, Button, Sheet, Stack, Typography } from "@mui/joy";

import { EmptyState } from "../../../components/ui/feedback/EmptyState";
import { ErrorState } from "../../../components/ui/feedback/ErrorState";
import { SkeletonRows } from "../../../components/ui/feedback/Skeleton";
import { fmt, useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import {
    MARKS,
    type Failure,
    type MarkKey,
    type Overview,
    type Suggestion,
    type TopItem,
    type TopView,
} from "./memoryApi";
import { suggestionText, whyPhrases } from "./memoryWords";
import type { Markable, TopState } from "./useMemoryControl";

interface Props {
    overview: Overview;
    top: TopState;
    stale: boolean;
    loadTop: () => Promise<void>;
    mark: (item: Markable, next: MarkKey | null) => Promise<Failure | null>;
    clearMark: (item: Markable) => Promise<Failure | null>;
}

const TITLE_CLAMP = {
    overflowWrap: "anywhere",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
} as const;

/**
 * "What Genos noticed": the top tasks and why, in the member's language, each with a "Not
 * important" action that can be undone, plus up to two suggestions that are only ever shown.
 *
 * The ranking reads a few hundred tasks, so it is NOT part of the page's first request: it loads
 * when the member opens this section, once, and again only when they ask (a mark or a level change
 * says the list is out of date and offers a refresh, it never refetches by itself).
 *
 * A task the member just marked stays in the list with a one-line note and Undo, so the page does
 * not jump under their finger; the next refresh drops it for good. Titles are the server's
 * (access-checked) and are drawn as plain text, never as markup.
 */
export const MemoryNoticedSection = ({
    overview,
    top,
    stale,
    loadTop,
    mark,
    clearMark,
}: Props) => {
    const { t } = useTranslation();
    const m = t.settings.genosMemory.control.noticed;
    const [open, setOpen] = useState(false);
    // Tasks marked from this list in this view (Undo is offered), and per-task trouble.
    const [marked, setMarked] = useState<ReadonlySet<number>>(new Set());
    const [busy, setBusy] = useState<ReadonlySet<number>>(new Set());
    const [problems, setProblems] = useState<ReadonlyMap<number, string>>(new Map());
    // Trouble clearing a mark from the marked list.
    const [clearProblem, setClearProblem] = useState<string | null>(null);
    const bodyId = useId();
    // What a task was marked before this list changed it (a mark set over MCP, say), so Undo puts
    // that back instead of clearing it.
    const prior = useRef(new Map<number, MarkKey | null>());

    const off = !overview.recording;
    const view: TopView | null = top.status === "ready" ? top.view : null;

    // A newly loaded list starts clean: what was marked in the last one is in `overview.marks`.
    useEffect(() => {
        setMarked(new Set());
        setProblems(new Map());
        prior.current.clear();
    }, [view]);

    const toggle = () => {
        const next = !open;
        setOpen(next);
        if (next && top.status === "idle" && !off) void loadTop();
    };

    const refresh = () => void loadTop();

    const priorityName = (priority: string) => {
        const filters = t.tasks.filters as Record<string, string | undefined>;
        return filters[priority.toLowerCase()] ?? priority;
    };

    const act = async (item: TopItem, next: "not_important" | null) => {
        // Marking remembers what was there; Undo goes back to it (a clear when there was nothing).
        let target: MarkKey | null = next;
        if (next !== null) {
            const was = overview.marks.find((row) => row.taskId === item.taskId)?.mark;
            prior.current.set(
                item.taskId,
                (MARKS as readonly string[]).includes(was ?? "") ? (was as MarkKey) : null
            );
        } else target = prior.current.get(item.taskId) ?? null;
        setBusy((b) => new Set(b).add(item.taskId));
        setProblems((p) => {
            const copy = new Map(p);
            copy.delete(item.taskId);
            return copy;
        });
        const failure = await mark(item, target);
        setBusy((b) => {
            const copy = new Set(b);
            copy.delete(item.taskId);
            return copy;
        });
        if (failure) {
            setProblems((p) =>
                new Map(p).set(
                    item.taskId,
                    failure.reason === "recording_off"
                        ? m.markRecordingOff
                        : failure.reason === "not_found"
                          ? m.markGone
                          : m.markFailed
                )
            );
            return;
        }
        setMarked((s) => {
            const copy = new Set(s);
            if (next === null) copy.delete(item.taskId);
            else copy.add(item.taskId);
            return copy;
        });
    };

    return (
        <Sheet
            data-memory-noticed=""
            sx={{ p: 2, borderRadius: "lg", minWidth: 0 }}
            variant="outlined"
        >
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <LightbulbRoundedIcon />
                <Typography level="title-md" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                    {m.heading}
                </Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {m.description}
            </Typography>

            {off && !open ? (
                <Typography level="body-sm" role="status" sx={{ fontWeight: 500 }}>
                    {m.recordingOff}
                </Typography>
            ) : (
                <Button
                    aria-controls={bodyId}
                    aria-expanded={open}
                    color="neutral"
                    endDecorator={open ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                    size="sm"
                    variant="outlined"
                    onClick={toggle}
                >
                    {open ? m.hide : m.show}
                </Button>
            )}

            {/* A list that is already on screen stays when recording turns out to be off (the
                write that found out says so on its row); it is never pulled away under the
                member's finger. */}
            {open && (
                <Box id={bodyId} sx={{ mt: 1.5, minWidth: 0 }}>
                    {top.status === "loading" || top.status === "idle" ? (
                        <SkeletonRows count={3} label={m.loading} twoLines />
                    ) : top.status === "error" ? (
                        <ErrorState
                            data-error="genos-noticed"
                            size="xs"
                            title={m.loadFailed}
                            onRetry={refresh}
                        />
                    ) : view && !view.enabled ? (
                        <Typography level="body-sm" role="status" sx={{ fontWeight: 500 }}>
                            {m.recordingOff}
                        </Typography>
                    ) : view ? (
                        <>
                            {off && (
                                <Typography
                                    level="body-sm"
                                    role="status"
                                    sx={{ mb: 1, fontWeight: 500 }}
                                >
                                    {m.recordingOff}
                                </Typography>
                            )}
                            {stale && (
                                <Stack
                                    alignItems="center"
                                    direction="row"
                                    flexWrap="wrap"
                                    sx={{ mb: 1, columnGap: 1.5, rowGap: 0.5 }}
                                >
                                    <Typography level="body-xs" role="status">
                                        {m.stale}
                                    </Typography>
                                    <Button
                                        color="neutral"
                                        size="sm"
                                        variant="plain"
                                        onClick={refresh}
                                    >
                                        {m.refresh}
                                    </Button>
                                </Stack>
                            )}
                            {view.history !== "full" && (
                                <Typography
                                    level="body-xs"
                                    sx={{ mb: 1, color: g.text.secondary }}
                                >
                                    {m.thin}
                                </Typography>
                            )}
                            {view.top.length === 0 ? (
                                <EmptyState size="xs" title={m.empty} />
                            ) : (
                                <Box
                                    component="ul"
                                    data-memory-top=""
                                    sx={{ listStyle: "none", m: 0, p: 0, minWidth: 0 }}
                                >
                                    {view.top.map((item) => (
                                        <TopRow
                                            key={item.taskId}
                                            busy={busy.has(item.taskId)}
                                            disabled={off}
                                            item={item}
                                            marked={marked.has(item.taskId)}
                                            problem={problems.get(item.taskId) ?? null}
                                            onMark={(next) => void act(item, next)}
                                        />
                                    ))}
                                </Box>
                            )}
                            {view.suggestions.length > 0 && (
                                <Box sx={{ mt: 2, minWidth: 0 }}>
                                    <Typography level="title-sm">
                                        {m.suggestionsHeading}
                                    </Typography>
                                    <Typography level="body-xs" sx={{ mb: 0.5 }}>
                                        {m.suggestionsNote}
                                    </Typography>
                                    <Box
                                        component="ul"
                                        data-memory-suggestions=""
                                        sx={{ listStyle: "none", m: 0, p: 0, minWidth: 0 }}
                                    >
                                        {view.suggestions.slice(0, 2).map((s) => (
                                            <SuggestionRow
                                                key={`${s.kind}:${s.taskId}`}
                                                priority={priorityName(s.priority)}
                                                suggestion={s}
                                            />
                                        ))}
                                    </Box>
                                </Box>
                            )}
                            {overview.marks.length > 0 && (
                                <MarkedList
                                    disabled={off}
                                    marks={overview.marks}
                                    problem={clearProblem}
                                    onClear={async (item) => {
                                        setClearProblem(null);
                                        const failure = await clearMark(item);
                                        if (failure) {
                                            setClearProblem(
                                                failure.reason === "recording_off"
                                                    ? m.markRecordingOff
                                                    : m.markFailed
                                            );
                                        }
                                    }}
                                />
                            )}
                        </>
                    ) : null}
                </Box>
            )}
        </Sheet>
    );
};

const rowSx = {
    py: 1,
    minWidth: 0,
    borderTop: "1px solid",
    borderColor: g.border.subtle,
    "&:first-of-type": { borderTop: "none" },
} as const;

const TopRow = ({
    item,
    marked,
    busy,
    disabled,
    problem,
    onMark,
}: {
    item: TopItem;
    marked: boolean;
    busy: boolean;
    /** Recording is off: a write would be refused (409), so the buttons rest. */
    disabled: boolean;
    problem: string | null;
    onMark: (next: "not_important" | null) => void;
}) => {
    const { t } = useTranslation();
    const m = t.settings.genosMemory.control.noticed;
    const label = `${item.displayId} ${item.title}`.trim();
    const phrases = item.why ? whyPhrases(item.why, t.settings.genosMemory.control.why) : [];
    // The server's English sentences only when there is nothing to build a sentence from.
    const reasons = phrases.length > 0 ? phrases : item.why ? [] : item.reasons;

    return (
        <Box component="li" data-memory-item={item.taskId} sx={rowSx}>
            <Typography level="body-xs" sx={{ color: g.text.tertiary, overflowWrap: "anywhere" }}>
                {item.displayId}
                {item.project ? ` · ${item.project}` : ""}
            </Typography>
            <Typography level="body-sm" sx={{ fontWeight: 500, ...TITLE_CLAMP }}>
                {item.title}
            </Typography>
            {reasons.length > 0 && (
                <Typography
                    data-memory-why=""
                    level="body-xs"
                    sx={{ color: g.text.secondary, overflowWrap: "anywhere" }}
                >
                    {reasons.join(" · ")}
                </Typography>
            )}
            <Stack
                alignItems="center"
                direction="row"
                flexWrap="wrap"
                sx={{ mt: 0.5, columnGap: 1.5, rowGap: 0.5 }}
            >
                {marked ? (
                    <>
                        <Typography level="body-xs" role="status" sx={{ color: g.text.secondary }}>
                            {m.markedNote}
                        </Typography>
                        <Button
                            aria-label={fmt(m.undoAria, { task: label })}
                            color="neutral"
                            disabled={busy || disabled}
                            loading={busy}
                            size="sm"
                            variant="plain"
                            onClick={() => onMark(null)}
                        >
                            {m.undo}
                        </Button>
                    </>
                ) : (
                    <Button
                        aria-label={fmt(m.notImportantAria, { task: label })}
                        color="neutral"
                        disabled={busy || disabled}
                        loading={busy}
                        size="sm"
                        variant="outlined"
                        onClick={() => onMark("not_important")}
                    >
                        {m.notImportant}
                    </Button>
                )}
            </Stack>
            {problem && (
                <Typography level="body-xs" role="alert" sx={{ mt: 0.5, color: g.danger.text }}>
                    {problem}
                </Typography>
            )}
        </Box>
    );
};

const SuggestionRow = ({ suggestion, priority }: { suggestion: Suggestion; priority: string }) => {
    const { t } = useTranslation();
    return (
        <Box component="li" data-memory-suggestion={suggestion.kind} sx={rowSx}>
            <Typography level="body-xs" sx={{ color: g.text.tertiary, overflowWrap: "anywhere" }}>
                {suggestion.displayId}
            </Typography>
            <Typography level="body-sm" sx={{ fontWeight: 500, ...TITLE_CLAMP }}>
                {suggestion.title}
            </Typography>
            <Typography level="body-xs" sx={{ color: g.text.secondary, overflowWrap: "anywhere" }}>
                {suggestionText(suggestion, priority, t.settings.genosMemory.control.noticed)}
            </Typography>
        </Box>
    );
};

const MarkedList = ({
    marks,
    disabled,
    problem,
    onClear,
}: {
    marks: Overview["marks"];
    disabled: boolean;
    problem: string | null;
    onClear: (item: Markable) => void;
}) => {
    const { t } = useTranslation();
    const m = t.settings.genosMemory.control.noticed;
    const names = t.settings.genosMemory.control.markNames as Record<string, string | undefined>;
    return (
        <Box sx={{ mt: 2, minWidth: 0 }}>
            <Typography level="title-sm">{m.marksHeading}</Typography>
            <Box
                component="ul"
                data-memory-marks=""
                sx={{
                    listStyle: "none",
                    m: 0,
                    p: 0,
                    minWidth: 0,
                    maxHeight: 240,
                    overflowY: "auto",
                }}
            >
                {marks.map((row) => (
                    <Box
                        key={row.taskId}
                        component="li"
                        sx={{ ...rowSx, display: "flex", alignItems: "center", gap: 1 }}
                    >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                                level="body-sm"
                                sx={{ fontWeight: 500, ...TITLE_CLAMP, WebkitLineClamp: 1 }}
                            >
                                {row.displayId} {row.title}
                            </Typography>
                            <Typography level="body-xs" sx={{ color: g.text.tertiary }}>
                                {names[row.mark] ?? row.mark}
                            </Typography>
                        </Box>
                        <Button
                            aria-label={fmt(m.clearAria, {
                                task: `${row.displayId} ${row.title}`,
                            })}
                            color="neutral"
                            disabled={disabled}
                            size="sm"
                            sx={{ flexShrink: 0 }}
                            variant="plain"
                            onClick={() => onClear(row)}
                        >
                            {m.clear}
                        </Button>
                    </Box>
                ))}
            </Box>
            {problem && (
                <Typography level="body-xs" role="alert" sx={{ mt: 0.5, color: g.danger.text }}>
                    {problem}
                </Typography>
            )}
        </Box>
    );
};

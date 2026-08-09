// Single row in the Spotlight results list. Renders an entity icon,
// title, snippet, and a small chunk-type chip. The whole row is a
// button — clicking calls `onSelect(result, …)`, which the parent maps to
// a preview modal or to navigation depending on the held modifier.

import { memo } from "react";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import NoteAltRoundedIcon from "@mui/icons-material/NoteAltRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import { Box, Chip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { fmt, useTranslation, type Messages } from "../../i18n";
import { purplePalette } from "../../theme/purplePalette";
import type { ProjectProps } from "../../types/tasks";
import { ProjectLabelChips } from "../admin/components/projectLabels/ProjectLabelChips";
import { TaskStatusChip } from "../tasks/components/TaskStatusChip";
import type { SpotlightResult } from "./types";

type SpotlightMessages = Messages["spotlight"];

interface Props {
    result: SpotlightResult;
    query: string;
    isHighlighted?: boolean;
    /** The project this row belongs to, resolved by the parent from
     *  `result.project_id`. Carries `projectLabels`, which is the only
     *  source for the label chips — the search backend returns a bare
     *  `project_id`, never the labels. Undefined for rows with no
     *  project (DMs, personal notes, todos) and for a project the
     *  viewer's `teamProjects` hasn't loaded. */
    project?: ProjectProps;
    /** Note id → sidebar space, for the personal notes that aren't in My
     *  Notes. Absent ids are My Notes; an absent map degrades to the old
     *  behaviour of calling every personal note one. */
    noteScopes?: ReadonlyMap<number, "shared" | "team">;
    /** Row activation. `viaModifier` reports whether Cmd/Ctrl was held,
     *  which the parent reads as "navigate to the page instead of opening
     *  the preview modal" — the row itself stays unaware of that rule. */
    onSelect: (r: SpotlightResult, opts: { viaModifier: boolean }) => void;
}

// Which rows are "task-related" enough to carry the metadata chips.
//
// `task` and `milestone` are the task service itself. A note whose
// `note_type` is "task" is a note attached to a task, so it inherits the
// task's project — and therefore its labels — but has no status of its
// own. Everything else (chats incl. PM chats, personal/chat notes,
// todos, past answers) is left alone: the chips exist to make a task
// result scannable, not to decorate every row.
const isTaskRelated = (r: SpotlightResult): boolean =>
    r.entity_type === "task" ||
    r.entity_type === "milestone" ||
    (r.entity_type === "note" && r.note_type === "task");

// Status applies to the two entities that HAVE one. A task-note shows
// its project's labels but no status — the note isn't open or closed,
// the task it hangs off is.
const showsStatus = (r: SpotlightResult): boolean =>
    r.entity_type === "task" || r.entity_type === "milestone";

const ENTITY_ICON = {
    chat: QuestionAnswerRoundedIcon,
    task: AssignmentRoundedIcon,
    milestone: FlagRoundedIcon,
    note: NoteAltRoundedIcon,
    project: FolderRoundedIcon,
    todo: TaskAltRoundedIcon,
    // A collected past Spotlight answer — sparkle signals "AI answer".
    spotlight_answer: AutoAwesomeRoundedIcon,
};

const ENTITY_ICON_GRADIENT: Record<string, string> = {
    chat: "linear-gradient(135deg, #fb923c 0%, #f59e0b 100%)",
    task: "linear-gradient(135deg, #22c55e 0%, #10b981 100%)",
    // Orange — matches the milestone identity color used elsewhere (e.g.
    // the task diagram's milestone node border).
    milestone: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)",
    note: "linear-gradient(135deg, #818cf8 0%, #6366f1 100%)",
    project: "linear-gradient(135deg, var(--gp-brandalt-400) 0%, var(--gp-brand-700) 100%)",
    todo: "linear-gradient(135deg, var(--gp-brandalt-400) 0%, var(--gp-brand-700) 100%)",
    // Distinct violet→pink so a "Previous answer" row reads differently
    // from the live workspace entities above.
    spotlight_answer: "linear-gradient(135deg, var(--gp-brand-400) 0%, #db2777 100%)",
};

// Dark-mode text colors tuned for the translucent purple sheet behind
// the Spotlight overlay. Replaces opacity-based dimming, which muddies
// text against the translucent background.
const DARK_TEXT_STRONG = "#f1e8ff";
const DARK_TEXT_MEDIUM = "#cebfeb";
const DARK_TEXT_SOFT = "#a89bbf";

// Friendly label shown next to the icon for context (e.g. "DM",
// "Group chat", "Personal note"). Exported so the agent's source-chip
// renderer (`_chipLabel` in SpotlightOverlay) reuses the same wording
// — keeps the two surfaces from drifting. Accepts the translation
// dictionary so the labels stay locale-aware without turning this pure
// helper into a hook.
//
// `noteScopes` answers a question the search index cannot: My, Shared
// and Team notes are one backend type, indexed identically, so a hit on
// a team note arrives claiming `note_type: "personal"` and reads as "My
// note" without it. See `personalNoteScopes`.
export const entitySubtitle = (
    r: SpotlightResult,
    ts: SpotlightMessages,
    noteScopes?: ReadonlyMap<number, "shared" | "team">
): string => {
    if (r.entity_type === "chat") {
        switch (r.chat_type) {
            case "dm":
                return ts.entitySubtitle.dm;
            case "gm":
                return ts.entitySubtitle.gm;
            case "mdm":
                return ts.entitySubtitle.mdm;
            case "pm":
                return ts.entitySubtitle.pm;
            default:
                return ts.entitySubtitle.chatFallback;
        }
    }
    if (r.entity_type === "task") return ts.entitySubtitle.task;
    if (r.entity_type === "milestone") return ts.entitySubtitle.milestone;
    if (r.entity_type === "project") return ts.entitySubtitle.project;
    if (r.entity_type === "spotlight_answer") return ts.entitySubtitle.previousAnswer;
    if (r.entity_type === "todo") {
        // Pull the local_date out of `entity_id` for a date-flavored
        // subtitle ("Todo · 2026-05-28"). Falls back to plain "Todo".
        const m = r.entity_id.match(/^todo:(\d{4}-\d{2}-\d{2})/);
        return m ? fmt(ts.entitySubtitle.todoWithDate, { date: m[1] }) : ts.entitySubtitle.todo;
    }
    if (r.entity_type === "note") {
        switch (r.note_type) {
            case "personal": {
                const scope = r.note_id == null ? undefined : noteScopes?.get(Number(r.note_id));
                if (scope === "team") return ts.entitySubtitle.noteTeam;
                if (scope === "shared") return ts.entitySubtitle.noteShared;
                return ts.entitySubtitle.notePersonal;
            }
            case "task":
                return ts.entitySubtitle.noteTask;
            case "chat":
                return ts.entitySubtitle.noteChat;
            default:
                return ts.entitySubtitle.noteFallback;
        }
    }
    return "";
};

// Short uppercase tag rendered next to the subtitle when the matched
// chunk wasn't a top-level message/title. Returns null when the hit
// is "plain" (main-channel chat, task title/body, non-thread note).
//
// Returns a stable key ("thread" / "comment") rather than a display
// string so callers can branch on it and resolve the translation
// separately via `badgeLabel`.
//
// Signal sources:
//   - Chat thread reply: `entity_type=chat` AND `thread_id` set.
//     The chunker only writes thread_id on chunks INSIDE a thread; the
//     entity is also distinct from the main-channel entity, so this
//     check is robust.
//   - Task comment: `entity_type=task` AND the best-ranked chunk type
//     is "task_comment". `matched_chunk_types[0]` is the chunk_type
//     of the highest-scoring chunk for the entity (see
//     `_group_by_entity` in backend `search.py`).
//   - Chat note attached to a thread: `entity_type=note`,
//     `note_type=chat` AND `thread_id` set on the chunk.
export type BadgeKey = "thread" | "comment";

export const badgeFor = (r: SpotlightResult): BadgeKey | null => {
    if (r.entity_type === "chat" && r.thread_id) return "thread";
    if (r.entity_type === "task" && r.matched_chunk_types[0] === "task_comment") {
        return "comment";
    }
    if (r.entity_type === "note" && r.note_type === "chat" && r.thread_id) {
        return "thread";
    }
    return null;
};

// Resolves a badge key to its localized display label.
export const badgeLabel = (key: BadgeKey, ts: SpotlightMessages): string => {
    return key === "thread" ? ts.badges.thread : ts.badges.comment;
};

// Bolds substrings of `text` that match any token built from
// (a) whitespace-separated words of `query` and
// (b) optional `extraTerms` — analyzer-aware tokens supplied by the
//     backend (`SpotlightResult.matched_terms`) so stemming/synonym
//     hits like "running" for a "run" query are also highlighted.
// Case-insensitive substring match — same UX as macOS Spotlight
// ("doc" highlights inside "document").
function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildTokens(query: string, extraTerms?: string[]): string[] {
    const set = new Set<string>();
    for (const t of query.trim().toLowerCase().split(/\s+/)) {
        if (t.length > 0) set.add(t);
    }
    for (const t of extraTerms ?? []) {
        const norm = t.trim().toLowerCase();
        if (norm.length > 0) set.add(norm);
    }
    // Longer tokens win in regex alternation — prevents "run" from
    // matching before "running" when both are present.
    return Array.from(set).sort((a, b) => b.length - a.length);
}

export const HighlightedText = ({
    text,
    query,
    extraTerms,
    boldColor,
}: {
    text: string;
    query: string;
    extraTerms?: string[];
    boldColor?: string;
}) => {
    const tokens = buildTokens(query, extraTerms);
    if (tokens.length === 0) return <>{text}</>;
    const pattern = new RegExp(`(${tokens.map(escapeRegex).join("|")})`, "gi");
    const parts = text.split(pattern);
    return (
        <>
            {parts.map((part, i) =>
                i % 2 === 1 ? (
                    <Box key={i} component="span" sx={{ fontWeight: 700, color: boldColor }}>
                        {part}
                    </Box>
                ) : (
                    part
                )
            )}
        </>
    );
};

// Slice a window of `text` around the first occurrence of any query
// token, so a match buried past the 2-line clamp becomes visible. If
// no token matches (e.g. vector-only hit) or the match is already near
// the head of the snippet, return the text unchanged.
const SNIPPET_WINDOW_CHARS = 140;
const SNIPPET_PRE_MATCH_PAD = 30; // chars of context before the match
const SNIPPET_HEAD_THRESHOLD = 80; // if match is within this, no need to window
const WORD_BOUNDARY_DRIFT = 20; // max chars to drift when snapping to a space

function findFirstMatchPos(text: string, tokens: string[]): number {
    if (tokens.length === 0) return -1;
    const pattern = new RegExp(tokens.map(escapeRegex).join("|"), "i");
    const m = pattern.exec(text);
    return m ? m.index : -1;
}

function snapStartToWord(text: string, pos: number): number {
    if (pos <= 0) return 0;
    const min = Math.max(0, pos - WORD_BOUNDARY_DRIFT);
    for (let i = pos; i > min; i--) {
        if (/\s/.test(text[i - 1])) return i;
    }
    return min;
}

function snapEndToWord(text: string, pos: number): number {
    if (pos >= text.length) return text.length;
    const max = Math.min(text.length, pos + WORD_BOUNDARY_DRIFT);
    for (let i = pos; i < max; i++) {
        if (/\s/.test(text[i])) return i;
    }
    return max;
}

function windowAroundMatch(text: string, query: string, extraTerms?: string[]): string {
    if (text.length <= SNIPPET_WINDOW_CHARS) return text;
    const tokens = buildTokens(query, extraTerms);
    const matchPos = findFirstMatchPos(text, tokens);
    if (matchPos < 0 || matchPos <= SNIPPET_HEAD_THRESHOLD) return text;

    let start = Math.max(0, matchPos - SNIPPET_PRE_MATCH_PAD);
    let end = Math.min(text.length, start + SNIPPET_WINDOW_CHARS);
    // If we ran past the end, slide start back so the window stays
    // at ~SNIPPET_WINDOW_CHARS instead of trailing off short.
    if (end === text.length) start = Math.max(0, end - SNIPPET_WINDOW_CHARS);

    start = snapStartToWord(text, start);
    end = snapEndToWord(text, end);

    const prefix = start > 0 ? "… " : "";
    const suffix = end < text.length ? " …" : "";
    return prefix + text.slice(start, end).trim() + suffix;
}

const SpotlightResultItemInner = ({
    result,
    query,
    isHighlighted,
    project,
    noteScopes,
    onSelect,
}: Props) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const Icon = ENTITY_ICON[result.entity_type] ?? QuestionAnswerRoundedIcon;
    const iconGradient = ENTITY_ICON_GRADIENT[result.entity_type] ?? ENTITY_ICON_GRADIENT.chat;

    return (
        <Box
            component="button"
            type="button"
            sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 1.5,
                width: "100%",
                px: 1.5,
                py: 1.25,
                borderRadius: "10px",
                border: "1px solid transparent",
                background: isHighlighted
                    ? isDark
                        ? "rgba(var(--gp-brand-700-rgb), 0.12)"
                        : "rgba(var(--gp-brand-700-rgb), 0.06)"
                    : "transparent",
                cursor: "pointer",
                textAlign: "left",
                color: "inherit",
                font: "inherit",
                transition: "background 120ms ease",
                "&:hover": {
                    background: palette.hoverBg,
                },
            }}
            onClick={(e: React.MouseEvent) =>
                onSelect(result, { viaModifier: e.metaKey || e.ctrlKey })
            }
        >
            <Box
                sx={{
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: iconGradient,
                    opacity: 0.85,
                }}
            >
                <Icon sx={{ fontSize: 20, color: "#fff" }} />
            </Box>

            <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                    <Typography
                        level="body-md"
                        sx={{
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            color: isDark ? DARK_TEXT_STRONG : undefined,
                        }}
                    >
                        {result.title ? (
                            <HighlightedText
                                extraTerms={result.matched_terms}
                                query={query}
                                text={result.title}
                            />
                        ) : (
                            t.spotlight.states.untitled
                        )}
                    </Typography>
                    <Typography
                        level="body-sm"
                        sx={{
                            opacity: isDark ? 1 : 0.55,
                            color: isDark ? DARK_TEXT_SOFT : undefined,
                            flexShrink: 0,
                        }}
                    >
                        {entitySubtitle(result, t.spotlight, noteScopes)}
                    </Typography>
                    {(() => {
                        const badge = badgeFor(result);
                        if (!badge) return null;
                        // Small uppercase pill that turns the otherwise-
                        // ambiguous "Direct message" / "Task" subtitle into
                        // an obvious "this is a thread reply / task comment"
                        // signal. Colored from the purple palette to match
                        // the rest of the overlay's accent treatment.
                        return (
                            <Chip
                                color="primary"
                                size="sm"
                                variant="soft"
                                sx={{
                                    fontSize: "0.6rem",
                                    fontWeight: 700,
                                    letterSpacing: "0.06em",
                                    textTransform: "uppercase",
                                    flexShrink: 0,
                                    minHeight: 0,
                                    py: "1px",
                                    px: "6px",
                                    "--Chip-paddingInline": "6px",
                                }}
                            >
                                {badgeLabel(badge, t.spotlight)}
                            </Chip>
                        );
                    })()}
                    {/* Task metadata: status, then the project's labels.
                        Both live on the title row alongside the subtitle
                        and THREAD/COMMENT badge — that row is already the
                        "what kind of thing is this" line, and a separate
                        chip row would cost vertical density on every task
                        hit. `flexShrink: 0` keeps the chips intact and
                        lets the title ellipsize instead; the chips are
                        individually capped so they can't run away with
                        the row.

                        Each renders only when its data is there:
                        `task_status` is absent on older backends and on
                        not-yet-reingested milestones, and
                        `ProjectLabelChips` self-hides when the project
                        has no labels — so an unlabelled task in a
                        pre-reindex workspace looks exactly like it does
                        today. */}
                    {isTaskRelated(result) && (
                        <Box
                            sx={{
                                display: "flex",
                                // The row is baseline-aligned for its
                                // text; chips (one with a leading icon)
                                // need centring or they hang off the
                                // title's baseline.
                                alignItems: "center",
                                alignSelf: "center",
                                gap: 0.5,
                                flexShrink: 0,
                            }}
                        >
                            {showsStatus(result) && result.task_status && (
                                <TaskStatusChip status={result.task_status} />
                            )}
                            {project && (
                                <ProjectLabelChips labels={project.projectLabels ?? []} max={2} />
                            )}
                        </Box>
                    )}
                </Box>
                {result.snippet && (
                    <Typography
                        level="body-sm"
                        sx={{
                            mt: 0.25,
                            opacity: isDark ? 1 : 0.75,
                            color: isDark ? DARK_TEXT_MEDIUM : undefined,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                        }}
                    >
                        <HighlightedText
                            boldColor={isDark ? DARK_TEXT_STRONG : undefined}
                            extraTerms={result.matched_terms}
                            query={query}
                            text={windowAroundMatch(result.snippet, query, result.matched_terms)}
                        />
                    </Typography>
                )}
            </Box>
        </Box>
    );
};

SpotlightResultItemInner.displayName = "SpotlightResultItem";

// Memo: every keystroke updates the parent's `query` (post-debounce-removal),
// which means the parent re-renders. Without memo, all 20 rows would re-run
// the snippet-windowing regex and the highlight tokeniser on every keystroke.
// Combined with `useDeferredValue(query)` in the parent, this means the
// highlight work runs at low priority *and* only when its inputs actually
// change.
export const SpotlightResultItem = memo(SpotlightResultItemInner);

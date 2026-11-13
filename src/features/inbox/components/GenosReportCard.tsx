// The rich card of a typed Genos report (inbox item_type 10, body version 2, MIP-1208).
//
// Drawn only from the fields `parseGenosReportV2` kept: every string is plain text, there is
// no HTML anywhere, and a link is one `safeReportLink` accepted. Section and item order are the
// server's and are not changed. What it reuses: the task family's own `StatusLabel`,
// `PriorityIcon` and `DueText`, `BaseAvatar` for the project mark, and `taskTone` for color.
//
// Shape of the card, top to bottom: title and one-line summary, a strip of headline counts,
// the sections (the first two open, the rest folded; a long section shows its first lines and
// "Show N more"), and a footer slot that MIP-1209 fills with the AI-usage line and "Turn this off".
//
// Cost on a long Inbox: no request, no effect, no store read. The body is parsed once per item
// (`GenosReportBody`), the card is memoized on that parse, and a fold or "show more" is local state
// of one section, so it re-renders that section only.

import { memo, useId, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import AssignmentIcon from "@mui/icons-material/Assignment";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { Box, Typography } from "@mui/joy";
import { useNavigate } from "react-router-dom";

import { BaseAvatar } from "../../../components/ui/avatars/BaseAvatar";
import { useUrlLinkModal } from "../../../hooks/common/UrlLinkModalContext";
import { fmt, useTranslation } from "../../../i18n";
import { focusRing, g, type } from "../../../theme/tokens";
import { DueText, type DueTone } from "../../tasks/components/card";
import { PriorityIcon } from "../../tasks/components/meta/PriorityIcon";
import { StatusLabel } from "../../tasks/components/meta/StatusLabel";
import { toneCss, type Tone } from "../../tasks/meta/taskTone";
import { isInternalReportLink } from "../utils/genosReport";
import type {
    GenosReportV2,
    ReportItemV2,
    ReportKind,
    ReportProject,
    ReportSectionV2,
} from "../utils/genosReportV2";
import { chatMarkKey, parseReportChatLink, type ReportChatMark } from "../utils/reportChatMarks";
import { ReportChatIcon } from "./ReportChatIcon";
import { ANSWER_SLOT_WIDTH, ReportRowAnswers } from "./ReportRowAnswers";

/** Sections open on first draw; the rest are folded so the card stays short. */
export const OPEN_SECTIONS = 2;
/** Lines of a section shown before "Show N more". */
export const LINES_BEFORE_MORE = 6;
/** Only these priorities get a marker: a column of "Normal" bars is noise in a short report. */
const NOTABLE_PRIORITIES = new Set(["High", "Critical"]);
// Widths of the status, priority and due-date slots of a task row, from `sm` up.
const SLOT_STATUS = 84;
const SLOT_PRIORITY = 16;
const SLOT_DUE = 84;

const KIND_EMOJI: Record<Exclude<ReportKind, "more">, string> = {
    task: "🛠️",
    todo: "✅",
    event: "🗓️",
    note: "📝",
    chat: "💬",
    request: "🙋",
    mention: "📣",
    milestone: "🏁",
    project: "📁",
};

// What each section key means, as a tone: the hot ones carry the eye, the rest stay quiet.
const KEY_TONE: Record<string, Tone> = {
    overdue: "danger",
    blocked: "danger",
    due_today: "warning",
    waiting_on_you: "warning",
    start_with: "info",
    closed: "success",
    todos_done: "success",
    ready: "success",
    // Notes about the report, not things to act on: quiet (MIP-1211).
    still_same: "neutral",
    quieted: "neutral",
};
const toneOf = (key: string | null): Tone =>
    key !== null && Object.prototype.hasOwnProperty.call(KEY_TONE, key)
        ? KEY_TONE[key]
        : "neutral";

const clampSx = (lines: number) =>
    ({
        display: "-webkit-box",
        WebkitLineClamp: lines,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        overflowWrap: "anywhere",
    }) as const;

const rowLinkSx = {
    color: "inherit",
    textDecoration: "none",
    borderRadius: g.radius.sm,
    "&:hover": { background: g.hover },
    "&:focus-visible": focusRing,
} as const;

/** `YYYY-MM-DD` of a local date. */
const localIso = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Open = (link: string) => void;

/** The Inbox row around the card opens its own route on a click; a click on a link or a fold
 *  inside the card is not a click on the row. */
const stopRowOpen = (e: MouseEvent) => e.stopPropagation();

/** A row that is a link when the item has one. In-app links open through the URL-link modal
 *  (the Inbox stays where it is), falling back to navigation; https opens in a new tab. */
const RowShell = ({
    link,
    onOpen,
    sx,
    children,
}: {
    link: string | null;
    onOpen: Open;
    sx: object;
    children: ReactNode;
}) => {
    if (link === null) return <Box sx={sx}>{children}</Box>;
    if (!isInternalReportLink(link)) {
        return (
            <Box
                component="a"
                href={link}
                rel="noopener noreferrer nofollow"
                sx={{ ...rowLinkSx, ...sx }}
                target="_blank"
                onClick={stopRowOpen}
            >
                {children}
            </Box>
        );
    }
    return (
        <Box
            component="a"
            href={link}
            sx={{ ...rowLinkSx, ...sx }}
            onClick={(e: MouseEvent) => {
                stopRowOpen(e);
                // Let the browser keep its own "open in new tab" gestures.
                if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                e.preventDefault();
                onOpen(link);
            }}
        >
            {children}
        </Box>
    );
};

const Emoji = ({ value, size = 16 }: { value: string; size?: number }) => (
    <Box
        aria-hidden="true"
        component="span"
        sx={{ fontSize: size, lineHeight: 1, flexShrink: 0, fontFamily: "inherit" }}
    >
        {value}
    </Box>
);

const ProjectHeader = ({ project, avatar }: { project: ReportProject; avatar?: string }) => (
    <Box
        data-report-project={project.id}
        sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            minWidth: 0,
            px: 1,
            pt: 1,
            pb: 0.25,
        }}
    >
        <BaseAvatar size="xs" src={avatar} tone="neutral">
            <AssignmentIcon sx={{ fontSize: 12, color: g.text.tertiary }} />
        </BaseAvatar>
        <Typography
            dir="auto"
            sx={{
                ...type("title-sm"),
                color: g.text.secondary,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
            }}
            title={project.name}
        >
            {project.name}
        </Typography>
        {project.code !== "" && (
            <Typography
                sx={{
                    ...type("caption"),
                    color: g.text.tertiary,
                    flexShrink: 0,
                    letterSpacing: "0.04em",
                }}
            >
                {project.code}
            </Typography>
        )}
    </Box>
);

const dueFor = (
    item: ReportItemV2,
    todayIso: string,
    t: ReturnType<typeof useTranslation>["t"]
): { text: string; tone: DueTone } | null => {
    // A finished task has no due date worth showing.
    if (item.status === "Closed") return null;
    // The server counted the days late in the member's zone at the time of the report:
    // the card shows that count, not one recomputed in this browser's zone.
    if (item.overdueDays !== null) {
        return { text: fmt(t.inbox.report.daysLate, { days: item.overdueDays }), tone: "overdue" };
    }
    if (item.dueDate === null) return null;
    if (item.dueDate === todayIso) return { text: t.tasks.dueLabel.dueToday, tone: "today" };
    const [y, m, d] = item.dueDate.split("-").map(Number);
    const sameYear = y === Number(todayIso.slice(0, 4));
    const when = new Date(y, m - 1, d).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        ...(sameYear ? {} : { year: "numeric" }),
    });
    return { text: fmt(t.tasks.dueLabel.dueOn, { when }), tone: "later" };
};

/** Who the answers on this card are for: a mark belongs to a member in a team. Absent, the
 *  rows draw no buttons (a card shown where answering makes no sense, or an old caller). */
type Answerer = { userId: string; teamId: string };

const TaskRow = ({
    item,
    onOpen,
    todayIso,
    answerer,
    reserveAnswers,
}: {
    item: ReportItemV2;
    onOpen: Open;
    todayIso: string;
    answerer?: Answerer;
    /** A sibling row has the buttons: keep this row's marks in the same column. */
    reserveAnswers?: boolean;
}) => {
    const { t } = useTranslation();
    const due = dueFor(item, todayIso, t);
    const title = item.title !== "" ? item.title : item.text;
    const notable = item.priority !== null && NOTABLE_PRIORITIES.has(item.priority);
    const row = (
        <RowShell
            link={item.link}
            sx={{
                display: "grid",
                gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) auto" },
                columnGap: 1.5,
                rowGap: 0.25,
                alignItems: "center",
                px: 1,
                py: 0.75,
                minHeight: g.row.default,
            }}
            onOpen={onOpen}
        >
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, minWidth: 0 }}>
                {item.displayId !== "" && (
                    <Box
                        component="span"
                        sx={{
                            ...type("body-xs"),
                            color: g.text.tertiary,
                            fontVariantNumeric: "tabular-nums",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                        }}
                    >
                        {item.displayId}
                    </Box>
                )}
                <Box
                    component="span"
                    dir="auto"
                    sx={{
                        ...type("body-sm"),
                        fontWeight: 500,
                        color: g.text.primary,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                    title={title}
                >
                    {title}
                </Box>
            </Box>
            <Box
                sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    columnGap: 1.5,
                    rowGap: 0.25,
                    justifySelf: { sm: "end" },
                    // From `sm` the three marks sit in fixed slots, so a column of rows reads
                    // as a column: status under status, due date under due date.
                    "& > [data-slot]": { display: "flex", alignItems: "center" },
                    "& > [data-slot]:empty": { display: { xs: "none", sm: "flex" } },
                    "& > [data-slot='status']": { minWidth: { sm: SLOT_STATUS } },
                    "& > [data-slot='priority']": { width: { sm: SLOT_PRIORITY } },
                    "& > [data-slot='due']": {
                        minWidth: { sm: SLOT_DUE },
                        justifyContent: "flex-end",
                    },
                }}
            >
                <span data-slot="status">
                    {item.status !== null && <StatusLabel status={item.status} />}
                    {item.status === null && item.statusOther !== "" && (
                        <Box component="span" sx={{ ...type("body-sm"), color: g.text.secondary }}>
                            {item.statusOther}
                        </Box>
                    )}
                </span>
                <span aria-hidden={notable ? undefined : "true"} data-slot="priority">
                    {notable && <PriorityIcon priority={item.priority} />}
                </span>
                <span data-slot="due">{due && <DueText text={due.text} tone={due.tone} />}</span>
            </Box>
            {item.detail !== "" && (
                <Typography
                    dir="auto"
                    sx={{
                        ...type("body-xs"),
                        color: g.text.secondary,
                        gridColumn: "1 / -1",
                        ...clampSx(2),
                    }}
                    title={item.detail}
                >
                    {item.detail}
                </Typography>
            )}
        </RowShell>
    );
    // The buttons sit beside the link, not inside it. Only a line the server marked answerable.
    if (answerer && item.canAnswer && item.taskId !== null) {
        return (
            <ReportRowAnswers
                name={[item.displayId, title].filter(Boolean).join(" ")}
                taskId={item.taskId}
                teamId={answerer.teamId}
                userId={answerer.userId}
            >
                {row}
            </ReportRowAnswers>
        );
    }
    // From `sm` the buttons take a slot at the row's end; a row without them keeps the slot, so
    // the status and due-date columns stay in line down the section.
    if (reserveAnswers) {
        return <Box sx={{ paddingInlineEnd: { sm: `${ANSWER_SLOT_WIDTH}px` } }}>{row}</Box>;
    }
    return row;
};

/** The mark of a chat line's chat: only for a `chat` line whose link names a chat the member
 *  has. Anything else (no link, a link that is not a chat, a chat not in the list) has none. */
const chatMarkOf = (
    item: ReportItemV2,
    chatMarks: ReadonlyMap<string, ReportChatMark>
): ReportChatMark | undefined => {
    if (item.kind !== "chat" || chatMarks.size === 0) return undefined;
    const parsed = parseReportChatLink(item.link);
    return parsed ? chatMarks.get(chatMarkKey(parsed.kind, parsed.id)) : undefined;
};

const LineRow = ({
    item,
    onOpen,
    chatMarks,
}: {
    item: ReportItemV2;
    onOpen: Open;
    chatMarks: ReadonlyMap<string, ReportChatMark>;
}) => {
    // The closing "and N more ..." line is a quiet note, not an item.
    if (item.kind === "more") {
        return (
            <RowShell
                link={item.link}
                sx={{ px: 1, py: 0.5, ...type("body-xs"), color: g.text.tertiary }}
                onOpen={onOpen}
            >
                <Box component="span" dir="auto" sx={clampSx(2)}>
                    {item.text}
                </Box>
            </RowShell>
        );
    }
    // A kind the card does not know (or none): the text, behind a plain bullet.
    const emoji = item.kind !== null ? KIND_EMOJI[item.kind] : "•";
    // A chat line wears the chat's own avatar when the chat is in the member's list; otherwise
    // (and for every other kind) the emoji, as before.
    const mark = chatMarkOf(item, chatMarks);
    const icon = mark ? <ReportChatIcon fallback={emoji} mark={mark} /> : null;
    return (
        <RowShell
            link={item.link}
            sx={{
                display: "flex",
                // The avatar slot is one text line high, so it lines up with the first line from
                // the top; the emoji keeps its baseline alignment.
                alignItems: icon ? "flex-start" : "baseline",
                gap: 1,
                px: 1,
                py: 0.75,
                minHeight: g.row.default,
            }}
            onOpen={onOpen}
        >
            {icon ?? (
                <Box
                    aria-hidden="true"
                    component="span"
                    sx={{ width: 20, textAlign: "center", flexShrink: 0, fontSize: 14 }}
                >
                    {emoji}
                </Box>
            )}
            <Box
                component="span"
                dir="auto"
                sx={{ ...type("body-sm"), color: g.text.primary, minWidth: 0, ...clampSx(3) }}
                title={item.text}
            >
                {item.text}
            </Box>
        </RowShell>
    );
};

const isTaskLine = (item: ReportItemV2): boolean =>
    item.kind === "task" && (item.displayId !== "" || item.title !== "");

type Group = { project: ReportProject | null; items: ReportItemV2[] };

/** Runs of one project's task lines (the server keeps them contiguous); anything else, and a
 *  task with no project, falls into a header-less run. */
const groupByProject = (items: ReportItemV2[]): Group[] => {
    const groups: Group[] = [];
    for (const item of items) {
        const project = isTaskLine(item) ? item.project : null;
        const last = groups[groups.length - 1];
        if (last && (last.project?.id ?? null) === (project?.id ?? null)) last.items.push(item);
        else groups.push({ project, items: [item] });
    }
    return groups;
};

const Section = ({
    section,
    index,
    count,
    avatars,
    chatMarks,
    onOpen,
    todayIso,
    answerer,
}: {
    section: ReportSectionV2;
    index: number;
    /** The server's count for this section (a capped list shows fewer lines than it counts). */
    count: number;
    avatars: ReadonlyMap<number, string>;
    chatMarks: ReadonlyMap<string, ReportChatMark>;
    onOpen: Open;
    todayIso: string;
    answerer?: Answerer;
}) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(index < OPEN_SECTIONS);
    const [showAll, setShowAll] = useState(false);
    const uid = useId();
    const tone = toneOf(section.key);
    // A section always has a heading from the server; if one is ever missing, the key reads better than a bare count.
    const heading =
        section.heading !== "" ? section.heading : (section.key ?? "").replace(/_/g, " ");
    const css = toneCss(tone);

    const lines = section.items.filter((i) => i.kind !== "more");
    const hidden = showAll ? 0 : Math.max(0, lines.length - LINES_BEFORE_MORE);
    // The closing "and N more ..." line waits until every line above it is shown.
    const visible =
        hidden > 0
            ? lines.slice(0, LINES_BEFORE_MORE)
            : [...lines, ...section.items.filter((i) => i.kind === "more")];
    const groups = groupByProject(visible);
    // Only a section that has buttons somewhere keeps room for them on its other rows.
    const reserveAnswers = answerer !== undefined && lines.some((i) => i.canAnswer);
    const hot = tone === "danger" || tone === "warning";

    return (
        <Box
            aria-labelledby={`${uid}-h`}
            component="section"
            data-report-section={section.key ?? undefined}
            sx={{
                border: "1px solid",
                borderColor: g.border.subtle,
                borderInlineStart: "3px solid",
                borderInlineStartColor: hot || tone === "success" ? css.border : g.border.default,
                borderRadius: g.radius.md,
                background: g.surface.default,
                overflow: "hidden",
                minWidth: 0,
            }}
        >
            <Typography component="h4" id={`${uid}-h`} sx={{ m: 0 }}>
                <Box
                    aria-controls={`${uid}-body`}
                    aria-expanded={open}
                    component="button"
                    type="button"
                    sx={{
                        all: "unset",
                        boxSizing: "border-box",
                        width: "100%",
                        minHeight: { xs: 44, sm: 40 },
                        px: 1.5,
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        cursor: "pointer",
                        "&:hover": { background: g.hover },
                        "&:focus-visible": { ...focusRing, outlineOffset: "-2px" },
                    }}
                    onClick={(e: MouseEvent) => {
                        stopRowOpen(e);
                        setOpen((v) => !v);
                    }}
                >
                    {section.emoji !== "" && <Emoji size={18} value={section.emoji} />}
                    <Box
                        component="span"
                        dir="auto"
                        sx={{
                            ...type("title-sm"),
                            color: g.text.primary,
                            minWidth: 0,
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                        title={heading}
                    >
                        {heading}
                    </Box>
                    <Box
                        component="span"
                        sx={{
                            ...type("caption"),
                            fontVariantNumeric: "tabular-nums",
                            minWidth: 20,
                            textAlign: "center",
                            px: 0.75,
                            py: 0.125,
                            borderRadius: g.radius.full,
                            background: css.subtle,
                            color: css.text,
                            flexShrink: 0,
                        }}
                    >
                        {count}
                    </Box>
                    {open ? (
                        <ExpandLessRoundedIcon
                            aria-hidden="true"
                            sx={{ fontSize: 18, color: g.text.tertiary, flexShrink: 0 }}
                        />
                    ) : (
                        <ExpandMoreRoundedIcon
                            aria-hidden="true"
                            sx={{ fontSize: 18, color: g.text.tertiary, flexShrink: 0 }}
                        />
                    )}
                </Box>
            </Typography>
            {open && (
                <Box id={`${uid}-body`} sx={{ px: 0.5, pb: 0.75 }}>
                    {groups.map((group, gi) => (
                        <Box
                            key={`${gi}-${group.project?.id ?? "none"}`}
                            {...(group.project
                                ? { role: "group", "aria-label": group.project.name }
                                : {})}
                        >
                            {group.project && (
                                <ProjectHeader
                                    avatar={avatars.get(group.project.id)}
                                    project={group.project}
                                />
                            )}
                            <Box
                                component="ul"
                                sx={{
                                    m: 0,
                                    p: 0,
                                    listStyle: "none",
                                    display: "flex",
                                    flexDirection: "column",
                                }}
                            >
                                {group.items.map((item, ii) => (
                                    <li key={`${ii}-${item.text}`}>
                                        {isTaskLine(item) ? (
                                            <TaskRow
                                                answerer={answerer}
                                                item={item}
                                                reserveAnswers={reserveAnswers}
                                                todayIso={todayIso}
                                                onOpen={onOpen}
                                            />
                                        ) : (
                                            <LineRow
                                                chatMarks={chatMarks}
                                                item={item}
                                                onOpen={onOpen}
                                            />
                                        )}
                                    </li>
                                ))}
                            </Box>
                        </Box>
                    ))}
                    {(hidden > 0 || (showAll && lines.length > LINES_BEFORE_MORE)) && (
                        <Box
                            component="button"
                            type="button"
                            sx={{
                                all: "unset",
                                boxSizing: "border-box",
                                ...type("body-xs"),
                                fontWeight: 500,
                                color: g.accent.text,
                                cursor: "pointer",
                                px: 1,
                                py: 0.75,
                                minHeight: { xs: 40, sm: 32 },
                                display: "inline-flex",
                                alignItems: "center",
                                borderRadius: g.radius.sm,
                                "&:hover": { textDecoration: "underline" },
                                "&:focus-visible": focusRing,
                            }}
                            onClick={(e: MouseEvent) => {
                                stopRowOpen(e);
                                setShowAll((v) => !v);
                            }}
                        >
                            {hidden > 0
                                ? fmt(t.inbox.report.showMore, { count: hidden })
                                : t.inbox.report.showLess}
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    );
};

// Stats that are a note about the report rather than a section of it ("4 unchanged since your
// last report", MIP-1211): no section below says what they count, so their words stay visible
// on a phone, where the other chips are an emoji and a number.
const NOTE_STATS = new Set(["still_same", "quieted"]);

const StatStrip = ({ report }: { report: GenosReportV2 }) => {
    const { t } = useTranslation();
    if (report.stats.length === 0) return null;
    const labelOf = (key: string): string => {
        const heading = report.sections.find((s) => s.key === key)?.heading;
        if (heading) return heading;
        if (key === "still_same") return t.inbox.report.statUnchanged;
        if (key === "quieted") return t.inbox.report.statQuieted;
        if (key === "comments") return t.inbox.report.statComments;
        if (key === "items") return t.inbox.report.statItems;
        return "";
    };
    return (
        <Box
            component="ul"
            sx={{ m: 0, p: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 0.75 }}
        >
            {report.stats.map((stat) => {
                const css = toneCss(toneOf(stat.key));
                const label = labelOf(stat.key);
                const note = NOTE_STATS.has(stat.key);
                return (
                    <Box
                        key={stat.key}
                        component="li"
                        data-report-stat={stat.key}
                        sx={{
                            position: "relative",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.75,
                            px: 1.25,
                            py: 0.5,
                            borderRadius: g.radius.full,
                            background: css.subtle,
                            border: "1px solid",
                            borderColor: css.border,
                            color: css.text,
                            minWidth: 0,
                        }}
                    >
                        {stat.emoji !== "" && <Emoji size={16} value={stat.emoji} />}
                        <Box
                            component="span"
                            sx={{
                                ...type("title-md"),
                                color: "inherit",
                                fontVariantNumeric: "tabular-nums",
                            }}
                        >
                            {stat.count}
                        </Box>
                        {label !== "" && (
                            <Box
                                component="span"
                                sx={{
                                    ...type("body-xs"),
                                    color: g.text.secondary,
                                    // On a phone the strip is emoji and count; the name stays
                                    // for screen readers (and the section below says it).
                                    ...(note
                                        ? { overflowWrap: "anywhere" }
                                        : {
                                              position: { xs: "absolute", sm: "static" },
                                              width: { xs: "1px", sm: "auto" },
                                              height: { xs: "1px", sm: "auto" },
                                              overflow: { xs: "hidden", sm: "visible" },
                                              clipPath: { xs: "inset(50%)", sm: "none" },
                                              whiteSpace: "nowrap",
                                          }),
                                }}
                                title={label}
                            >
                                {label}
                            </Box>
                        )}
                    </Box>
                );
            })}
        </Box>
    );
};

const NO_AVATARS: ReadonlyMap<number, string> = new Map();
const NO_CHAT_MARKS: ReadonlyMap<string, ReportChatMark> = new Map();

type CardProps = {
    report: GenosReportV2;
    /** Project id to picture, from what is already in memory (no request is made). Hand the
     *  SAME map while its entries are the same, or the memoized card renders again. */
    avatars?: ReadonlyMap<number, string>;
    /** The avatar of each chat a "Messages sent" line names, by `chatMarkKey`, from the member's
     *  chat list (MIP-1333; no request). A chat not in it keeps the emoji. Same rule as
     *  `avatars`: hand the SAME map while its entries are the same. */
    chatMarks?: ReadonlyMap<string, ReportChatMark>;
    /** The footer slot: MIP-1209 puts "AI usage used" and "Turn this off" here. */
    footer?: ReactNode;
    /** The member and team the answers are for (MIP-1211). Both, or no buttons are drawn. They
     *  are strings, not an object, so a parent that re-renders does not redraw the card. */
    userId?: string;
    teamId?: string;
};

export const GenosReportCard = memo(
    ({
        report,
        avatars = NO_AVATARS,
        chatMarks = NO_CHAT_MARKS,
        footer,
        userId,
        teamId,
    }: CardProps) => {
        const { t } = useTranslation();
        const navigate = useNavigate();
        const urlLinkModal = useUrlLinkModal();
        // Per draw, not frozen at mount: a card drawn again after midnight names the right day.
        const todayIso = localIso(new Date());
        const onOpen = useMemo<Open>(
            () => (link) => {
                if (urlLinkModal) urlLinkModal.openModalByHref(link);
                else navigate(link);
            },
            [urlLinkModal, navigate]
        );
        const counts = useMemo(
            () => new Map(report.stats.map((s) => [s.key, s.count])),
            [report.stats]
        );
        const answerer = useMemo<Answerer | undefined>(
            () => (userId && teamId ? { userId, teamId } : undefined),
            [userId, teamId]
        );

        return (
            <Box
                data-genos-report="v2"
                sx={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 1.5 }}
            >
                <Box>
                    {report.title !== "" && (
                        <Typography
                            component="h3"
                            dir="auto"
                            sx={{
                                ...type("title-md"),
                                color: g.text.primary,
                                m: 0,
                                overflowWrap: "anywhere",
                            }}
                        >
                            {report.title}
                        </Typography>
                    )}
                    {report.summary !== "" && (
                        <Typography
                            dir="auto"
                            sx={{
                                ...type("body-sm"),
                                color: g.text.secondary,
                                mt: report.title !== "" ? 0.25 : 0,
                                overflowWrap: "anywhere",
                            }}
                        >
                            {report.summary}
                        </Typography>
                    )}
                </Box>
                <StatStrip report={report} />
                {report.sections.length === 0 && report.stats.length === 0 ? (
                    <Box
                        data-report-empty=""
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.5,
                            px: 1.5,
                            py: 1.5,
                            borderRadius: g.radius.md,
                            background: g.success.subtle,
                            border: "1px solid",
                            borderColor: g.success.border,
                        }}
                    >
                        <Emoji size={24} value="🎉" />
                        <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ ...type("title-sm"), color: g.text.primary }}>
                                {t.inbox.report.emptyTitle}
                            </Typography>
                            <Typography sx={{ ...type("body-sm"), color: g.text.secondary }}>
                                {t.inbox.report.emptyBody}
                            </Typography>
                        </Box>
                    </Box>
                ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        {report.sections.map((section, index) => (
                            <Section
                                key={`${index}-${section.key ?? section.heading}`}
                                avatars={avatars}
                                chatMarks={chatMarks}
                                count={Math.max(
                                    (section.key !== null ? counts.get(section.key) : undefined) ??
                                        0,
                                    section.items.filter((i) => i.kind !== "more").length
                                )}
                                index={index}
                                section={section}
                                answerer={answerer}
                                todayIso={todayIso}
                                onOpen={onOpen}
                            />
                        ))}
                    </Box>
                )}
                {footer != null && (
                    <Box
                        data-report-footer=""
                        sx={{ borderTop: "1px solid", borderColor: g.border.subtle, pt: 1 }}
                    >
                        {footer}
                    </Box>
                )}
            </Box>
        );
    }
);
GenosReportCard.displayName = "GenosReportCard";

export default GenosReportCard;

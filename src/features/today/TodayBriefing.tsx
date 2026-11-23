import { ReactNode, useMemo } from "react";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import WbSunnyOutlinedIcon from "@mui/icons-material/WbSunnyOutlined";
import { Box, IconButton, Typography } from "@mui/joy";

import { AppTooltip } from "../../components/ui/AppTooltip";
import { EmptyState } from "../../components/ui/feedback/EmptyState";
import { useHashMentionData } from "../../context/HashMentionDataContext";
import { fmt, useTranslation } from "../../i18n";
import { requestAppNavigate } from "../../services/appNavigate";
import { focusRing, g } from "../../theme/tokens";
import { formatAgentWhen } from "../tasks/components/dashboard/agentActivity/agentActivityLinks";
import { projectAvatarSrcMap } from "../tasks/utils/projectAvatar";
import {
    BriefingMention,
    BriefingTask,
    BriefingToday,
    changeHref,
    mentionHref,
    taskHref,
} from "./briefingToday";
import { changeLine, reasonLine } from "./briefingWords";
import { ROW_MIN_HEIGHT, rowDivider } from "./rowDivider";
import { TodayAction } from "./todayActions";
import { TodaySummary } from "./TodaySummary";
import { TodayTaskRow } from "./TodayTaskRow";
import { BriefingTodayView } from "./useBriefingToday";

type Props = {
    /** Page only: "Mark done" / "Move to tomorrow" on the member's own rows (MIP-1992). */
    onAction?: (task: BriefingTask, action: TodayAction) => void;
    view: BriefingTodayView;
    /** Page only: one more block under the day's summary (the "Your agents today" card, MIP-2004). */
    extra?: ReactNode;
};

type RowProps = {
    href: string | null;
    primary: ReactNode;
    secondary?: ReactNode;
    meta?: ReactNode;
    onOpen: (href: string) => void;
    noLink: string;
};

/** One row, one click. A row the answer could not name a path for is plain text, not a dead link. */
const Row = ({ href, primary, secondary, meta, onOpen, noLink }: RowProps) => {
    const body = (
        <>
            <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                    level="body-sm"
                    sx={{
                        color: g.text.primary,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {primary}
                </Typography>
                {secondary ? (
                    <Typography
                        level="body-xs"
                        sx={{
                            color: g.text.secondary,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {secondary}
                    </Typography>
                ) : null}
            </Box>
            {meta ? (
                <Typography level="body-xs" sx={{ color: g.text.secondary, flexShrink: 0 }}>
                    {meta}
                </Typography>
            ) : null}
        </>
    );
    const sx = {
        display: "flex",
        alignItems: "center",
        gap: 1,
        minWidth: 0,
        width: "100%",
        textAlign: "start",
        px: 1.25,
        py: 0.75,
        minHeight: ROW_MIN_HEIGHT,
        border: 0,
        background: "transparent",
        borderRadius: g.radius.sm,
        font: "inherit",
    } as const;
    if (!href) {
        return (
            <Box component="li" sx={{ listStyle: "none", ...rowDivider }}>
                <Box sx={sx} title={noLink}>
                    {body}
                </Box>
            </Box>
        );
    }
    return (
        <Box component="li" sx={{ listStyle: "none", ...rowDivider }}>
            <Box
                component="button"
                type="button"
                sx={{
                    ...sx,
                    cursor: "pointer",
                    "&:hover": { background: g.hover },
                    "&:focus-visible": focusRing,
                }}
                onClick={() => onOpen(href)}
            >
                {body}
            </Box>
        </Box>
    );
};

const Section = ({
    title,
    count,
    id,
    children,
}: {
    title: string;
    count: number;
    id?: string;
    children: ReactNode;
}) => (
    <Box
        aria-label={title}
        component="section"
        id={id}
        sx={{
            minWidth: 0,
            border: `1px solid ${g.border.subtle}`,
            borderRadius: g.radius.md,
            bgcolor: g.surface.default,
            py: 1,
        }}
    >
        <Typography
            component="h3"
            level="title-sm"
            sx={{ m: 0, px: 1.25, pb: 0.5, color: g.text.primary }}
        >
            {title}
            <Box component="span" sx={{ ml: 0.75, color: g.text.secondary, fontWeight: 400 }}>
                {count}
            </Box>
        </Typography>
        <Box component="ul" sx={{ m: 0, p: 0 }}>
            {children}
        </Box>
    </Box>
);

/** Delegated and suggested rows come without a project name: the loaded project list has it. */
const withProjectName = (
    task: BriefingTask,
    projects: { projectId: number; projectName: string }[]
) =>
    task.projectName || task.projectId == null
        ? task
        : {
              ...task,
              projectName:
                  projects.find((p) => p.projectId === task.projectId)?.projectName ?? null,
          };

type TodayCopy = ReturnType<typeof useTranslation>["t"]["tasks"]["dashboard"]["today"];

const mentionWhere = (m: BriefingMention, a: TodayCopy): string => {
    if (m.source === "chat") return m.chatTitle || a.mentionChat;
    if (m.source === "note") return m.title || a.mentionNote;
    return [m.displayId, m.title].filter(Boolean).join(" ");
};

const total = (d: BriefingToday): number =>
    d.overdueCount +
    d.dueTodayCount +
    d.requests.length +
    d.mentions.length +
    d.changed.total +
    d.blocked.length +
    d.delegatedTotal;

export const TodayBriefing = ({ view, onAction, extra }: Props) => {
    const { t, locale } = useTranslation();
    const a = t.tasks.dashboard.today;
    const open = (href: string) => requestAppNavigate(href);
    const { allChats, projects } = useHashMentionData();
    const avatars = useMemo(() => projectAvatarSrcMap(allChats), [allChats]);

    const header = (
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, minWidth: 0 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography component="h2" level="h4" sx={{ m: 0 }}>
                    {a.heading}
                </Typography>
                <Typography level="body-sm" sx={{ color: g.text.secondary }}>
                    {view.since
                        ? fmt(a.since, { time: formatAgentWhen(view.since, locale) })
                        : a.sinceFirst}
                </Typography>
            </Box>
            <AppTooltip title={a.refresh}>
                <IconButton
                    aria-label={a.refresh}
                    size="sm"
                    sx={{ minWidth: 44, minHeight: 44 }}
                    variant="plain"
                    onClick={view.refresh}
                >
                    <RefreshRoundedIcon />
                </IconButton>
            </AppTooltip>
        </Box>
    );

    let body: ReactNode;
    if (view.status === "loading" && !view.data) {
        body = (
            <Typography level="body-sm" role="status" sx={{ color: g.text.secondary, py: 2 }}>
                {a.states.loading}
            </Typography>
        );
    } else if (view.status === "unavailable") {
        body = <EmptyState size="sm" title={a.states.unavailable} />;
    } else if (view.status === "error" || !view.data) {
        body = (
            <EmptyState
                action={{ label: a.states.retry, onClick: view.refresh }}
                size="sm"
                title={a.states.error}
            />
        );
    } else {
        const d = view.data;
        const waitingCount = d.requests.length + d.mentions.length;
        const blockedBy = new Map(d.blocked.map((b) => [b.taskId, b.waitingFor]));
        // Actions only where the task is the member's own to finish: due and "look at these
        // first". Delegated rows belong to someone else.
        const taskRow = (
            task: BriefingTask,
            context?: ReactNode,
            actions: false | "leaves" | "stays" = false
        ) => (
            <TodayTaskRow
                key={task.taskId}
                blockedBy={blockedBy.get(task.taskId)}
                context={context}
                copy={a}
                href={taskHref(task)}
                keepsOnTomorrow={actions === "stays"}
                projectAvatarSrc={task.projectId != null ? avatars.get(task.projectId) : undefined}
                task={withProjectName(task, projects)}
                onAction={actions && onAction ? (act) => onAction(task, act) : undefined}
                onOpen={open}
            />
        );
        const groupLabel = (text: string, count: number) => (
            <Box component="li" sx={{ listStyle: "none", px: 1.25, pt: 0.75 }}>
                <Typography level="body-xs" sx={{ color: g.text.secondary, fontWeight: 600 }}>
                    {text} · {count}
                </Typography>
            </Box>
        );
        const anchors = {
            overdue: "today-due",
            dueToday: "today-due",
            waiting: "today-waiting",
            changed: "today-changed",
        };
        // One list, in the order the day is read: what is due, what to look at, what waits on the
        // member, what changed, what the member waits on, what was handed to others.
        const sections: ReactNode[] = [];
        if (d.overdueCount + d.dueTodayCount > 0) {
            sections.push(
                <Section
                    key="due"
                    count={d.overdueCount + d.dueTodayCount}
                    id="today-due"
                    title={a.sections.due}
                >
                    {d.overdue.length > 0 ? (
                        <>
                            {groupLabel(a.tiles.overdue, d.overdueCount)}
                            {d.overdue.map((task) => taskRow(task, undefined, "leaves"))}
                        </>
                    ) : null}
                    {d.dueToday.length > 0 ? (
                        <>
                            {groupLabel(a.dueToday, d.dueTodayCount)}
                            {d.dueToday.map((task) => taskRow(task, undefined, "leaves"))}
                        </>
                    ) : null}
                </Section>
            );
        }
        if (d.suggestedNext.length > 0) {
            sections.push(
                <Section key="next" count={d.suggestedNext.length} title={a.sections.next}>
                    {d.suggestedNext.map((task) =>
                        taskRow(task, reasonLine(task, a, locale), "stays")
                    )}
                </Section>
            );
        }
        if (waitingCount > 0) {
            sections.push(
                <Section
                    key="waiting"
                    count={waitingCount}
                    id="today-waiting"
                    title={a.sections.waiting}
                >
                    {d.requests.map((r) => (
                        <Row
                            key={`r${r.itemId}`}
                            href={null}
                            meta={r.at ? formatAgentWhen(r.at, locale) : ""}
                            noLink={a.noLink}
                            primary={`${a.request}: ${r.text ?? r.type ?? ""}`}
                            secondary={r.from}
                            onOpen={open}
                        />
                    ))}
                    {d.mentions.map((m, i) => (
                        <Row
                            key={`m${i}${m.at}`}
                            href={mentionHref(m)}
                            meta={formatAgentWhen(m.at, locale)}
                            noLink={a.noLink}
                            primary={fmt(a.mentionIn, { where: mentionWhere(m, a) })}
                            secondary={[m.from ?? m.by, m.text].filter(Boolean).join(": ")}
                            onOpen={open}
                        />
                    ))}
                </Section>
            );
        }
        if (d.changed.total > 0) {
            sections.push(
                <Section
                    key="changed"
                    count={d.changed.total}
                    id="today-changed"
                    title={a.sections.changed}
                >
                    {d.changed.items.map((c, i) => {
                        const line = `${changeLine(c, a)} · ${formatAgentWhen(c.latestAt, locale)}`;
                        // A changed task is a task: same row as every other section (MIP-2095).
                        // Notes and chat threads are not tasks and keep the plain row.
                        if (c.type === "task" && c.taskId != null) {
                            return taskRow(
                                {
                                    taskId: c.taskId,
                                    displayId: c.displayId ?? "",
                                    title: c.title ?? "",
                                    status: c.status,
                                    projectId: c.projectId,
                                    projectName: c.project,
                                },
                                line
                            );
                        }
                        return (
                            <Row
                                key={`c${i}${c.latestAt}`}
                                href={changeHref(c)}
                                meta={formatAgentWhen(c.latestAt, locale)}
                                noLink={a.noLink}
                                primary={[c.displayId, c.title].filter(Boolean).join(" ")}
                                secondary={changeLine(c, a)}
                                onOpen={open}
                            />
                        );
                    })}
                </Section>
            );
        }
        if (d.blocked.length > 0) {
            sections.push(
                <Section key="blocked" count={d.blocked.length} title={a.sections.blocked}>
                    {d.blocked.map((b) =>
                        taskRow(
                            { ...b, taskId: b.taskId, status: "Blocked" },
                            b.waitingFor.map((w) => w.title).join(" · ")
                        )
                    )}
                </Section>
            );
        }
        if (d.delegatedTotal > 0) {
            sections.push(
                <Section key="delegated" count={d.delegatedTotal} title={a.sections.delegated}>
                    {d.delegated.map((task) => taskRow(task))}
                </Section>
            );
        }
        const quiet = total(d) === 0;
        body = (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <TodaySummary anchors={anchors} copy={a} data={d} />
                {extra}
                {quiet ? (
                    <EmptyState
                        icon={<WbSunnyOutlinedIcon />}
                        size="sm"
                        title={a.empty.title}
                        body={[
                            a.empty.body,
                            d.doneToday && d.doneToday.count > 0
                                ? fmt(a.empty.doneToday, { n: d.doneToday.count })
                                : "",
                        ]
                            .filter(Boolean)
                            .join(" ")}
                    />
                ) : null}
                {sections.length > 0 ? (
                    // One column on a phone and a tablet. From a wide screen, two columns of
                    // equal-height cards in reading order, so each pair of lists sits side by side
                    // and no column ends ragged; a last card on its own spans both.
                    <Box
                        data-testid="today-sections"
                        sx={{
                            display: "grid",
                            gap: 1.5,
                            alignItems: "stretch",
                            gridTemplateColumns: {
                                xs: "minmax(0, 1fr)",
                                lg: "repeat(2, minmax(0, 1fr))",
                            },
                            "@media (min-width: 1200px)": {
                                "& > section:last-of-type:nth-of-type(odd)": {
                                    gridColumn: "1 / -1",
                                },
                            },
                        }}
                    >
                        {sections}
                    </Box>
                ) : null}
            </Box>
        );
    }

    return (
        <Box
            data-testid="today-page"
            sx={{ display: "flex", flexDirection: "column", gap: 1.5, minWidth: 0 }}
        >
            {header}
            {body}
        </Box>
    );
};

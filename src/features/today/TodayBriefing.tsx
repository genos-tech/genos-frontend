import { ReactNode } from "react";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { Box, Button, IconButton, Typography } from "@mui/joy";

import { AppTooltip } from "../../components/ui/AppTooltip";
import { EmptyState } from "../../components/ui/feedback/EmptyState";
import { fmt, useTranslation } from "../../i18n";
import { requestAppNavigate } from "../../services/appNavigate";
import { focusRing, g } from "../../theme/tokens";
import { formatAgentWhen } from "../tasks/components/dashboard/agentActivity/agentActivityLinks";
import {
    BriefingChange,
    BriefingMention,
    BriefingTask,
    BriefingToday,
    changeHref,
    mentionHref,
    taskHref,
} from "./briefingToday";
import { BriefingTodayView } from "./useBriefingToday";

/** `page` is the Tasks dashboard tab; `card` is the compact block on the Genos page. */
type Variant = "page" | "card";

type Props = {
    view: BriefingTodayView;
    variant?: Variant;
    /** Card only: where "Open Today" goes (the dashboard tab). */
    onOpenToday?: () => void;
};

const CARD_ROWS = 3;

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
        minHeight: 44,
        border: 0,
        background: "transparent",
        borderRadius: g.radius.sm,
        font: "inherit",
    } as const;
    if (!href) {
        return (
            <Box component="li" sx={{ listStyle: "none" }}>
                <Box sx={sx} title={noLink}>
                    {body}
                </Box>
            </Box>
        );
    }
    return (
        <Box component="li" sx={{ listStyle: "none" }}>
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
    children,
}: {
    title: string;
    count: number;
    children: ReactNode;
}) => (
    <Box
        aria-label={title}
        component="section"
        sx={{
            minWidth: 0,
            border: `1px solid ${g.border.subtle}`,
            borderRadius: g.radius.md,
            bgcolor: g.surface.default,
            py: 1,
        }}
    >
        <Typography level="title-sm" sx={{ px: 1.25, pb: 0.5, color: g.text.primary }}>
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

const taskMeta = (task: BriefingTask, a: TodayCopy): string => {
    const days = task.daysUntilDue;
    if (days == null) return "";
    if (days === 0) return a.dueToday;
    if (days < 0) return days === -1 ? a.overdueByOne : fmt(a.overdueBy, { n: -days });
    return "";
};

type TodayCopy = ReturnType<typeof useTranslation>["t"]["tasks"]["dashboard"]["today"];

const changeLine = (c: BriefingChange): string => {
    const { by, summary, text } = c.latest;
    const head = [by, summary].filter(Boolean).join(" ");
    return text ? `${head}: ${text}` : head;
};

const mentionWhere = (m: BriefingMention, a: TodayCopy): string => {
    if (m.source === "chat") return m.chatTitle || a.mentionChat;
    if (m.source === "note") return m.title || a.mentionNote;
    return [m.displayId, m.title].filter(Boolean).join(" ");
};

const clip = <T,>(rows: T[], limit: number | null): T[] =>
    limit == null ? rows : rows.slice(0, limit);

const total = (d: BriefingToday): number =>
    d.overdueCount +
    d.dueTodayCount +
    d.requests.length +
    d.mentions.length +
    d.changed.total +
    d.blocked.length +
    d.delegatedTotal;

export const TodayBriefing = ({ view, variant = "page", onOpenToday }: Props) => {
    const { t, locale } = useTranslation();
    const a = t.tasks.dashboard.today;
    const card = variant === "card";
    const limit = card ? CARD_ROWS : null;
    const open = (href: string) => requestAppNavigate(href);

    const header = (
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, minWidth: 0 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography component="h2" level={card ? "title-md" : "h4"} sx={{ m: 0 }}>
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
        const due = [...d.overdue, ...d.dueToday];
        const dueCount = d.overdueCount + d.dueTodayCount;
        const waitingCount = d.requests.length + d.mentions.length;
        const more = (shown: number, all: number) =>
            all > shown && card ? (
                <Typography level="body-xs" sx={{ px: 1.25, color: g.text.secondary }}>
                    {fmt(a.moreCount, { n: all - shown })}
                </Typography>
            ) : null;
        const shownDue = clip(due, limit);
        const shownWaiting = {
            requests: clip(d.requests, limit),
            mentions: clip(
                d.mentions,
                limit == null ? null : Math.max(limit - d.requests.length, 0)
            ),
        };
        const shownChanged = clip(d.changed.items, limit);
        const sections: ReactNode[] = [];
        if (dueCount > 0) {
            sections.push(
                <Section key="due" count={dueCount} title={a.sections.due}>
                    {shownDue.map((task) => (
                        <Row
                            key={task.taskId}
                            href={taskHref(task)}
                            meta={taskMeta(task, a)}
                            noLink={a.noLink}
                            primary={`${task.displayId} ${task.title}`}
                            secondary={task.projectName}
                            onOpen={open}
                        />
                    ))}
                    {more(shownDue.length, dueCount)}
                </Section>
            );
        }
        if (waitingCount > 0) {
            sections.push(
                <Section key="waiting" count={waitingCount} title={a.sections.waiting}>
                    {shownWaiting.requests.map((r) => (
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
                    {shownWaiting.mentions.map((m, i) => (
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
                    {more(
                        shownWaiting.requests.length + shownWaiting.mentions.length,
                        waitingCount
                    )}
                </Section>
            );
        }
        if (d.changed.total > 0) {
            sections.push(
                <Section key="changed" count={d.changed.total} title={a.sections.changed}>
                    {shownChanged.map((c, i) => (
                        <Row
                            key={`c${i}${c.latestAt}`}
                            href={changeHref(c)}
                            meta={formatAgentWhen(c.latestAt, locale)}
                            noLink={a.noLink}
                            primary={[c.displayId, c.title].filter(Boolean).join(" ")}
                            secondary={changeLine(c)}
                            onOpen={open}
                        />
                    ))}
                    {more(shownChanged.length, d.changed.total)}
                </Section>
            );
        }
        if (!card && d.suggestedNext.length > 0) {
            sections.push(
                <Section key="next" count={d.suggestedNext.length} title={a.sections.next}>
                    {d.suggestedNext.map((task) => (
                        <Row
                            key={task.taskId}
                            href={taskHref(task)}
                            noLink={a.noLink}
                            primary={`${task.displayId} ${task.title}`}
                            secondary={(task.reasons ?? []).join(" · ")}
                            onOpen={open}
                        />
                    ))}
                </Section>
            );
        }
        if (!card && d.blocked.length > 0) {
            sections.push(
                <Section key="blocked" count={d.blocked.length} title={a.sections.blocked}>
                    {d.blocked.map((b) => (
                        <Row
                            key={b.taskId}
                            href={taskHref(b)}
                            noLink={a.noLink}
                            primary={`${b.displayId} ${b.title}`}
                            secondary={b.waitingFor
                                .map((w) => `${w.displayId} ${w.title}`)
                                .join(" · ")}
                            onOpen={open}
                        />
                    ))}
                </Section>
            );
        }
        if (!card && d.delegatedTotal > 0) {
            sections.push(
                <Section key="delegated" count={d.delegatedTotal} title={a.sections.delegated}>
                    {d.delegated.map((task) => (
                        <Row
                            key={task.taskId}
                            href={taskHref(task)}
                            noLink={a.noLink}
                            primary={`${task.displayId} ${task.title}`}
                            secondary={task.projectName}
                            onOpen={open}
                        />
                    ))}
                </Section>
            );
        }
        body =
            total(d) === 0 && d.suggestedNext.length === 0 ? (
                <EmptyState body={a.empty.body} size="sm" title={a.empty.title} />
            ) : (
                <Box
                    sx={{
                        display: "grid",
                        gap: 1.5,
                        gridTemplateColumns: {
                            xs: "minmax(0, 1fr)",
                            md: card ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))",
                        },
                    }}
                >
                    {sections}
                </Box>
            );
    }

    return (
        <Box
            data-testid={card ? "today-card" : "today-page"}
            sx={{ display: "flex", flexDirection: "column", gap: 1.5, minWidth: 0 }}
        >
            {header}
            {body}
            {card && onOpenToday ? (
                <Box>
                    <Button size="sm" variant="plain" onClick={onOpenToday}>
                        {a.openToday}
                    </Button>
                </Box>
            ) : null}
        </Box>
    );
};

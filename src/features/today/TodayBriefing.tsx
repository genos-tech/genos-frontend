import { ReactNode, useMemo } from "react";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import WbSunnyOutlinedIcon from "@mui/icons-material/WbSunnyOutlined";
import { Box, Button, IconButton, Typography } from "@mui/joy";

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
import { TodaySummary } from "./TodaySummary";
import { TodayTaskRow } from "./TodayTaskRow";
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

const mentionWhere = (m: BriefingMention, a: TodayCopy): string => {
    if (m.source === "chat") return m.chatTitle || a.mentionChat;
    if (m.source === "note") return m.title || a.mentionNote;
    return [m.displayId, m.title].filter(Boolean).join(" ");
};

const dueCountOf = (d: BriefingToday): number => d.overdueCount + d.dueTodayCount;

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
    const open = (href: string) => requestAppNavigate(href);
    const { allChats } = useHashMentionData();
    const avatars = useMemo(() => projectAvatarSrcMap(allChats), [allChats]);

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
        if (card) {
            // One short list across the sections, most pressing first: it sits above the Genos
            // page's input, so it must stay small on a phone.
            const secs = a.sections;
            const rows: RowProps[] = [
                ...[...d.overdue, ...d.dueToday].map((task) => ({
                    href: taskHref(task),
                    primary: `${task.displayId} ${task.title}`,
                    secondary: `${secs.due} · ${taskMeta(task, a)}`,
                    onOpen: open,
                    noLink: a.noLink,
                })),
                ...d.mentions.map((m) => ({
                    href: mentionHref(m),
                    primary: fmt(a.mentionIn, { where: mentionWhere(m, a) }),
                    secondary: `${secs.waiting} · ${m.from ?? m.by ?? ""}`,
                    onOpen: open,
                    noLink: a.noLink,
                })),
                ...d.changed.items.map((c) => ({
                    href: changeHref(c),
                    primary: [c.displayId, c.title].filter(Boolean).join(" "),
                    secondary: `${secs.changed} · ${changeLine(c, a)}`,
                    onOpen: open,
                    noLink: a.noLink,
                })),
            ];
            const all = dueCountOf(d) + d.requests.length + d.mentions.length + d.changed.total;
            const shown = rows.slice(0, CARD_ROWS);
            return (
                <Box
                    data-testid="today-card"
                    sx={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}
                >
                    {header}
                    <Box component="ul" sx={{ m: 0, p: 0 }}>
                        {shown.map((r, i) => (
                            <Row key={i} {...r} />
                        ))}
                    </Box>
                    {all > shown.length ? (
                        <Typography level="body-xs" sx={{ px: 1.25, color: g.text.secondary }}>
                            {fmt(a.moreCount, { n: all - shown.length })}
                        </Typography>
                    ) : null}
                    {onOpenToday ? (
                        <Box>
                            <Button size="sm" variant="plain" onClick={onOpenToday}>
                                {a.openToday}
                            </Button>
                        </Box>
                    ) : null}
                </Box>
            );
        }
        const waitingCount = d.requests.length + d.mentions.length;
        const blockedBy = new Map(d.blocked.map((b) => [b.taskId, b.waitingFor]));
        const taskRow = (task: BriefingTask, context?: ReactNode) => (
            <TodayTaskRow
                key={task.taskId}
                blockedBy={blockedBy.get(task.taskId)}
                context={context}
                copy={a}
                href={taskHref(task)}
                projectAvatarSrc={task.projectId != null ? avatars.get(task.projectId) : undefined}
                task={task}
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
        const mainSections: ReactNode[] = [];
        const sideSections: ReactNode[] = [];
        const bandSections: ReactNode[] = [];
        if (d.overdueCount + d.dueTodayCount > 0) {
            mainSections.push(
                <Section
                    key="due"
                    count={d.overdueCount + d.dueTodayCount}
                    id="today-due"
                    title={a.sections.due}
                >
                    {d.overdue.length > 0 ? (
                        <>
                            {groupLabel(a.tiles.overdue, d.overdueCount)}
                            {d.overdue.map((task) => taskRow(task))}
                        </>
                    ) : null}
                    {d.dueToday.length > 0 ? (
                        <>
                            {groupLabel(a.dueToday, d.dueTodayCount)}
                            {d.dueToday.map((task) => taskRow(task))}
                        </>
                    ) : null}
                </Section>
            );
        }
        if (d.suggestedNext.length > 0) {
            mainSections.push(
                <Section key="next" count={d.suggestedNext.length} title={a.sections.next}>
                    {d.suggestedNext.map((task) => taskRow(task, reasonLine(task, a, locale)))}
                </Section>
            );
        }
        if (waitingCount > 0) {
            sideSections.push(
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
            sideSections.push(
                <Section
                    key="changed"
                    count={d.changed.total}
                    id="today-changed"
                    title={a.sections.changed}
                >
                    {d.changed.items.map((c, i) => (
                        <Row
                            key={`c${i}${c.latestAt}`}
                            href={changeHref(c)}
                            meta={formatAgentWhen(c.latestAt, locale)}
                            noLink={a.noLink}
                            primary={[c.displayId, c.title].filter(Boolean).join(" ")}
                            secondary={changeLine(c, a)}
                            onOpen={open}
                        />
                    ))}
                </Section>
            );
        }
        if (d.blocked.length > 0) {
            bandSections.push(
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
        if (d.delegatedTotal > 0) {
            bandSections.push(
                <Section key="delegated" count={d.delegatedTotal} title={a.sections.delegated}>
                    {d.delegated.map((task) => taskRow(task))}
                </Section>
            );
        }
        const quiet = total(d) === 0;
        const column = (items: ReactNode[]) =>
            items.length > 0 ? (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, minWidth: 0 }}>
                    {items}
                </Box>
            ) : null;
        body = (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <TodaySummary anchors={anchors} copy={a} data={d} />
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
                {mainSections.length + sideSections.length > 0 ? (
                    <Box
                        sx={{
                            display: "grid",
                            gap: 1.5,
                            alignItems: "start",
                            gridTemplateColumns: {
                                xs: "minmax(0, 1fr)",
                                lg:
                                    mainSections.length > 0 && sideSections.length > 0
                                        ? "minmax(0, 2fr) minmax(0, 1fr)"
                                        : "minmax(0, 1fr)",
                            },
                        }}
                    >
                        {column(mainSections)}
                        {column(sideSections)}
                    </Box>
                ) : null}
                {bandSections.length > 0 ? (
                    <Box
                        sx={{
                            display: "grid",
                            gap: 1.5,
                            alignItems: "start",
                            gridTemplateColumns: {
                                xs: "minmax(0, 1fr)",
                                md: "repeat(2, minmax(0, 1fr))",
                            },
                        }}
                    >
                        {bandSections}
                    </Box>
                ) : null}
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

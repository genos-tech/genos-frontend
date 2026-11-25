import { useEffect, useMemo, useRef, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DashboardCustomizeRoundedIcon from "@mui/icons-material/DashboardCustomizeRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import { Box, Button, Typography } from "@mui/joy";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { SectionHeading } from "../../../../../components/ui/dashboard";
import { EmptyState } from "../../../../../components/ui/feedback/EmptyState";
import { SkeletonLines } from "../../../../../components/ui/feedback/Skeleton";
import { toast } from "../../../../../components/ui/feedback/toastStore";
import { useAuth } from "../../../../../context/authState";
import { fmt, useTranslation } from "../../../../../i18n";
import { runScheduleNow } from "../../../../../services/schedules";
import { focusRing, g } from "../../../../../theme/tokens";
import { HtmlNoteView } from "../../../../notes/common/components/HtmlNoteView";
import { useCustomDashboards } from "../../../hooks/useCustomDashboards";
import type { OwnDashboard, SharedDashboard } from "../../../services/loadCustomDashboards";
import { formatAgentWhen } from "../agentActivity/agentActivityLinks";
import { CUSTOM_DASHBOARD_PARAM } from "../dashboardTab";
import { NewDashboardDialog } from "./NewDashboardDialog";

const TASKS_PATH = "/workspace/tasks";
/** The HTML note viewer's `noteType` for a My Note (the API's `personal`). */
const MY_NOTE_TYPE = 1;

type Entry = {
    /** `s<schedule id>` for an own dashboard, `n<note id>` for a shared one. */
    key: string;
    title: string;
    meta: string;
    noteId: number | null;
    scheduleId: string | null;
    paused: boolean;
    shared: boolean;
};

const ownEntry = (
    row: OwnDashboard,
    locale: string,
    c: { notRun: string; updated: string; paused: string }
): Entry => {
    const when = formatAgentWhen(row.lastRun, locale);
    return {
        // Stable across the first run: the key never changes when the page appears.
        key: `s${row.scheduleId}`,
        title: row.note?.title || row.name,
        meta: !row.enabled ? c.paused : row.note && when ? fmt(c.updated, { when }) : c.notRun,
        noteId: row.note?.noteId ?? null,
        scheduleId: row.scheduleId,
        paused: !row.enabled,
        shared: false,
    };
};

const sharedEntry = (row: SharedDashboard, by: string): Entry => ({
    key: `n${row.noteId}`,
    title: row.title,
    meta: fmt(by, { name: row.ownerName || "?" }),
    noteId: row.noteId,
    scheduleId: null,
    paused: false,
    shared: true,
});

const DashboardRow = ({
    entry,
    selected,
    onSelect,
}: {
    entry: Entry;
    selected: boolean;
    onSelect: () => void;
}) => (
    <Box
        aria-current={selected ? "true" : undefined}
        component="button"
        data-testid="custom-dashboard-row"
        type="button"
        sx={{
            appearance: "none",
            background: selected ? g.accent.subtle : "transparent",
            border: 0,
            borderRadius: "8px",
            color: "inherit",
            cursor: "pointer",
            display: "block",
            font: "inherit",
            // One geometry for every row, own or shared: two lines, the same height.
            maxWidth: "100%",
            minHeight: 52,
            minWidth: 0,
            px: 1.25,
            py: 0.75,
            textAlign: "start",
            width: "100%",
            "&:hover": { background: selected ? g.accent.subtle : g.hover },
            "&:focus-visible": focusRing,
        }}
        onClick={onSelect}
    >
        <Typography
            level="title-sm"
            sx={{
                color: g.text.primary,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
            }}
        >
            {entry.title}
        </Typography>
        <Typography
            level="body-xs"
            sx={{
                color: g.text.secondary,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
            }}
        >
            {entry.meta}
        </Typography>
    </Box>
);

const Group = ({
    label,
    entries,
    selectedKey,
    onSelect,
}: {
    label: string;
    entries: Entry[];
    selectedKey: string | null;
    onSelect: (entry: Entry) => void;
}) => (
    <Box aria-label={label} component="section" sx={{ minWidth: 0 }}>
        <Typography
            component="h3"
            level="body-xs"
            sx={{ color: g.text.secondary, fontWeight: 600, px: 1.25, pb: 0.5 }}
        >
            {label}
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
            {entries.map((entry) => (
                <DashboardRow
                    key={entry.key}
                    entry={entry}
                    selected={entry.key === selectedKey}
                    onSelect={() => onSelect(entry)}
                />
            ))}
        </Box>
    </Box>
);

type Props = {
    /** The team the tab shows. The API needs it on every request; a change refetches. */
    teamId: string;
};

/**
 * "Custom dashboards by AI" tab of Task Stats (MIP-2356, asked for by Ken on 2026-11-24).
 *
 * Two lists, the member's own dashboards and the ones teammates share, and the open one in the
 * existing HTML note viewer (`HtmlNoteView`: a sandboxed frame, the note's own ACL decides). Nothing
 * here reads a dashboard's content: the page is shown by the note viewer and only that. "Open note"
 * goes to the note; "Run now" (own dashboards) runs the schedule through the same endpoint as
 * Settings > Schedules. The open dashboard lives in the address (`?view=custom&dashboard=<note>`)
 * so a link lands on it.
 */
export const CustomDashboardsTab = ({ teamId }: Props) => {
    const { t, locale } = useTranslation();
    const c = t.tasks.dashboard.customDashboards;
    const { accessToken } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [search, setSearch] = useSearchParams();
    // The Tasks home is kept mounted while another service is on screen: only the tasks route
    // may fetch, and only it may write the address.
    const onTasks = location.pathname.startsWith(TASKS_PATH);
    const view = useCustomDashboards(teamId, onTasks);

    const own = useMemo(
        () => (view.data?.own ?? []).map((row) => ownEntry(row, locale, c)),
        [view.data, locale, c]
    );
    const shared = useMemo(
        () => (view.data?.shared ?? []).map((row) => sharedEntry(row, c.sharedBy)),
        [view.data, c.sharedBy]
    );
    const all = useMemo(() => [...own, ...shared], [own, shared]);

    // The address names a dashboard by its note id. A pick made here is remembered together with
    // the address it wrote: a link that later changes the address wins over an older pick (the
    // Tasks home stays mounted while another service shows).
    const wanted = search.get(CUSTOM_DASHBOARD_PARAM);
    const [picked, setPicked] = useState<{ key: string; at: string | null } | null>(null);
    const fromAddress =
        wanted && /^\d+$/.test(wanted) ? all.find((e) => e.noteId === Number(wanted)) : undefined;
    const fromPick =
        picked && picked.at === wanted ? all.find((e) => e.key === picked.key) : undefined;
    const selected =
        fromPick ??
        fromAddress ??
        own.find((e) => e.noteId != null) ??
        shared[0] ??
        own[0] ??
        null;
    const selectedKey = selected?.key ?? null;

    const pathRef = useRef(location.pathname);
    pathRef.current = location.pathname;
    const select = (entry: Entry) => {
        const at = entry.noteId != null ? String(entry.noteId) : null;
        if (!pathRef.current.startsWith(TASKS_PATH)) return;
        setPicked({ key: entry.key, at });
        setSearch(
            (prev) => {
                const next = new URLSearchParams(prev);
                if (at) next.set(CUSTOM_DASHBOARD_PARAM, at);
                else next.delete(CUSTOM_DASHBOARD_PARAM);
                return next;
            },
            { replace: true }
        );
    };

    // "Run now" re-reads the page afterwards: a bump remounts the frame (a fresh single-use URL).
    const [frameKey, setFrameKey] = useState(0);
    const [running, setRunning] = useState(false);
    // The tab can close while a run is in flight; its answer then touches nothing.
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    const runNow = async () => {
        if (!selected?.scheduleId || running) return;
        setRunning(true);
        const res = await runScheduleNow(accessToken, teamId, selected.scheduleId);
        if (!alive.current) return;
        setRunning(false);
        if (res.ok && res.outcome.status === "ok") {
            toast.success(c.runDone, { id: "custom-dashboard-run" });
            setFrameKey((n) => n + 1);
            view.refresh();
        } else {
            const reason = res.ok ? res.outcome.error : res.error;
            toast.error(reason || c.runFailed, { id: "custom-dashboard-run" });
        }
    };

    const [creating, setCreating] = useState(false);
    const heading = <SectionHeading description={c.subtitle} title={c.heading} />;
    // The same heading with "New dashboard" beside it, once the lists are known.
    const headingWithNew = (
        <Box
            sx={{
                alignItems: "start",
                display: "flex",
                flexWrap: "wrap",
                gap: 1.5,
                justifyContent: "space-between",
            }}
        >
            <Box sx={{ flex: "1 1 260px", minWidth: 0 }}>{heading}</Box>
            <Button
                data-testid="new-dashboard"
                size="sm"
                startDecorator={<AddRoundedIcon />}
                onClick={() => setCreating(true)}
            >
                {c.newDashboard}
            </Button>
            <NewDashboardDialog
                open={creating}
                teamId={teamId}
                onClose={() => setCreating(false)}
                onCreated={view.refresh}
            />
        </Box>
    );

    if (view.status === "loading") {
        return (
            <Box data-testid="custom-dashboards-loading" sx={{ display: "grid", gap: 2 }}>
                {heading}
                <SkeletonLines lines={4} />
            </Box>
        );
    }
    if (view.status === "error" || view.status === "unavailable") {
        return (
            <Box sx={{ display: "grid", gap: 2 }}>
                {heading}
                <EmptyState
                    body={view.status === "error" ? c.errorBody : c.unavailableBody}
                    data-empty="custom-dashboards-unavailable"
                    icon={<DashboardCustomizeRoundedIcon />}
                    title={view.status === "error" ? c.errorTitle : c.unavailableTitle}
                    action={
                        view.status === "error"
                            ? { label: c.retry, onClick: view.retry }
                            : undefined
                    }
                />
            </Box>
        );
    }
    if (all.length === 0) {
        return (
            <Box sx={{ display: "grid", gap: 2 }}>
                {headingWithNew}
                <EmptyState
                    body={c.emptyBody}
                    data-empty="custom-dashboards"
                    icon={<DashboardCustomizeRoundedIcon />}
                    title={c.emptyTitle}
                />
            </Box>
        );
    }

    return (
        <Box sx={{ display: "grid", gap: 2, minWidth: 0 }}>
            {headingWithNew}
            <Box
                sx={{
                    alignItems: "start",
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "260px minmax(0, 1fr)" },
                }}
            >
                <Box
                    aria-label={c.listLabel}
                    component="nav"
                    sx={{ display: "grid", gap: 2, minWidth: 0 }}
                >
                    {own.length > 0 && (
                        <Group
                            entries={own}
                            label={c.own}
                            selectedKey={selectedKey}
                            onSelect={select}
                        />
                    )}
                    {shared.length > 0 && (
                        <Group
                            entries={shared}
                            label={c.shared}
                            selectedKey={selectedKey}
                            onSelect={select}
                        />
                    )}
                </Box>

                {selected && (
                    <Box
                        data-testid="custom-dashboard-viewer"
                        sx={{
                            background: g.surface.default,
                            border: `1px solid ${g.border.subtle}`,
                            borderRadius: "12px",
                            display: "grid",
                            gap: 1,
                            minWidth: 0,
                            overflow: "hidden",
                            pb: 1.5,
                        }}
                    >
                        <Box
                            sx={{
                                alignItems: "center",
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 1,
                                justifyContent: "space-between",
                                px: 1.5,
                                pt: 1.25,
                            }}
                        >
                            {/* The note viewer prints the title itself; only a dashboard
                                without a page needs it here. */}
                            {selected.noteId == null && (
                                <Typography
                                    component="h3"
                                    level="title-md"
                                    sx={{
                                        color: g.text.primary,
                                        minWidth: 0,
                                        overflowWrap: "anywhere",
                                    }}
                                >
                                    {selected.title}
                                </Typography>
                            )}
                            <Box sx={{ display: "flex", gap: 0.75, marginInlineStart: "auto" }}>
                                {selected.scheduleId && (
                                    <Button
                                        loading={running}
                                        size="sm"
                                        startDecorator={<PlayArrowRoundedIcon />}
                                        variant="outlined"
                                        onClick={runNow}
                                    >
                                        {c.runNow}
                                    </Button>
                                )}
                                {selected.noteId != null && (
                                    <Button
                                        size="sm"
                                        startDecorator={<OpenInNewRoundedIcon />}
                                        variant="plain"
                                        onClick={() =>
                                            navigate(
                                                `/workspace/notes/${selected.shared ? "shared" : "my"}/${selected.noteId}`
                                            )
                                        }
                                    >
                                        {c.openNote}
                                    </Button>
                                )}
                            </Box>
                        </Box>
                        {selected.noteId != null ? (
                            <HtmlNoteView
                                key={`${selected.noteId}-${frameKey}`}
                                accessToken={accessToken}
                                isActive={onTasks}
                                noteId={selected.noteId}
                                noteType={MY_NOTE_TYPE}
                                title={selected.title}
                            />
                        ) : (
                            <EmptyState
                                body={c.notRunBody}
                                data-empty="custom-dashboard-not-run"
                                icon={<DashboardCustomizeRoundedIcon />}
                                size="sm"
                                title={c.notRunTitle}
                            />
                        )}
                    </Box>
                )}
            </Box>
        </Box>
    );
};

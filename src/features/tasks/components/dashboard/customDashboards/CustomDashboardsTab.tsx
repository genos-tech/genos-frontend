import { useEffect, useMemo, useRef, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DashboardCustomizeRoundedIcon from "@mui/icons-material/DashboardCustomizeRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import { Box, Button, IconButton, Typography } from "@mui/joy";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { Socket } from "socket.io-client";

import { AppTooltip } from "../../../../../components/ui/AppTooltip";
import { SectionHeading } from "../../../../../components/ui/dashboard";
import { EmptyState } from "../../../../../components/ui/feedback/EmptyState";
import { SkeletonLines } from "../../../../../components/ui/feedback/Skeleton";
import { toast } from "../../../../../components/ui/feedback/toastStore";
import { ConfirmDialog } from "../../../../../components/ui/modal/ConfirmDialog";
import { useAuth } from "../../../../../context/authState";
import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../../hooks/notes/useNoteManagement";
import { fmt, useTranslation } from "../../../../../i18n";
import { deleteSchedule, runScheduleNow } from "../../../../../services/schedules";
import { focusRing, g } from "../../../../../theme/tokens";
import type { UserProps } from "../../../../../types/admin";
import { HtmlNoteView } from "../../../../notes/common/components/HtmlNoteView";
import { ModalNoteSharing } from "../../../../notes/common/components/ModalNoteSharing";
import { useCustomDashboards } from "../../../hooks/useCustomDashboards";
import type { OwnDashboard, SharedDashboard } from "../../../services/loadCustomDashboards";
import { formatAgentWhen } from "../agentActivity/agentActivityLinks";
import { CUSTOM_DASHBOARD_PARAM } from "../dashboardTab";
import { DashboardScheduleDialog } from "./DashboardScheduleDialog";

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

/** Room kept at the end of an own row for its two icon buttons, so a title never runs under them. */
const ACTIONS_ROOM = 76;

const DashboardRow = ({
    entry,
    selected,
    onSelect,
    onEdit,
    onDelete,
    editLabel,
    deleteLabel,
}: {
    entry: Entry;
    selected: boolean;
    onSelect: () => void;
    /** Own dashboards only: a shared row has no actions. */
    onEdit?: () => void;
    onDelete?: () => void;
    editLabel: string;
    deleteLabel: string;
}) => {
    const actions = !!onEdit && !!onDelete;
    return (
        // The row is a container, not the button: a button cannot hold buttons. The actions sit over
        // the row's end edge, hidden until hover or keyboard focus anywhere in the row (opacity, so
        // they stay in the tab order), and always shown where there is no hover (touch).
        <Box
            data-dashboard-row=""
            sx={{
                borderRadius: "8px",
                position: "relative",
                "&:hover > button": { background: selected ? g.accent.subtle : g.hover },
                ...(actions
                    ? {
                          "&:has(:focus-visible) > [data-dashboard-actions]": {
                              opacity: 1,
                              pointerEvents: "auto",
                          },
                          "@media (hover: hover)": {
                              "&:hover > [data-dashboard-actions]": {
                                  opacity: 1,
                                  pointerEvents: "auto",
                              },
                          },
                          "@media (hover: none)": {
                              "& > [data-dashboard-actions]": {
                                  opacity: 1,
                                  pointerEvents: "auto",
                              },
                          },
                      }
                    : {}),
            }}
        >
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
                    ...(actions ? { pe: `${ACTIONS_ROOM}px` } : {}),
                    py: 0.75,
                    textAlign: "start",
                    width: "100%",
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
            {actions && (
                <Box
                    data-dashboard-actions=""
                    sx={{
                        alignItems: "center",
                        display: "flex",
                        gap: 0.25,
                        insetBlock: 0,
                        insetInlineEnd: 6,
                        opacity: 0,
                        pointerEvents: "none",
                        position: "absolute",
                    }}
                >
                    <AppTooltip title={editLabel}>
                        <IconButton
                            aria-label={editLabel}
                            data-testid="custom-dashboard-row-edit"
                            size="sm"
                            variant="plain"
                            onClick={onEdit}
                        >
                            <EditRoundedIcon />
                        </IconButton>
                    </AppTooltip>
                    <AppTooltip title={deleteLabel}>
                        <IconButton
                            aria-label={deleteLabel}
                            color="danger"
                            data-testid="custom-dashboard-row-delete"
                            size="sm"
                            variant="plain"
                            onClick={onDelete}
                        >
                            <DeleteOutlineRoundedIcon />
                        </IconButton>
                    </AppTooltip>
                </Box>
            )}
        </Box>
    );
};

const Group = ({
    label,
    entries,
    selectedKey,
    onSelect,
    onEdit,
    onDelete,
    editLabel,
    deleteLabel,
}: {
    label: string;
    entries: Entry[];
    selectedKey: string | null;
    onSelect: (entry: Entry) => void;
    onEdit?: (entry: Entry) => void;
    onDelete?: (entry: Entry) => void;
    editLabel?: (entry: Entry) => string;
    deleteLabel?: (entry: Entry) => string;
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
                    deleteLabel={deleteLabel?.(entry) ?? ""}
                    editLabel={editLabel?.(entry) ?? ""}
                    entry={entry}
                    selected={entry.key === selectedKey}
                    onDelete={onDelete ? () => onDelete(entry) : undefined}
                    onEdit={onEdit ? () => onEdit(entry) : undefined}
                    onSelect={() => onSelect(entry)}
                />
            ))}
        </Box>
    </Box>
);

/** What the share dialog of a dashboard's page needs from the app (it is the Notes page's own
 *  dialog). Absent where the host has no notes manager: there is then no Share button. */
export type DashboardShareHost = {
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    socket: Socket | null;
    teamMembers: UserProps[];
    useCM: ChatManagementState;
    useNM: NoteManagementState;
    useUISM: UIStateManagementState;
};

type Props = {
    /** The team the tab shows. The API needs it on every request; a change refetches. */
    teamId: string;
    share?: DashboardShareHost;
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
export const CustomDashboardsTab = ({ teamId, share }: Props) => {
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
    // Share (MIP-2357): the page's own share dialog, opened on the page that is on screen. The
    // members come from the notes manager, which holds one note's at a time, so they are read for
    // THIS note as the dialog opens; the dialog's grant and revoke name the note themselves.
    const [sharing, setSharing] = useState<{ noteId: number; title: string } | null>(null);
    const startSharing = (entry: Entry) => {
        if (!share || entry.noteId == null) return;
        setSharing({ noteId: entry.noteId, title: entry.title });
        void share.useNM.loadNoteMembers(MY_NOTE_TYPE, entry.noteId);
    };
    // Edit (MIP-2397): the dialog for a saved dashboard schedule; `hasNote` locks where its page is.
    const [editing, setEditing] = useState<{ scheduleId: string; hasNote: boolean } | null>(null);
    const edit = (entry: Entry) => {
        if (entry.scheduleId)
            setEditing({ scheduleId: entry.scheduleId, hasNote: entry.noteId != null });
    };
    // Delete: one confirm. The schedule goes; its page stays as an ordinary note in the member's notes.
    const [deleting, setDeleting] = useState<Entry | null>(null);
    const removeDashboard = async (entry: Entry): Promise<boolean> => {
        if (!entry.scheduleId) return true;
        const res = await deleteSchedule(accessToken, teamId, entry.scheduleId);
        if (!res.ok && !res.gone) {
            // The dialog shows a throw's message and stays open.
            throw new Error(res.error || c.deleteFailed);
        }
        if (res.ok) toast.success(c.deleteDone, { id: "custom-dashboard-deleted" });
        // The page is no longer a dashboard here: if the address named it, let go of it.
        if (entry.noteId != null && search.get(CUSTOM_DASHBOARD_PARAM) === String(entry.noteId)) {
            setSearch(
                (prev) => {
                    const next = new URLSearchParams(prev);
                    next.delete(CUSTOM_DASHBOARD_PARAM);
                    return next;
                },
                { replace: true }
            );
        }
        view.refresh();
        return true;
    };
    const editLabelOf = (entry: Entry) => fmt(c.editNamed, { name: entry.title });
    const deleteLabelOf = (entry: Entry) => fmt(c.deleteNamed, { name: entry.title });
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
            <DashboardScheduleDialog
                open={creating}
                teamId={teamId}
                onClose={() => setCreating(false)}
                onSaved={view.refresh}
            />
            <DashboardScheduleDialog
                editing={editing}
                open={editing !== null}
                teamId={teamId}
                onClose={() => setEditing(null)}
                onSaved={view.refresh}
            />
            {share && sharing && (
                <ModalNoteSharing
                    myself={share.myself}
                    noteId={sharing.noteId}
                    noteTitle={sharing.title}
                    noteType={MY_NOTE_TYPE}
                    notice={c.shareNotice}
                    setMyself={share.setMyself}
                    socket={share.socket}
                    teamMembers={share.teamMembers}
                    useCM={share.useCM}
                    useNM={share.useNM}
                    useUISM={share.useUISM}
                    open
                    onClose={() => setSharing(null)}
                />
            )}
            {deleting && (
                <ConfirmDialog
                    cancelLabel={t.common.actions.cancel}
                    confirmLabel={t.common.actions.delete}
                    description={fmt(c.deleteBody, { name: deleting.title })}
                    title={c.deleteTitle}
                    closeOnConfirm
                    destructive
                    open
                    onClose={() => setDeleting(null)}
                    onConfirm={() => removeDashboard(deleting)}
                />
            )}
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
                            deleteLabel={deleteLabelOf}
                            editLabel={editLabelOf}
                            entries={own}
                            label={c.own}
                            selectedKey={selectedKey}
                            onDelete={setDeleting}
                            onEdit={edit}
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
                                {share && selected.scheduleId && selected.noteId != null && (
                                    <IconButton
                                        aria-label={fmt(c.shareNamed, { name: selected.title })}
                                        data-testid="custom-dashboard-header-share"
                                        size="sm"
                                        variant="outlined"
                                        onClick={() => startSharing(selected)}
                                    >
                                        <ShareRoundedIcon />
                                    </IconButton>
                                )}
                                {selected.scheduleId && (
                                    <IconButton
                                        aria-label={editLabelOf(selected)}
                                        data-testid="custom-dashboard-header-edit"
                                        size="sm"
                                        variant="outlined"
                                        onClick={() => edit(selected)}
                                    >
                                        <EditRoundedIcon />
                                    </IconButton>
                                )}
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

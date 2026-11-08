import { useEffect, useMemo, useState } from "react";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import LinkOffRoundedIcon from "@mui/icons-material/LinkOffRounded";
import { Alert, Box, Button, Chip, IconButton, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import {
    MODAL_FRAME_DEFAULT_Z_INDEX,
    MODAL_FRAME_HOST_OFFSET,
    ModalFrame,
} from "../../../../components/ui/modal/ModalFrame";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";
import { ProjectProps, TaskDependencyRef, TaskProps } from "../../../../types/tasks";
import { ACTaskSelector, StatusChip } from "../autocompletes/ACTaskSelector";
import { TaskIdText } from "../card";

type Props = {
    open: boolean;
    onClose: () => void;
    /** Task whose dependencies we're managing (must have a real id). */
    taskContent: TaskProps;
    myself: UserProps;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
    /** Forwarded to the picker's project dropdown for its avatars. */
    useCM?: ChatManagementState;
    /** Which subsection to surface first when the modal opens. */
    focus?: "blocking" | "blockedBy";
    /** Stacking level of the hosting surface. The preview this modal is
     * opened from can itself sit far above Joy's modal layer — a
     * UrlLinkModal preview is 10020+, and one opened from a task-diagram
     * node is diagram-z + 15 — so without deriving from the host this
     * dialog rendered at Joy's ~1300 default, invisibly BEHIND the
     * diagram/preview ("can't open the dependency modal"). Host + 2
     * mirrors the note-modal convention; absent ⇒ page-hosted 10010
     * dialog-family default. */
    hostZIndex?: number;
};

// Visual atoms per direction (color + icon only). Title/description
// strings come from i18n at the call site — keeping them out of this
// constant means the file works for every locale without bundling
// English copy into the visual palette.
const DIRECTION_ACCENT: Record<
    "blocking" | "blockedBy",
    { color: string; bg: string; icon: React.ReactNode }
> = {
    blocking: {
        color: g.warning.text,
        bg: g.warning.subtle,
        icon: <ArrowUpwardRoundedIcon sx={{ fontSize: 14 }} />,
    },
    blockedBy: {
        color: g.danger.text,
        bg: g.danger.subtle,
        icon: <ArrowDownwardRoundedIcon sx={{ fontSize: 14 }} />,
    },
};

const DependencyRow = ({
    ref_,
    onRemove,
    isDark,
    removeTooltip,
}: {
    ref_: TaskDependencyRef;
    onRemove: () => void;
    isDark: boolean;
    removeTooltip: string;
}) => {
    return (
        <Stack
            alignItems="center"
            direction="row"
            spacing={1}
            sx={{
                p: 1,
                pl: 1.25,
                borderRadius: g.radius.md,
                background: g.bg.subtle,
                border: "1px solid",
                borderColor: g.border.subtle,
                transition: "background 0.15s ease, border-color 0.15s ease",
                "&:hover": { background: g.hover, borderColor: g.border.default },
            }}
        >
            <TaskIdText text={ref_.displayId ?? `#${ref_.otherTaskId}`} />
            <StatusChip isDark={isDark} meta={ref_.status} />
            <Typography level="body-md" sx={{ flex: 1, minWidth: 0, fontWeight: 500 }} noWrap>
                {ref_.title}
            </Typography>
            {ref_.projectName && (
                <AppTooltip title={ref_.projectName}>
                    <Chip
                        size="sm"
                        sx={{ maxWidth: 160, borderRadius: "5px", color: g.text.primary }}
                        variant="outlined"
                    >
                        {ref_.projectName}
                    </Chip>
                </AppTooltip>
            )}
            <AppTooltip title={removeTooltip}>
                <IconButton
                    color="danger"
                    size="sm"
                    sx={{ "--IconButton-size": "28px", opacity: 0.7, "&:hover": { opacity: 1 } }}
                    variant="plain"
                    onClick={onRemove}
                >
                    <LinkOffRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </AppTooltip>
        </Stack>
    );
};

export const ModalManageDependencies = ({
    open,
    onClose,
    taskContent,
    myself,
    usePM,
    useTM,
    useCM,
    focus,
    hostZIndex,
}: Props) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();
    const depsT = t.tasks.dependencies;

    const taskId = taskContent.id ?? null;
    const deps = (taskId != null && useTM.taskDependencies[taskId]) || {
        blocking: [],
        blockedBy: [],
    };

    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    // Per-section reset counters so adding to one side doesn't clear
    // the other side's selection.
    const [resetBlocking, setResetBlocking] = useState(0);
    const [resetBlockedBy, setResetBlockedBy] = useState(0);

    useEffect(() => {
        if (!open) setError(null);
    }, [open]);

    const excludeIds = useMemo(() => {
        const s = new Set<number>();
        if (taskId != null) s.add(taskId);
        for (const d of deps.blocking) s.add(d.otherTaskId);
        for (const d of deps.blockedBy) s.add(d.otherTaskId);
        return s;
    }, [taskId, deps]);

    const handleAdd = async (
        kind: "blocking" | "blockedBy",
        picked: { taskId: number; project?: ProjectProps }
    ) => {
        if (taskId == null) return;
        setError(null);
        setBusy(true);
        try {
            const blockerTaskId = kind === "blocking" ? taskId : picked.taskId;
            const blockedTaskId = kind === "blocking" ? picked.taskId : taskId;
            const result = await useTM.addTaskDependency({
                blockerTaskId,
                blockedTaskId,
                focusedTaskId: taskId,
            });
            if (!result.ok) {
                setError(result.error);
                return;
            }
            if (kind === "blocking") setResetBlocking((n) => n + 1);
            else setResetBlockedBy((n) => n + 1);
            // Reflect the backend's auto-"Blocked" transition immediately.
            // Refresh BOTH endpoints — only the blocked one changes status,
            // but this sidesteps any direction bookkeeping.
            await useTM.refreshTaskStatuses([
                { taskId, projectId: taskContent.project?.projectId ?? null },
                { taskId: picked.taskId, projectId: picked.project?.projectId ?? null },
            ]);
        } finally {
            setBusy(false);
        }
    };

    const handleRemove = async (ref_: TaskDependencyRef) => {
        if (taskId == null) return;
        setError(null);
        setBusy(true);
        try {
            const ok = await useTM.removeTaskDependency(ref_.dependencyId, taskId);
            if (!ok) {
                setError(depsT.modal.removeFailed);
                return;
            }
            // Removing a blocker can auto-revert the blocked task
            // "Blocked" -> "Open". Refresh both endpoints (focused + the
            // other task) so whichever one changed reflects immediately.
            await useTM.refreshTaskStatuses([
                { taskId, projectId: taskContent.project?.projectId ?? null },
                { taskId: ref_.otherTaskId, projectId: ref_.projectId },
            ]);
        } finally {
            setBusy(false);
        }
    };

    const initialProjectId = taskContent.project?.projectId ?? null;

    const order: ("blocking" | "blockedBy")[] =
        focus === "blockedBy" ? ["blockedBy", "blocking"] : ["blocking", "blockedBy"];

    const sectionDataFor = (k: "blocking" | "blockedBy") =>
        k === "blocking"
            ? { items: deps.blocking, resetKey: resetBlocking }
            : { items: deps.blockedBy, resetKey: resetBlockedBy };

    // The frame lifts itself host + 2 (10010 on the page); the pickers that
    // portal to <body> take the layer above it.
    const modalZIndex =
        hostZIndex != null ? hostZIndex + MODAL_FRAME_HOST_OFFSET : MODAL_FRAME_DEFAULT_Z_INDEX;

    return (
        <ModalFrame
            description={depsT.modal.subtitle}
            hostZIndex={hostZIndex}
            icon={<BlockRoundedIcon sx={{ color: g.warning.text }} />}
            open={open}
            size="wide"
            title={depsT.modal.title}
            actions={
                <Button color="neutral" variant="plain" onClick={onClose}>
                    {depsT.modal.doneButton}
                </Button>
            }
            onClose={onClose}
        >
            {error && (
                <Alert
                    color="danger"
                    size="sm"
                    sx={{ mb: 1.5 }}
                    variant="soft"
                    endDecorator={
                        <IconButton
                            color="danger"
                            size="sm"
                            variant="plain"
                            onClick={() => setError(null)}
                        >
                            <CloseRoundedIcon />
                        </IconButton>
                    }
                >
                    {error}
                </Alert>
            )}

            <Stack spacing={2}>
                {order.map((k) => {
                    const { items, resetKey } = sectionDataFor(k);
                    const title = k === "blocking" ? depsT.blockingLabel : depsT.blockedByLabel;
                    const description =
                        k === "blocking"
                            ? depsT.modal.blockingDescription
                            : depsT.modal.blockedByDescription;
                    return (
                        <DependencySection
                            key={k}
                            busy={busy}
                            defaultProjectId={initialProjectId}
                            deps={items}
                            description={description}
                            emptyLabel={depsT.modal.emptySection}
                            excludeIds={excludeIds}
                            isDark={isDark}
                            kind={k}
                            myself={myself}
                            popupZIndex={modalZIndex + 1}
                            removeTooltip={depsT.modal.removeTooltip}
                            resetKey={resetKey}
                            title={title}
                            useCM={useCM}
                            usePM={usePM}
                            onAdd={(p) => handleAdd(k, p)}
                            onRemove={handleRemove}
                        />
                    );
                })}
            </Stack>
        </ModalFrame>
    );
};

type SectionProps = {
    kind: "blocking" | "blockedBy";
    title: string;
    description: string;
    emptyLabel: string;
    removeTooltip: string;
    deps: TaskDependencyRef[];
    excludeIds: Set<number>;
    isDark: boolean;
    myself: UserProps;
    usePM: ProjectManagementState;
    useCM?: ChatManagementState;
    defaultProjectId: number | null;
    resetKey: number;
    busy: boolean;
    /** Lifts the picker's portaled listboxes above the dialog. */
    popupZIndex: number;
    onAdd: (picked: { taskId: number; project: ProjectProps }) => void;
    onRemove: (ref_: TaskDependencyRef) => void;
};

const DependencySection = ({
    kind,
    title,
    description,
    emptyLabel,
    removeTooltip,
    deps,
    excludeIds,
    isDark,
    myself,
    usePM,
    useCM,
    defaultProjectId,
    resetKey,
    busy,
    popupZIndex,
    onAdd,
    onRemove,
}: SectionProps) => {
    const accent = DIRECTION_ACCENT[kind];
    return (
        <Box
            sx={{
                p: 1.5,
                borderRadius: g.radius.md,
                background: g.bg.subtle,
                border: "1px solid",
                borderColor: g.border.subtle,
            }}
        >
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 1.25 }}>
                <Box
                    sx={{
                        width: 26,
                        height: 26,
                        borderRadius: "7px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: accent.bg,
                        color: accent.color,
                    }}
                >
                    {accent.icon}
                </Box>
                <Typography level="title-md" sx={{ fontWeight: 600 }}>
                    {title}
                </Typography>
                <Chip size="sm" sx={{ fontWeight: 600, borderRadius: "5px" }} variant="soft">
                    {deps.length}
                </Chip>
                <Typography level="body-sm" sx={{ opacity: 0.7, flex: 1 }}>
                    {description}
                </Typography>
            </Stack>

            {deps.length > 0 ? (
                <Stack spacing={0.5} sx={{ mb: 1.25 }}>
                    {deps.map((d) => (
                        <DependencyRow
                            key={d.dependencyId}
                            isDark={isDark}
                            ref_={d}
                            removeTooltip={removeTooltip}
                            onRemove={() => onRemove(d)}
                        />
                    ))}
                </Stack>
            ) : (
                <Box
                    sx={{
                        mb: 1.25,
                        py: 1.75,
                        px: 1,
                        borderRadius: g.radius.md,
                        border: "1px dashed",
                        borderColor: g.border.default,
                        textAlign: "center",
                    }}
                >
                    <Typography level="body-sm" sx={{ opacity: 0.6 }}>
                        {emptyLabel}
                    </Typography>
                </Box>
            )}

            <Box sx={{ opacity: busy ? 0.55 : 1, pointerEvents: busy ? "none" : "auto" }}>
                <ACTaskSelector
                    defaultProjectId={defaultProjectId}
                    excludeTaskIds={excludeIds}
                    myself={myself}
                    popupZIndex={popupZIndex}
                    resetKey={resetKey}
                    useCM={useCM}
                    usePM={usePM}
                    onPick={onAdd}
                />
            </Box>
        </Box>
    );
};

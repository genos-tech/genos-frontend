import { useEffect, useMemo, useState } from "react";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import LinkOffRoundedIcon from "@mui/icons-material/LinkOffRounded";
import {
    Alert,
    Box,
    Button,
    Chip,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    Modal,
    ModalDialog,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { TaskDependencyRef, TaskProps } from "../../../../types/tasks";
import { ACTaskSelector, StatusChip } from "../autocompletes/ACTaskSelector";

type Props = {
    open: boolean;
    onClose: () => void;
    /** Task whose dependencies we're managing (must have a real id). */
    taskContent: TaskProps;
    myself: UserProps;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
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
    { color: string; icon: React.ReactNode }
> = {
    blocking: {
        color: "#ff8c00",
        icon: <ArrowUpwardRoundedIcon sx={{ fontSize: 14 }} />,
    },
    blockedBy: {
        color: "#b91c1c",
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
                borderRadius: "10px",
                background: isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.025)",
                border: "1px solid",
                borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                transition: "background 0.15s ease, border-color 0.15s ease",
                "&:hover": {
                    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                    borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                },
            }}
        >
            <Chip
                size="sm"
                variant="outlined"
                sx={{
                    fontWeight: 600,
                    fontFamily: "monospace",
                    borderRadius: "5px",
                }}
            >
                {ref_.displayId ?? `#${ref_.otherTaskId}`}
            </Chip>
            <StatusChip isDark={isDark} meta={ref_.status} />
            <Typography level="body-md" sx={{ flex: 1, minWidth: 0, fontWeight: 500 }} noWrap>
                {ref_.title}
            </Typography>
            {ref_.projectName && (
                <AppTooltip title={ref_.projectName}>
                    <Chip
                        size="sm"
                        variant="outlined"
                        sx={{
                            maxWidth: 160,
                            borderRadius: "5px",
                            color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)",
                        }}
                    >
                        {ref_.projectName}
                    </Chip>
                </AppTooltip>
            )}
            <AppTooltip title={removeTooltip}>
                <IconButton
                    color="danger"
                    size="sm"
                    variant="plain"
                    sx={{
                        "--IconButton-size": "28px",
                        opacity: 0.7,
                        "&:hover": { opacity: 1 },
                    }}
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

    const handleAdd = async (kind: "blocking" | "blockedBy", picked: { taskId: number }) => {
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
        } finally {
            setBusy(false);
        }
    };

    const handleRemove = async (dependencyId: number) => {
        if (taskId == null) return;
        setError(null);
        setBusy(true);
        try {
            const ok = await useTM.removeTaskDependency(dependencyId, taskId);
            if (!ok) setError(depsT.modal.removeFailed);
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

    const modalZIndex = hostZIndex != null ? hostZIndex + 2 : 10010;

    return (
        <Modal
            open={open}
            sx={{
                zIndex: modalZIndex,
                // Joy pins popups to ~theme.zIndex.modal + 1 and doesn't
                // track the sx override above. Stamping the var on the
                // modal root lifts every popup that renders INLINE in this
                // subtree (tooltips included — CSS custom properties
                // inherit). The ACTaskSelector listboxes PORTAL to <body>
                // and can't inherit it, so they take the same value via
                // `popupZIndex` below.
                "--unstable_popup-zIndex": modalZIndex + 1,
            }}
            onClose={onClose}
        >
            <ModalDialog
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                size="md"
                variant="outlined"
                sx={{
                    width: { xs: "calc(100vw - 24px)", md: "auto" },
                    minWidth: { xs: 0, md: 620 },
                    maxWidth: { xs: "100vw", md: 780 },
                    maxHeight: { xs: "calc(100dvh - 32px)", md: "85vh" },
                    overflowY: "auto",
                    p: 0,
                    background: isDark
                        ? "linear-gradient(180deg, rgba(22,22,28,0.98) 0%, rgba(18,18,24,1) 100%)"
                        : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(252,252,255,1) 100%)",
                    border: "1px solid",
                    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                }}
            >
                {/* Gradient accent at top — matches the create-form treatment */}
                <Box
                    sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: "3px",
                        background: isDark
                            ? "linear-gradient(90deg, #fbbf24 0%, #f97316 50%, #ef4444 100%)"
                            : "linear-gradient(90deg, #d97706 0%, #ea580c 50%, #dc2626 100%)",
                        borderRadius: "8px 8px 0 0",
                        opacity: 0.85,
                    }}
                />

                <DialogTitle sx={{ px: 3, pt: 2.5, pb: 1 }}>
                    <Stack alignItems="center" direction="row" spacing={1.25}>
                        <Box
                            sx={{
                                width: 30,
                                height: 30,
                                borderRadius: "8px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: isDark
                                    ? "rgba(249,115,22,0.15)"
                                    : "rgba(234,88,12,0.1)",
                                color: isDark ? "#fbbf24" : "#ea580c",
                            }}
                        >
                            <BlockRoundedIcon sx={{ fontSize: 18 }} />
                        </Box>
                        <Stack spacing={0}>
                            <Typography level="title-md" sx={{ fontWeight: 700 }}>
                                {depsT.modal.title}
                            </Typography>
                            <Typography level="body-xs" sx={{ opacity: 0.7 }}>
                                {depsT.modal.subtitle}
                            </Typography>
                        </Stack>
                    </Stack>
                    <IconButton
                        color="neutral"
                        size="sm"
                        sx={{ position: "absolute", top: 12, right: 12 }}
                        variant="plain"
                        onClick={onClose}
                    >
                        <CloseRoundedIcon />
                    </IconButton>
                </DialogTitle>
                <Divider />

                <DialogContent sx={{ px: 3, py: 2 }}>
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
                            const title =
                                k === "blocking" ? depsT.blockingLabel : depsT.blockedByLabel;
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
                                    usePM={usePM}
                                    onAdd={(p) => handleAdd(k, p)}
                                    onRemove={handleRemove}
                                />
                            );
                        })}
                    </Stack>
                </DialogContent>

                <Divider />
                <Stack direction="row" justifyContent="flex-end" sx={{ px: 3, py: 1.5 }}>
                    <Button color="neutral" variant="plain" onClick={onClose}>
                        {depsT.modal.doneButton}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
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
    defaultProjectId: number | null;
    resetKey: number;
    busy: boolean;
    /** Lifts the picker's portaled listboxes above the dialog. */
    popupZIndex: number;
    onAdd: (picked: { taskId: number }) => void;
    onRemove: (dependencyId: number) => void;
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
                borderRadius: "12px",
                background: isDark ? "rgba(255,255,255,0.015)" : "rgba(0,0,0,0.01)",
                border: "1px solid",
                borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
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
                        background: alpha(accent.color, isDark ? 0.18 : 0.12),
                        color: accent.color,
                    }}
                >
                    {accent.icon}
                </Box>
                <Typography level="title-md" sx={{ fontWeight: 700 }}>
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
                            onRemove={() => onRemove(d.dependencyId)}
                        />
                    ))}
                </Stack>
            ) : (
                <Box
                    sx={{
                        mb: 1.25,
                        py: 1.75,
                        px: 1,
                        borderRadius: "10px",
                        border: "1px dashed",
                        borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
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
                    usePM={usePM}
                    onPick={onAdd}
                />
            </Box>
        </Box>
    );
};

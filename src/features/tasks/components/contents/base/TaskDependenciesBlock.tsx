import { useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import LinkOffRoundedIcon from "@mui/icons-material/LinkOffRounded";
import { Box, Chip, IconButton, ListItem, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AppTooltip } from "../../../../../components/ui/AppTooltip";
import { useUrlLinkModal } from "../../../../../hooks/common/UrlLinkModalContext";
import { ProjectManagementState } from "../../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../../hooks/tasks/useTaskManagement";
import { fmt, useTranslation } from "../../../../../i18n";
import { UserProps } from "../../../../../types/admin";
import { TaskDependencyRef, TaskProps } from "../../../../../types/tasks";
import { StatusChip } from "../../autocompletes/ACTaskSelector";
import { ModalManageDependencies } from "../../modals/ModalManageDependencies";

const FieldLabel = ({ children, isDark }: { children: React.ReactNode; isDark: boolean }) => (
    <Typography
        level="body-sm"
        sx={{
            minWidth: "85px",
            fontWeight: 500,
            fontSize: "0.8rem",
            color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
        }}
    >
        {children}
    </Typography>
);

type Props = {
    taskContent: TaskProps;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
    myself: UserProps;
    isPreviewMode: boolean;
    // Set when rendering inside the UrlLinkModal — dependency chips
    // then re-target the modal instead of mutating the host page's
    // preview state (which the modal ignores). See TaskMainBlock.
    hostZIndex?: number;
};

// Compact dependency display + entry point to the manage modal. Always
// rendered as part of `TaskMainBlock` so the same surface appears in
// both TaskPreview and MilestonePreview (milestone uses a backing
// TaskMaster row under the hood). Hidden entirely when the task has
// no real id yet (create flow) — dependencies are preview-only.
export const TaskDependenciesBlock = ({
    taskContent,
    usePM,
    useTM,
    myself,
    isPreviewMode,
    hostZIndex,
}: Props) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();
    const depsT = t.tasks.dependencies;
    const urlLinkModal = useUrlLinkModal();

    const taskId = taskContent.id ?? null;
    const deps = (taskId != null && useTM.taskDependencies[taskId]) || {
        blocking: [],
        blockedBy: [],
    };

    const [modalOpen, setModalOpen] = useState(false);
    const [modalFocus, setModalFocus] = useState<"blocking" | "blockedBy">("blockedBy");
    // Dependency id with an inline remove in flight — disables that
    // chip's unlink button so a double-click can't fire the DELETE
    // twice. Single slot (not a Set): the buttons are tiny and removes
    // resolve fast; racing two different removes is fine (each targets
    // its own dependencyId), we only guard re-clicks of the SAME one.
    const [removingDepId, setRemovingDepId] = useState<number | null>(null);

    const isEmpty = deps.blocking.length === 0 && deps.blockedBy.length === 0;

    const openModal = (focus: "blocking" | "blockedBy") => {
        setModalFocus(focus);
        setModalOpen(true);
    };

    const handleChipRemove = async (ref_: TaskDependencyRef) => {
        if (taskId == null || removingDepId === ref_.dependencyId) return;
        setRemovingDepId(ref_.dependencyId);
        try {
            // Same call the manage modal makes: DELETE then refetch this
            // task's dependency slots, so the chip disappears from state
            // rather than being optimistically hidden. On failure the
            // chip simply stays put (state untouched) — the modal remains
            // the surface with explicit error copy.
            const ok = await useTM.removeTaskDependency(ref_.dependencyId, taskId);
            if (!ok) {
                console.error(
                    "[TaskDependenciesBlock] inline dependency remove failed:",
                    ref_.dependencyId
                );
            }
        } finally {
            setRemovingDepId(null);
        }
    };

    const handleChipClick = (ref_: TaskDependencyRef) => {
        // Modal-hosted → re-target the modal (global preview setters
        // would change the page BEHIND it; the click looked dead).
        const chipProjectId = ref_.projectId ?? taskContent.project?.projectId;
        if (hostZIndex != null && urlLinkModal && chipProjectId) {
            urlLinkModal.openModalByHref(
                `/workspace/tasks/project/${chipProjectId}/task/${ref_.otherTaskId}`
            );
            return;
        }
        // Mirrors the Parent Task row navigation: when the dependency
        // is in a different project we have to switch the current
        // project so the preview pane can hydrate against that
        // project's task list.
        if (ref_.projectId && ref_.projectId !== taskContent.project?.projectId) {
            usePM.setCurrentProject({
                projectId: ref_.projectId,
                projectName: ref_.projectName ?? "",
                projectTags: [],
            });
        }
        useTM.setCurrentPreviewTaskId(ref_.otherTaskId);
    };

    // Only show the block in preview mode (the create form would have
    // taskContent.id but the manage modal needs a real, persisted task
    // — empty-task rows already have an id, so we gate on `isPreviewMode`
    // instead of an id check).
    if (!isPreviewMode || taskId == null) return null;

    return (
        <>
            {isEmpty ? (
                <ListItem sx={{ display: "flex", alignItems: "center" }}>
                    <FieldLabel isDark={isDark}>{depsT.sectionLabel}</FieldLabel>
                    <AppTooltip title={depsT.addCtaTooltip}>
                        <Box
                            sx={{
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 0.6,
                                p: 0.6,
                                px: 1.8,
                                borderRadius: "8px",
                                color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.6)",
                                transition: "background 0.15s ease, color 0.15s ease",
                                "&:hover": {
                                    background: isDark
                                        ? "rgba(255,255,255,0.05)"
                                        : "rgba(0,0,0,0.04)",
                                    color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.9)",
                                },
                            }}
                            onClick={() => openModal("blockedBy")}
                        >
                            <AddRoundedIcon sx={{ fontSize: 18 }} />
                            <Typography level="body-sm" sx={{ fontWeight: 500 }}>
                                {depsT.addCta}
                            </Typography>
                        </Box>
                    </AppTooltip>
                </ListItem>
            ) : (
                <>
                    <DependencyRow
                        addTooltip={fmt(depsT.addRowTooltip, { label: depsT.blockingLabel })}
                        deps={deps.blocking}
                        icon={<BlockRoundedIcon sx={{ fontSize: 14, color: "#ff8c00" }} />}
                        isDark={isDark}
                        label={depsT.blockingLabel}
                        noneLabel={depsT.noneLabel}
                        removeTooltip={depsT.removeChipTooltip}
                        removingDepId={removingDepId}
                        onAdd={() => openModal("blocking")}
                        onChipClick={handleChipClick}
                        onChipRemove={handleChipRemove}
                    />
                    <DependencyRow
                        addTooltip={fmt(depsT.addRowTooltip, { label: depsT.blockedByLabel })}
                        deps={deps.blockedBy}
                        icon={<BlockRoundedIcon sx={{ fontSize: 14, color: "#b91c1c" }} />}
                        isDark={isDark}
                        label={depsT.blockedByLabel}
                        noneLabel={depsT.noneLabel}
                        removeTooltip={depsT.removeChipTooltip}
                        removingDepId={removingDepId}
                        onAdd={() => openModal("blockedBy")}
                        onChipClick={handleChipClick}
                        onChipRemove={handleChipRemove}
                    />
                </>
            )}

            <ModalManageDependencies
                focus={modalFocus}
                hostZIndex={hostZIndex}
                myself={myself}
                open={modalOpen}
                taskContent={taskContent}
                usePM={usePM}
                useTM={useTM}
                onClose={() => setModalOpen(false)}
            />
        </>
    );
};

const DependencyRow = ({
    label,
    icon,
    deps,
    isDark,
    addTooltip,
    noneLabel,
    removeTooltip,
    removingDepId,
    onAdd,
    onChipClick,
    onChipRemove,
}: {
    label: string;
    icon: React.ReactNode;
    deps: TaskDependencyRef[];
    isDark: boolean;
    addTooltip: string;
    noneLabel: string;
    removeTooltip: string;
    removingDepId: number | null;
    onAdd: () => void;
    onChipClick: (ref_: TaskDependencyRef) => void;
    onChipRemove: (ref_: TaskDependencyRef) => void;
}) => (
    <ListItem sx={{ display: "flex", alignItems: "flex-start" }}>
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                minWidth: "85px",
            }}
        >
            {icon}
            <FieldLabel isDark={isDark}>{label}</FieldLabel>
        </Box>
        <Box
            sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 0.5,
                flex: 1,
                alignItems: "center",
            }}
        >
            {deps.map((d) => (
                <DependencyChip
                    key={d.dependencyId}
                    isDark={isDark}
                    ref_={d}
                    removeTooltip={removeTooltip}
                    removing={removingDepId === d.dependencyId}
                    onClick={() => onChipClick(d)}
                    onRemove={() => onChipRemove(d)}
                />
            ))}
            {deps.length === 0 && (
                <Typography level="body-sm" sx={{ opacity: 0.55 }}>
                    {noneLabel}
                </Typography>
            )}
            <AppTooltip title={addTooltip}>
                <IconButton
                    size="sm"
                    variant="plain"
                    sx={{
                        "--IconButton-size": "26px",
                        minHeight: "26px",
                        minWidth: "26px",
                        p: 0,
                        color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)",
                    }}
                    onClick={onAdd}
                >
                    <AddRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </AppTooltip>
        </Box>
    </ListItem>
);

const DependencyChip = ({
    ref_,
    isDark,
    removeTooltip,
    removing,
    onClick,
    onRemove,
}: {
    ref_: TaskDependencyRef;
    isDark: boolean;
    removeTooltip: string;
    removing: boolean;
    onClick: () => void;
    onRemove: () => void;
}) => {
    const statusLabel = ref_.status.status ?? "";
    const tip = ref_.projectName
        ? `${ref_.projectName} · ${statusLabel || "—"}`
        : statusLabel || "";
    return (
        <AppTooltip title={tip}>
            <Box
                sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.6,
                    px: 0.85,
                    py: 0.35,
                    borderRadius: "8px",
                    cursor: "pointer",
                    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                    border: "1px solid",
                    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                    transition: "background 0.15s ease, border-color 0.15s ease",
                    "&:hover": {
                        background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                        borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)",
                    },
                    maxWidth: 280,
                }}
                onClick={onClick}
            >
                <Chip
                    size="sm"
                    variant="outlined"
                    sx={{
                        fontWeight: 600,
                        fontFamily: "monospace",
                        borderRadius: "5px",
                        justifyContent: "center",
                    }}
                >
                    {ref_.displayId ?? `#${ref_.otherTaskId}`}
                </Chip>
                <StatusChip isDark={isDark} meta={ref_.status} />
                <Typography
                    level="body-sm"
                    sx={{
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 160,
                    }}
                >
                    {ref_.title}
                </Typography>
                {/* Inline unlink — same LinkOff icon (and hook call) as the
                    manage modal's per-row remove, so a dependency can be
                    dropped without opening the modal. Sits INSIDE the
                    clickable chip, hence the stopPropagation: a mis-aimed
                    remove must not also navigate to the other task. */}
                <AppTooltip title={removeTooltip}>
                    <IconButton
                        aria-label={removeTooltip}
                        color="danger"
                        disabled={removing}
                        size="sm"
                        variant="plain"
                        sx={{
                            "--IconButton-size": "18px",
                            minHeight: "18px",
                            minWidth: "18px",
                            p: 0,
                            ml: -0.15,
                            opacity: 0.55,
                            "&:hover": { opacity: 1 },
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove();
                        }}
                    >
                        <LinkOffRoundedIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                </AppTooltip>
            </Box>
        </AppTooltip>
    );
};

// Helper: true when the task has at least one *open* (non-Closed) blocker.
// Plain function (no hooks) so TaskMainBlock can call it inline without
// breaking the rules of hooks.
export const isCurrentlyBlocked = (
    taskId: number | null | undefined,
    useTM: TaskManagementState
): boolean => {
    if (taskId == null) return false;
    const entry = useTM.taskDependencies[taskId];
    if (!entry) return false;
    return entry.blockedBy.some((d) => (d.status.status ?? "").toLowerCase() !== "closed");
};

import { useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import { Box, Chip, IconButton, ListItem, Tooltip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

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

    const [modalOpen, setModalOpen] = useState(false);
    const [modalFocus, setModalFocus] = useState<"blocking" | "blockedBy">("blockedBy");

    const isEmpty = deps.blocking.length === 0 && deps.blockedBy.length === 0;

    const openModal = (focus: "blocking" | "blockedBy") => {
        setModalFocus(focus);
        setModalOpen(true);
    };

    const handleChipClick = (ref_: TaskDependencyRef) => {
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
                    <Tooltip placement="top" title={depsT.addCtaTooltip} variant="outlined" arrow>
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
                    </Tooltip>
                </ListItem>
            ) : (
                <>
                    <DependencyRow
                        deps={deps.blocking}
                        icon={<BlockRoundedIcon sx={{ fontSize: 14, color: "#ff8c00" }} />}
                        isDark={isDark}
                        label={depsT.blockingLabel}
                        addTooltip={fmt(depsT.addRowTooltip, { label: depsT.blockingLabel })}
                        noneLabel={depsT.noneLabel}
                        onAdd={() => openModal("blocking")}
                        onChipClick={handleChipClick}
                    />
                    <DependencyRow
                        deps={deps.blockedBy}
                        icon={<BlockRoundedIcon sx={{ fontSize: 14, color: "#b91c1c" }} />}
                        isDark={isDark}
                        label={depsT.blockedByLabel}
                        addTooltip={fmt(depsT.addRowTooltip, { label: depsT.blockedByLabel })}
                        noneLabel={depsT.noneLabel}
                        onAdd={() => openModal("blockedBy")}
                        onChipClick={handleChipClick}
                    />
                </>
            )}

            <ModalManageDependencies
                focus={modalFocus}
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
    onAdd,
    onChipClick,
}: {
    label: string;
    icon: React.ReactNode;
    deps: TaskDependencyRef[];
    isDark: boolean;
    addTooltip: string;
    noneLabel: string;
    onAdd: () => void;
    onChipClick: (ref_: TaskDependencyRef) => void;
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
                    onClick={() => onChipClick(d)}
                />
            ))}
            {deps.length === 0 && (
                <Typography level="body-sm" sx={{ opacity: 0.55 }}>
                    {noneLabel}
                </Typography>
            )}
            <Tooltip placement="top" title={addTooltip} variant="outlined" arrow>
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
            </Tooltip>
        </Box>
    </ListItem>
);

const DependencyChip = ({
    ref_,
    isDark,
    onClick,
}: {
    ref_: TaskDependencyRef;
    isDark: boolean;
    onClick: () => void;
}) => {
    const statusLabel = ref_.status.status ?? "";
    const tip = ref_.projectName
        ? `${ref_.projectName} · ${statusLabel || "—"}`
        : statusLabel || "";
    return (
        <Tooltip placement="top" title={tip} variant="outlined" arrow>
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
                <StatusChip meta={ref_.status} isDark={isDark} />
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
            </Box>
        </Tooltip>
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

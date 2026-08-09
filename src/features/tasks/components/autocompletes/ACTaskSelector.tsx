import { useEffect, useMemo, useState } from "react";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
    Autocomplete,
    AutocompleteOption,
    Box,
    Chip,
    CircularProgress,
    ListItemContent,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { ProjectProps, TaskStatusProps, TaskTableProps } from "../../../../types/tasks";
import { loadProjectTasksFromApi } from "../../services/loadProjectTasksFromApi";
import { projectAvatarSrc } from "../../utils/projectAvatar";
import { statuses, taskMetaLabel } from "../../utils/taskMeta";
import { ProjectIdentityDecorator, ProjectIdentityRow } from "../ProjectIdentityRow";
import { TaskIdentityRow } from "../TaskIdentityRow";

// Resolve a status string ("Open" / "WIP" / …) into the canonical
// {color, textColor} pair owned by `taskMeta.statuses`, so every status
// chip in the dependency UI looks the same as `ACTaskStatus.tsx`.
const statusMeta = (label: string | null | undefined): TaskStatusProps => {
    const found = statuses.find((s) => s.status === label);
    return (
        found ?? {
            code: 0,
            status: label ?? "—",
            color: null,
            textColor: null,
        }
    );
};

// The popup surface, lifted from the sidebar's task search so this
// dialog's dropdowns read as the same control the user already knows.
// Deliberately styles the popup only — the ROWS get their padding,
// hover, focus and selected states from Joy's `AutocompleteOption`,
// which is what keeps them identical to the sidebar search and to the
// preview's project picker instead of drifting behind local overrides.
const listboxSlotSx = (isDark: boolean) =>
    ({
        maxHeight: 320,
        borderRadius: "12px",
        boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.5)" : "0 8px 32px rgba(0,0,0,0.12)",
        border: "1px solid",
        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
        "& .MuiAutocomplete-option": {
            borderRadius: "8px",
            mx: 0.5,
            my: 0.25,
        },
    }) as const;

type Props = {
    myself: UserProps;
    usePM: ProjectManagementState;
    /** Project that opened the picker — used as the default project. */
    defaultProjectId: number | null | undefined;
    /** Task ids that must NOT appear in the task list (self, already-linked). */
    excludeTaskIds: Set<number>;
    /** Fires when the user picks a task. */
    onPick: (task: { taskId: number; project: ProjectProps }) => void;
    /** Bumped by the parent after a successful add to clear the selection. */
    resetKey?: number;
    size?: "sm" | "md";
    /** Both autocompletes' listboxes PORTAL to <body>, so they don't
     * inherit the host dialog's `--unstable_popup-zIndex` stamp. A host
     * lifted above Joy's defaults (ModalManageDependencies goes to
     * 10010+, and higher when UrlLinkModal/diagram-hosted) must pass its
     * own z here or the dropdowns open invisibly BEHIND it. Per-component
     * on purpose — a `& ~ [role="listbox"]` sibling rule would claim
     * popups this surface doesn't own (the fe #122 cascade race). */
    popupZIndex?: number;
    /** Chat list, used to resolve each project's avatar from its PM
     *  chat — same role it plays in `ACTeamProjects`. Optional: without
     *  it the options still render, just with the generic project icon
     *  instead of the uploaded image. */
    useCM?: ChatManagementState;
};

// Cross-project task picker. Two stacked autocompletes — Project on the
// left, Task on the right. Project list is already scoped to the
// current team via `usePM.teamProjects`; tasks for the selected project
// are fetched on demand and cached per-project for the lifetime of
// the modal so flipping back and forth doesn't re-hit the network.
export const ACTaskSelector = ({
    myself,
    usePM,
    defaultProjectId,
    excludeTaskIds,
    onPick,
    resetKey,
    size = "md",
    popupZIndex,
    useCM,
}: Props) => {
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();
    const pickerT = t.tasks.dependencies.picker;

    const projects = usePM.teamProjects;
    const initialProject =
        projects.find((p) => p.projectId === defaultProjectId) ?? projects[0] ?? null;
    const [selectedProject, setSelectedProject] = useState<ProjectProps | null>(initialProject);
    const [selectedTask, setSelectedTask] = useState<TaskTableProps | null>(null);
    const [tasksByProject, setTasksByProject] = useState<Record<number, TaskTableProps[]>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Parent bumps resetKey after a successful add — drop the
        // current task selection so the next add starts fresh while
        // the project stays sticky.
        setSelectedTask(null);
    }, [resetKey]);

    useEffect(() => {
        if (!selectedProject) return;
        const pid = selectedProject.projectId;
        if (tasksByProject[pid]) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const response = await loadProjectTasksFromApi(myself, pid, accessToken, null);
                if (cancelled) return;
                setTasksByProject((prev) => ({
                    ...prev,
                    [pid]: response?.tasks ?? [],
                }));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [selectedProject, myself, accessToken, tasksByProject]);

    const taskOptions = useMemo<TaskTableProps[]>(() => {
        if (!selectedProject) return [];
        const all = tasksByProject[selectedProject.projectId] ?? [];
        return all.filter((t) => {
            const id = t.id != null ? Number(t.id) : NaN;
            if (Number.isNaN(id)) return false;
            if (excludeTaskIds.has(id)) return false;
            // Hide finished/removed rows — a dependency should point at
            // live work. Closed and Deleted are both filtered out (per
            // user request); the source endpoint already excludes
            // Deleted on its full-load path, so this also guards the
            // incremental/cache path. Trade-off: you can no longer add a
            // dependency onto an already-Closed task.
            const status = (t.status ?? "").toLowerCase();
            return status !== "deleted" && status !== "closed";
        });
    }, [selectedProject, tasksByProject, excludeTaskIds]);

    const scrollbarClass = `custom-scrollbar-${isDark ? "dark" : "light"}`;
    const listboxSlotProps = {
        listbox: {
            className: scrollbarClass,
            sx: {
                ...listboxSlotSx(isDark),
                ...(popupZIndex != null ? { zIndex: popupZIndex } : {}),
            },
        },
    };

    return (
        <Box
            sx={{
                p: 1.25,
                borderRadius: "12px",
                background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
                border: "1px solid",
                borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
            }}
        >
            <Stack alignItems="stretch" direction="row" spacing={1}>
                {/* Project picker */}
                <Box sx={{ minWidth: 200, maxWidth: 260, flex: "0 1 220px" }}>
                    <FieldCaption
                        icon={<FolderRoundedIcon sx={CAPTION_ICON_SX} />}
                        isDark={isDark}
                    >
                        {pickerT.projectLabel}
                    </FieldCaption>
                    <Autocomplete
                        getOptionLabel={(opt) => opt?.projectName ?? ""}
                        isOptionEqualToValue={(a, b) => a.projectId === b.projectId}
                        options={projects}
                        placeholder={pickerT.projectPlaceholder}
                        size={size}
                        slotProps={listboxSlotProps}
                        sx={INPUT_SX}
                        value={selectedProject}
                        renderOption={(optionProps, opt) => (
                            // Joy's own option component and the shared
                            // identity row, exactly as `ACTeamProjects`
                            // renders the preview's Project field: a project
                            // has to look the same wherever it's picked, and
                            // a bare name is genuinely ambiguous once a team
                            // runs "Website" under two labels. Joy's option
                            // also consumes the internal `ownerState`, so no
                            // `stripOwnerState` is needed here.
                            <AutocompleteOption
                                {...optionProps}
                                key={opt.projectId}
                                sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}
                            >
                                <ProjectIdentityRow
                                    avatarSrc={projectAvatarSrc(opt.projectId, useCM?.allChats)}
                                    maxLabels={2}
                                    project={opt}
                                />
                            </AutocompleteOption>
                        )}
                        startDecorator={
                            // The closed field can only show the option
                            // LABEL — a bare name. This puts the row's
                            // avatar and markers back next to it.
                            <ProjectIdentityDecorator
                                project={selectedProject}
                                avatarSrc={projectAvatarSrc(
                                    selectedProject?.projectId,
                                    useCM?.allChats
                                )}
                                fallback={
                                    <FolderRoundedIcon sx={{ fontSize: 18, opacity: 0.6 }} />
                                }
                            />
                        }
                        onChange={(_e, value) => setSelectedProject(value)}
                    />
                </Box>

                {/* Task picker */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <FieldCaption
                        icon={<AssignmentRoundedIcon sx={CAPTION_ICON_SX} />}
                        isDark={isDark}
                    >
                        {pickerT.taskLabel}
                    </FieldCaption>
                    <Autocomplete
                        disabled={!selectedProject}
                        isOptionEqualToValue={(a, b) => a.id === b.id}
                        loading={loading}
                        options={taskOptions}
                        size={size}
                        slotProps={listboxSlotProps}
                        startDecorator={<SearchRoundedIcon sx={{ fontSize: 18, opacity: 0.6 }} />}
                        sx={INPUT_SX}
                        value={selectedTask}
                        endDecorator={
                            loading ? <CircularProgress size="sm" variant="plain" /> : null
                        }
                        getOptionLabel={(opt) =>
                            opt ? `${opt.displayId ?? `#${opt.id}`} ${opt.title ?? ""}`.trim() : ""
                        }
                        noOptionsText={
                            <Typography level="body-sm" sx={{ opacity: 0.6 }}>
                                {selectedProject ? pickerT.noTasks : pickerT.noProject}
                            </Typography>
                        }
                        placeholder={
                            selectedProject
                                ? pickerT.taskPlaceholder
                                : pickerT.taskPlaceholderDisabled
                        }
                        renderOption={(optionProps, opt) => (
                            // The sidebar task search's row, verbatim — same
                            // control, same options, so the same presentation.
                            <AutocompleteOption {...optionProps} key={opt.id}>
                                <ListItemContent sx={{ fontSize: "sm" }}>
                                    <TaskIdentityRow
                                        isMilestone={opt.isMilestone}
                                        status={statusMeta(opt.status)}
                                        task={opt}
                                        title={opt.title}
                                    />
                                </ListItemContent>
                            </AutocompleteOption>
                        )}
                        onChange={(_e, value) => {
                            if (value && value.id != null && selectedProject) {
                                onPick({
                                    taskId: Number(value.id),
                                    project: selectedProject,
                                });
                                // Don't retain the picked task as the value:
                                // adding it as a dependency immediately drops
                                // it from `taskOptions` (excludeTaskIds), and
                                // MUI warns when a controlled Autocomplete
                                // value isn't among its options ("None of the
                                // options match..."). The parent shows the new
                                // dependency in its list, so the picker resets
                                // to empty. (Pre-existing race, unrelated to
                                // the status-sync change — surfaces most on
                                // milestone picks.)
                                setSelectedTask(null);
                            } else {
                                setSelectedTask(value);
                            }
                        }}
                    />
                </Box>
            </Stack>
        </Box>
    );
};

// Shared status chip — same shape as `ACTaskStatus.tsx`'s renderOption
// chip: soft variant, alpha-tinted background using the meta color,
// bold text, rounded 5px corners. Sized to content (no min-width) so
// the label sits flush within the chip's padding instead of being
// left-aligned inside a wider box. Exported so the modal + the compact
// chip block render identical chips end-to-end.
export const StatusChip = ({ meta, isDark }: { meta: TaskStatusProps; isDark: boolean }) => {
    const { t } = useTranslation();
    return (
        <Chip
            size="sm"
            variant="soft"
            sx={{
                backgroundColor: meta.color
                    ? alpha(meta.color, isDark ? 0.5 : 0.75)
                    : "transparent",
                color: meta.textColor ?? undefined,
                fontWeight: "bold",
                borderRadius: "5px",
            }}
        >
            {taskMetaLabel(meta.status, t.tasks.filters) || "—"}
        </Chip>
    );
};

const CAPTION_ICON_SX = { fontSize: 13, opacity: 0.6 } as const;

const FieldCaption = ({
    icon,
    isDark,
    children,
}: {
    icon: React.ReactNode;
    isDark: boolean;
    children: React.ReactNode;
}) => (
    <Stack alignItems="center" direction="row" spacing={0.5} sx={{ mb: 0.5, pl: 0.25 }}>
        {icon}
        <Typography
            level="body-xs"
            sx={{
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontSize: 11,
                color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)",
            }}
        >
            {children}
        </Typography>
    </Stack>
);

// Subtle visual treatment on the Autocomplete input: a soft outline that
// turns into the primary accent on focus. Mirrors the input feel of
// modern picker UIs without overriding Joy's variant system.
const INPUT_SX = {
    width: "100%",
    "--Autocomplete-paddingInline": "12px",
    transition: "box-shadow 0.15s ease, border-color 0.15s ease",
    "&:hover": {
        borderColor: "var(--joy-palette-neutral-outlinedHoverBorder)",
    },
    "&.Mui-focused": {
        boxShadow: "0 0 0 3px var(--joy-palette-primary-softBg)",
    },
} as const;

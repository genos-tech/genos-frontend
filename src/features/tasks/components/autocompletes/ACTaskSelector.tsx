import { useEffect, useMemo, useState } from "react";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { Autocomplete, Box, Chip, CircularProgress, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { useAuth } from "../../../../context/AuthContext";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { UserProps } from "../../../../types/admin";
import { ProjectProps, TaskStatusProps, TaskTableProps } from "../../../../types/tasks";
import { loadProjectTasksFromApi } from "../../services/loadProjectTasksFromApi";
import { statuses } from "../../utils/taskMeta";

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

// Lifted from SprintMilestonePicker so both pickers feel like part of
// the same design system: padded rows, breathing room, hover & selected
// states tied to the Joy palette tokens so dark/light mode both look
// right without duplicate sx values.
const LISTBOX_SLOT_SX = {
    py: 0.5,
    maxHeight: 320,
    "& > li[role='option']": {
        px: 1,
        py: 0.7,
        mx: 0.5,
        my: 0.25,
        borderRadius: "8px",
        cursor: "pointer",
        transition: "background-color 0.15s ease, color 0.15s ease, transform 0.15s ease",
        "&:hover": {
            backgroundColor: "var(--joy-palette-neutral-plainHoverBg)",
            transform: "translateX(1px)",
        },
        "&.Mui-focused, &.Mui-focusVisible": {
            backgroundColor: "var(--joy-palette-neutral-plainHoverBg)",
        },
        "&[aria-selected='true']": {
            backgroundColor: "var(--joy-palette-primary-softBg)",
            color: "var(--joy-palette-primary-softColor)",
            "&:hover": {
                backgroundColor: "var(--joy-palette-primary-softHoverBg)",
            },
        },
    },
} as const;

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
}: Props) => {
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

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
                const data = await loadProjectTasksFromApi(myself, pid, accessToken);
                if (cancelled) return;
                setTasksByProject((prev) => ({
                    ...prev,
                    [pid]: Array.isArray(data) ? data : [],
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
            // Hide soft-deleted; Closed stays selectable so users can
            // record historical relationships.
            return (t.status ?? "").toLowerCase() !== "deleted";
        });
    }, [selectedProject, tasksByProject, excludeTaskIds]);

    const scrollbarClass = `custom-scrollbar-${isDark ? "dark" : "light"}`;

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
            <Stack direction="row" spacing={1} alignItems="stretch">
                {/* Project picker */}
                <Box sx={{ minWidth: 200, maxWidth: 260, flex: "0 1 220px" }}>
                    <FieldCaption
                        isDark={isDark}
                        icon={<FolderRoundedIcon sx={CAPTION_ICON_SX} />}
                    >
                        Project
                    </FieldCaption>
                    <Autocomplete
                        size={size}
                        value={selectedProject}
                        options={projects}
                        getOptionLabel={(opt) => opt?.projectName ?? ""}
                        isOptionEqualToValue={(a, b) => a.projectId === b.projectId}
                        onChange={(_e, value) => setSelectedProject(value)}
                        placeholder="Choose project…"
                        startDecorator={<FolderRoundedIcon sx={{ fontSize: 18, opacity: 0.6 }} />}
                        slotProps={{
                            listbox: { className: scrollbarClass, sx: LISTBOX_SLOT_SX },
                        }}
                        renderOption={(props, opt) => (
                            <Box component="li" {...props} key={opt.projectId}>
                                <Stack
                                    direction="row"
                                    spacing={1}
                                    alignItems="center"
                                    sx={{ width: "100%", minWidth: 0 }}
                                >
                                    <FolderRoundedIcon
                                        sx={{
                                            fontSize: 16,
                                            color: isDark
                                                ? "rgba(255,255,255,0.6)"
                                                : "rgba(0,0,0,0.55)",
                                        }}
                                    />
                                    <Typography
                                        level="body-md"
                                        sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}
                                        noWrap
                                    >
                                        {opt.projectName}
                                    </Typography>
                                    {opt.projectCode && (
                                        <Chip
                                            size="sm"
                                            variant="outlined"
                                            sx={{
                                                fontFamily: "monospace",
                                                fontWeight: 600,
                                                borderRadius: "5px",
                                            }}
                                        >
                                            {opt.projectCode}
                                        </Chip>
                                    )}
                                </Stack>
                            </Box>
                        )}
                        sx={INPUT_SX}
                    />
                </Box>

                {/* Task picker */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <FieldCaption
                        isDark={isDark}
                        icon={<AssignmentRoundedIcon sx={CAPTION_ICON_SX} />}
                    >
                        Task
                    </FieldCaption>
                    <Autocomplete
                        size={size}
                        value={selectedTask}
                        loading={loading}
                        options={taskOptions}
                        getOptionLabel={(opt) =>
                            opt ? `${opt.displayId ?? `#${opt.id}`} ${opt.title ?? ""}`.trim() : ""
                        }
                        isOptionEqualToValue={(a, b) => a.id === b.id}
                        placeholder={
                            selectedProject ? "Search by ID or title…" : "Pick a project first…"
                        }
                        disabled={!selectedProject}
                        startDecorator={<SearchRoundedIcon sx={{ fontSize: 18, opacity: 0.6 }} />}
                        endDecorator={
                            loading ? <CircularProgress size="sm" variant="plain" /> : null
                        }
                        onChange={(_e, value) => {
                            setSelectedTask(value);
                            if (value && value.id != null && selectedProject) {
                                onPick({
                                    taskId: Number(value.id),
                                    project: selectedProject,
                                });
                            }
                        }}
                        slotProps={{
                            listbox: { className: scrollbarClass, sx: LISTBOX_SLOT_SX },
                        }}
                        renderOption={(props, opt) => {
                            const meta = statusMeta(opt.status);
                            return (
                                <Box component="li" {...props} key={opt.id}>
                                    <Stack
                                        direction="row"
                                        spacing={1}
                                        alignItems="center"
                                        sx={{ width: "100%", minWidth: 0 }}
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
                                            {opt.displayId ?? `#${opt.id}`}
                                        </Chip>
                                        <StatusChip meta={meta} isDark={isDark} />
                                        <Typography
                                            level="body-md"
                                            noWrap
                                            sx={{
                                                flex: 1,
                                                minWidth: 0,
                                                fontWeight: 500,
                                            }}
                                        >
                                            {opt.title}
                                        </Typography>
                                    </Stack>
                                </Box>
                            );
                        }}
                        noOptionsText={
                            <Typography level="body-sm" sx={{ opacity: 0.6 }}>
                                {selectedProject
                                    ? "No matching tasks."
                                    : "Select a project to see tasks."}
                            </Typography>
                        }
                        sx={INPUT_SX}
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
export const StatusChip = ({ meta, isDark }: { meta: TaskStatusProps; isDark: boolean }) => (
    <Chip
        size="sm"
        variant="soft"
        sx={{
            backgroundColor: meta.color ? alpha(meta.color, isDark ? 0.5 : 0.75) : "transparent",
            color: meta.textColor ?? undefined,
            fontWeight: "bold",
            borderRadius: "5px",
        }}
    >
        {meta.status ?? "—"}
    </Chip>
);

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
    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5, pl: 0.25 }}>
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

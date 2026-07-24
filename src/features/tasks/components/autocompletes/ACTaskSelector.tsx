import { useEffect, useMemo, useState } from "react";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { Autocomplete, Box, Chip, CircularProgress, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { useAuth } from "../../../../context/AuthContext";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { ProjectProps, TaskStatusProps, TaskTableProps } from "../../../../types/tasks";
import { stripOwnerState } from "../../../../utils/joyAutocomplete";
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
    /** Both autocompletes' listboxes PORTAL to <body>, so they don't
     * inherit the host dialog's `--unstable_popup-zIndex` stamp. A host
     * lifted above Joy's defaults (ModalManageDependencies goes to
     * 10010+, and higher when UrlLinkModal/diagram-hosted) must pass its
     * own z here or the dropdowns open invisibly BEHIND it. Per-component
     * on purpose — a `& ~ [role="listbox"]` sibling rule would claim
     * popups this surface doesn't own (the fe #122 cascade race). */
    popupZIndex?: number;
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
                        startDecorator={<FolderRoundedIcon sx={{ fontSize: 18, opacity: 0.6 }} />}
                        sx={INPUT_SX}
                        value={selectedProject}
                        renderOption={(props, opt) => (
                            // stripOwnerState: bespoke <li> rows (not Joy's
                            // AutocompleteOption) must not forward Joy's
                            // internal ownerState to the DOM — React warns
                            // on every rendered option otherwise.
                            <Box component="li" {...stripOwnerState(props)} key={opt.projectId}>
                                <Stack
                                    alignItems="center"
                                    direction="row"
                                    spacing={1}
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
                        slotProps={{
                            listbox: {
                                className: scrollbarClass,
                                sx: {
                                    ...LISTBOX_SLOT_SX,
                                    ...(popupZIndex != null ? { zIndex: popupZIndex } : {}),
                                },
                            },
                        }}
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
                        renderOption={(props, opt) => {
                            const meta = statusMeta(opt.status);
                            return (
                                <Box component="li" {...stripOwnerState(props)} key={opt.id}>
                                    <Stack
                                        alignItems="center"
                                        direction="row"
                                        spacing={1}
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
                                        <StatusChip isDark={isDark} meta={meta} />
                                        <Typography
                                            level="body-md"
                                            sx={{
                                                flex: 1,
                                                minWidth: 0,
                                                fontWeight: 500,
                                            }}
                                            noWrap
                                        >
                                            {opt.title}
                                        </Typography>
                                    </Stack>
                                </Box>
                            );
                        }}
                        slotProps={{
                            listbox: {
                                className: scrollbarClass,
                                sx: {
                                    ...LISTBOX_SLOT_SX,
                                    ...(popupZIndex != null ? { zIndex: popupZIndex } : {}),
                                },
                            },
                        }}
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

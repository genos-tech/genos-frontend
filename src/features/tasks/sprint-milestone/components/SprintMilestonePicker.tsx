import { useMemo } from "react";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import {
    Autocomplete,
    Avatar,
    AvatarGroup,
    Box,
    Chip,
    LinearProgress,
    Stack,
    Typography,
} from "@mui/joy";

import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { Milestone, Sprint } from "../types";
import { compareMilestones } from "../utils/sortMilestones";

type SprintOption = { kind: "sprint"; id: number | null; label: string; sprint: Sprint | null };
type MilestoneOption = {
    kind: "milestone";
    id: number | null;
    label: string;
    milestone: Milestone | null;
};

type Props = {
    projectId: number | undefined;
    useSM: SprintMilestoneManagementState;
    sprintId: number | null | undefined;
    milestoneId: number | null | undefined;
    onChangeSprint: (sprintId: number | null) => void;
    // Picking a milestone may also auto-sync the sprint linkage when
    // the milestone points at a sprint different from the current one.
    // We deliberately bundle both updates into a single callback (and
    // therefore a single `setState` upstream) — emitting them as two
    // separate callbacks caused parents that read state via closure
    // to clobber the milestone update with the sprint update inside
    // the same React batch (the second `setState({...prev, ...})` only
    // saw the stale `prev` and dropped `milestoneId`). `autoSyncedSprint`
    // is non-null iff the picker also wants the parent to update the
    // sprint linkage in the same step.
    onChangeMilestone: (
        milestoneId: number | null,
        taskId: number | null,
        autoSyncedSprint?: Sprint | null
    ) => void;
    showSprint?: boolean;
    showMilestone?: boolean;
    disabled?: boolean;
    size?: "sm" | "md";
};

const NO_SPRINT: SprintOption = {
    kind: "sprint",
    id: null,
    label: "No sprint",
    sprint: null,
};

const NO_MILESTONE: MilestoneOption = {
    kind: "milestone",
    id: null,
    label: "No milestone",
    milestone: null,
};

const SPRINT_STATUS_COLOR: Record<string, "primary" | "warning" | "success" | "neutral"> = {
    upcoming: "neutral",
    active: "primary",
    completed: "success",
    archived: "neutral",
};

const MILESTONE_STATUS_COLOR: Record<string, "primary" | "warning" | "success" | "neutral"> = {
    Open: "primary",
    WIP: "warning",
    Pending: "neutral",
    Closed: "success",
    Deleted: "neutral",
};

// Shared listbox slot styling for both autocompletes. Joy's default
// listbox lays options flush against each other with no breathing room
// and only a faint focus background, which felt cramped (see user
// feedback). This pads each option, separates them slightly, rounds the
// corners, and adds a real hover/selected colour that adapts to dark
// and light mode via Joy palette CSS variables.
const OPTION_LISTBOX_SLOT_PROPS = {
    listbox: {
        sx: {
            py: 0.5,
            "& > li[role='option']": {
                px: 1.25,
                py: 0.6,
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
        },
    },
} as const;

export const SprintMilestonePicker = ({
    projectId,
    useSM,
    sprintId,
    milestoneId,
    onChangeSprint,
    onChangeMilestone,
    showSprint = true,
    showMilestone = true,
    disabled,
    size = "sm",
}: Props) => {
    const sprints: Sprint[] = useMemo(
        () => (projectId ? (useSM.projectSprints[projectId] ?? []) : []),
        [projectId, useSM.projectSprints]
    );
    const milestones: Milestone[] = useMemo(
        () => (projectId ? (useSM.projectMilestones[projectId] ?? []) : []),
        [projectId, useSM.projectMilestones]
    );

    const sprintOptions: SprintOption[] = useMemo(() => {
        return [
            NO_SPRINT,
            ...sprints.map<SprintOption>((s) => ({
                kind: "sprint",
                id: s.sprintId,
                label: `${s.name} (${s.startDate}→${s.endDate})`,
                sprint: s,
            })),
        ];
    }, [sprints]);

    // Milestone options always show every milestone in the project so a
    // sprint change doesn't make the currently-selected milestone vanish
    // from the dropdown. The selected milestone is the source of truth
    // for the sprint linkage (see the milestone Autocomplete's onChange
    // below, which auto-syncs the sprint to match the milestone).
    //
    // Sort matches the sidebar (`MilestonesListItem`) — three levels:
    // due-date asc (null last) → custom status order → title asc — so
    // both surfaces show milestones in the same order. `NO_MILESTONE`
    // is prepended after sort so the sentinel always stays on top.
    const milestoneOptions: MilestoneOption[] = useMemo(() => {
        const sorted = [...milestones].sort(compareMilestones);
        return [
            NO_MILESTONE,
            ...sorted.map<MilestoneOption>((m) => ({
                kind: "milestone",
                id: m.milestoneId,
                label: m.title,
                milestone: m,
            })),
        ];
    }, [milestones]);

    const selectedSprint = sprintOptions.find((o) => o.id === (sprintId ?? null)) ?? NO_SPRINT;
    const selectedMilestone =
        milestoneOptions.find((o) => o.id === (milestoneId ?? null)) ?? NO_MILESTONE;

    return (
        <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
            {showSprint && (
                <Autocomplete
                    size={size}
                    value={selectedSprint}
                    options={sprintOptions}
                    getOptionLabel={(o) => o.label}
                    disableClearable
                    disabled={disabled}
                    onChange={(_, v) => {
                        onChangeSprint(v?.id ?? null);
                        // We deliberately don't touch `milestoneId`
                        // here. Picking a milestone auto-syncs the
                        // sprint, so changing the sprint alone leaves
                        // the current milestone untouched and lets the
                        // user override the linkage explicitly when
                        // they want to.
                    }}
                    renderOption={(props, option) => (
                        <li {...props} key={`s-${option.id ?? "none"}`}>
                            <Stack
                                direction="column"
                                spacing={0.25}
                                sx={{ width: "100%", py: 0.25 }}
                            >
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <CalendarMonthRoundedIcon
                                        sx={{ fontSize: 14, opacity: 0.7 }}
                                    />
                                    <Typography level="body-sm" sx={{ fontWeight: 600, flex: 1 }}>
                                        {option.sprint?.name ?? option.label}
                                    </Typography>
                                    {option.sprint && (
                                        <Chip
                                            size="sm"
                                            variant="soft"
                                            color={
                                                SPRINT_STATUS_COLOR[option.sprint.status] ??
                                                "neutral"
                                            }
                                        >
                                            {option.sprint.status}
                                        </Chip>
                                    )}
                                </Stack>
                                {option.sprint && (
                                    <Typography level="body-xs" sx={{ opacity: 0.7, pl: 2.5 }}>
                                        {option.sprint.startDate} → {option.sprint.endDate}
                                    </Typography>
                                )}
                            </Stack>
                        </li>
                    )}
                    slotProps={OPTION_LISTBOX_SLOT_PROPS}
                    sx={{ flex: 1, minWidth: 0 }}
                />
            )}
            {showMilestone && (
                <Autocomplete
                    size={size}
                    value={selectedMilestone}
                    options={milestoneOptions}
                    getOptionLabel={(o) => o.label}
                    disableClearable
                    disabled={disabled}
                    onChange={(_, v) => {
                        // Auto-sync the sprint to the milestone's
                        // sprint when one is set, so the two pickers
                        // stay coherent without nagging the user.
                        // Resolve the sprint here and forward it to
                        // the parent in a SINGLE callback so the
                        // upstream setState collapses both updates
                        // into one batch (see `onChangeMilestone`
                        // doc above for why two callbacks corrupted
                        // the state).
                        let autoSyncedSprint: Sprint | null = null;
                        if (v?.milestone) {
                            const linkedSprintId = v.milestone.sprintId;
                            if (linkedSprintId != null && linkedSprintId !== sprintId) {
                                autoSyncedSprint =
                                    sprints.find((s) => s.sprintId === linkedSprintId) ?? null;
                            }
                        }
                        onChangeMilestone(
                            v?.id ?? null,
                            v?.milestone?.taskId ?? null,
                            autoSyncedSprint
                        );
                    }}
                    renderOption={(props, option) => {
                        const m = option.milestone;
                        const linkedSprintName =
                            m?.sprintId != null
                                ? (sprints.find((s) => s.sprintId === m.sprintId)?.name ??
                                  "Sprint")
                                : "No sprint";
                        const total = m?.tasksTotal ?? 0;
                        const closed = m?.tasksClosed ?? 0;
                        const pct = total > 0 ? Math.round((closed / total) * 100) : 0;
                        return (
                            <li {...props} key={`m-${option.id ?? "none"}`}>
                                <Stack
                                    direction="column"
                                    spacing={0.25}
                                    sx={{ width: "100%", py: 0.25 }}
                                >
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <FlagRoundedIcon sx={{ fontSize: 14, color: "#f97316" }} />
                                        <Typography
                                            level="body-sm"
                                            sx={{ fontWeight: 600, flex: 1 }}
                                        >
                                            {option.label}
                                        </Typography>
                                        {m && (
                                            <Chip
                                                size="sm"
                                                variant="soft"
                                                color={
                                                    MILESTONE_STATUS_COLOR[m.status as string] ??
                                                    "neutral"
                                                }
                                            >
                                                {m.status}
                                            </Chip>
                                        )}
                                    </Stack>
                                    {m && (
                                        <Stack
                                            direction="row"
                                            spacing={1}
                                            alignItems="center"
                                            sx={{ pl: 2.5 }}
                                        >
                                            <Chip size="sm" variant="outlined">
                                                {linkedSprintName}
                                            </Chip>
                                            <Typography level="body-xs" sx={{ opacity: 0.7 }}>
                                                {closed}/{total} tasks
                                            </Typography>
                                            <Box sx={{ flex: 1, minWidth: 60 }}>
                                                <LinearProgress
                                                    determinate
                                                    value={pct}
                                                    size="sm"
                                                    color={pct === 100 ? "success" : "primary"}
                                                    sx={{
                                                        "--LinearProgress-thickness": "4px",
                                                    }}
                                                />
                                            </Box>
                                            {m.assignees && m.assignees.length > 0 && (
                                                <AvatarGroup
                                                    size="sm"
                                                    sx={{ "--Avatar-size": "18px" }}
                                                >
                                                    {m.assignees.slice(0, 3).map((a) => (
                                                        <Avatar
                                                            key={String(a.userId)}
                                                            sx={{ fontSize: 10 }}
                                                        >
                                                            {(
                                                                a.username?.[0] || "?"
                                                            ).toUpperCase()}
                                                        </Avatar>
                                                    ))}
                                                </AvatarGroup>
                                            )}
                                        </Stack>
                                    )}
                                </Stack>
                            </li>
                        );
                    }}
                    slotProps={OPTION_LISTBOX_SLOT_PROPS}
                    sx={{ flex: 1, minWidth: 0 }}
                />
            )}
        </Stack>
    );
};

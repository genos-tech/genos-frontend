import { useMemo } from "react";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import { Autocomplete, Box, Chip, LinearProgress, Stack, Typography } from "@mui/joy";

import { AvatarGroup, BaseAvatar } from "../../../../components/ui/avatars/BaseAvatar";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { useTranslation } from "../../../../i18n";
import { stripOwnerState } from "../../../../utils/joyAutocomplete";
import { StatusLabel } from "../../components/meta/StatusLabel";
import { SprintStatusLabel } from "../../components/meta/ToneLabel";
import { Milestone, Sprint } from "../types";
import { selectVisibleMilestones, selectVisibleSprints } from "../utils/sortMilestones";

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
    // Picking a milestone also settles the sprint: a task's sprint is its
    // milestone's, or none. We deliberately bundle both updates into a single
    // callback (and therefore a single `setState` upstream) — emitting them as
    // two separate callbacks caused parents that read state via closure to
    // clobber the milestone update with the sprint update inside the same React
    // batch (the second `setState({...prev, ...})` only saw the stale `prev` and
    // dropped `milestoneId`). `sprintId` is ALWAYS the sprint the task has
    // after the pick: the milestone's own, or `null` for none (a milestone
    // without a sprint, or no milestone). It used to be sent only when the
    // milestone's sprint differed from the current one, so `null` could not be
    // told from "unsaid" and a task kept a sprint it no longer had (MIP-1035).
    onChangeMilestone: (
        milestoneId: number | null,
        taskId: number | null,
        sprintId: number | null
    ) => void;
    showSprint?: boolean;
    showMilestone?: boolean;
    disabled?: boolean;
    size?: "sm" | "md";
};

const makeNoSprint = (label: string): SprintOption => ({
    kind: "sprint",
    id: null,
    label,
    sprint: null,
});

const makeNoMilestone = (label: string): MilestoneOption => ({
    kind: "milestone",
    id: null,
    label,
    milestone: null,
});

// Shared listbox slot styling for both autocompletes. Joy's default
// listbox lays options flush against each other with no breathing room
// and only a faint focus background, which felt cramped (see user
// feedback). This pads each option, separates them slightly, rounds the
// corners, and adds a real hover/selected colour that adapts to dark
// and light mode via Joy palette CSS variables.
export const OPTION_LISTBOX_SLOT_PROPS = {
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
    const { t } = useTranslation();
    const NO_SPRINT = useMemo(() => makeNoSprint(t.tasks.picker.noSprintLabel), [t]);
    const NO_MILESTONE = useMemo(() => makeNoMilestone(t.tasks.picker.noMilestoneLabel), [t]);
    const sprints: Sprint[] = useMemo(
        () => (projectId ? (useSM.projectSprints[projectId] ?? []) : []),
        [projectId, useSM.projectSprints]
    );
    const milestones: Milestone[] = useMemo(
        () => (projectId ? (useSM.projectMilestones[projectId] ?? []) : []),
        [projectId, useSM.projectMilestones]
    );

    // Sprint options are limited to "currently relevant" sprints (active
    // and upcoming) so the picker doesn't accumulate finished sprints.
    // The currently-selected sprint is re-admitted if filtering would
    // otherwise drop it, so a task already linked to a completed sprint
    // still shows its real selection (and can be changed) instead of
    // silently appearing as "No sprint".
    const sprintOptions: SprintOption[] = useMemo(() => {
        const visible = selectVisibleSprints(sprints);
        const list =
            sprintId != null && !visible.some((s) => s.sprintId === sprintId)
                ? [...visible, ...sprints.filter((s) => s.sprintId === sprintId)]
                : visible;
        return [
            NO_SPRINT,
            ...list.map<SprintOption>((s) => ({
                kind: "sprint",
                id: s.sprintId,
                label: `${s.name} (${s.startDate}→${s.endDate})`,
                sprint: s,
            })),
        ];
    }, [sprints, sprintId, NO_SPRINT]);

    // Milestone options use the same visibility selector as the sidebar
    // (`MilestonesListItem`) — hides soft-deleted / `Deleted` and any
    // `Closed` whose sprint has ended. The currently-selected milestone
    // is re-admitted if filtering would drop it, so we never silently
    // flip a Closed-in-old-sprint linkage to "No milestone".
    //
    // Sort comes from `selectVisibleMilestones` (three-level: due-date
    // asc → custom status order → title asc). The orphan/fallback row
    // (if any) is appended last so "this is the current value but no
    // longer in your active set" is visually distinct.
    const milestoneOptions: MilestoneOption[] = useMemo(() => {
        const visible = selectVisibleMilestones(milestones, sprints);
        const list =
            milestoneId != null && !visible.some((m) => m.milestoneId === milestoneId)
                ? [...visible, ...milestones.filter((m) => m.milestoneId === milestoneId)]
                : visible;
        return [
            NO_MILESTONE,
            ...list.map<MilestoneOption>((m) => ({
                kind: "milestone",
                id: m.milestoneId,
                label: m.title,
                milestone: m,
            })),
        ];
    }, [milestones, sprints, milestoneId, NO_MILESTONE]);

    const selectedSprint = sprintOptions.find((o) => o.id === (sprintId ?? null)) ?? NO_SPRINT;
    const selectedMilestone =
        milestoneOptions.find((o) => o.id === (milestoneId ?? null)) ?? NO_MILESTONE;

    return (
        <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
            {showSprint && (
                <Autocomplete
                    disabled={disabled}
                    getOptionLabel={(o) => o.label}
                    options={sprintOptions}
                    size={size}
                    slotProps={OPTION_LISTBOX_SLOT_PROPS}
                    sx={{ flex: 1, minWidth: 0 }}
                    value={selectedSprint}
                    renderOption={(props, option) => (
                        // stripOwnerState: bespoke <li> rows must not forward
                        // Joy's internal ownerState to the DOM (React warns
                        // on every rendered option otherwise).
                        <li {...stripOwnerState(props)} key={`s-${option.id ?? "none"}`}>
                            <Stack
                                direction="column"
                                spacing={0.25}
                                sx={{ width: "100%", py: 0.25 }}
                            >
                                <Stack alignItems="center" direction="row" spacing={1}>
                                    <CalendarMonthRoundedIcon
                                        sx={{ fontSize: 14, opacity: 0.7 }}
                                    />
                                    <Typography level="body-sm" sx={{ fontWeight: 600, flex: 1 }}>
                                        {option.sprint?.name ?? option.label}
                                    </Typography>
                                    {option.sprint && (
                                        <SprintStatusLabel status={option.sprint.status} />
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
                    disableClearable
                    onChange={(_, v) => {
                        onChangeSprint(v?.id ?? null);
                        // We deliberately don't touch `milestoneId`
                        // here. Picking a milestone auto-syncs the
                        // sprint, so changing the sprint alone leaves
                        // the current milestone untouched and lets the
                        // user override the linkage explicitly when
                        // they want to.
                    }}
                />
            )}
            {showMilestone && (
                <Autocomplete
                    disabled={disabled}
                    getOptionLabel={(o) => o.label}
                    options={milestoneOptions}
                    size={size}
                    slotProps={OPTION_LISTBOX_SLOT_PROPS}
                    sx={{ flex: 1, minWidth: 0 }}
                    value={selectedMilestone}
                    renderOption={(props, option) => {
                        const m = option.milestone;
                        const linkedSprintName =
                            m?.sprintId != null
                                ? (sprints.find((s) => s.sprintId === m.sprintId)?.name ??
                                  t.tasks.picker.sprintFallback)
                                : t.tasks.picker.noSprintLabel;
                        const total = m?.tasksTotal ?? 0;
                        const closed = m?.tasksClosed ?? 0;
                        const pct = total > 0 ? Math.round((closed / total) * 100) : 0;
                        return (
                            <li {...stripOwnerState(props)} key={`m-${option.id ?? "none"}`}>
                                <Stack
                                    direction="column"
                                    spacing={0.25}
                                    sx={{ width: "100%", py: 0.25 }}
                                >
                                    <Stack alignItems="center" direction="row" spacing={1}>
                                        <FlagRoundedIcon sx={{ fontSize: 14, color: "#f97316" }} />
                                        <Typography
                                            level="body-sm"
                                            sx={{ fontWeight: 600, flex: 1 }}
                                        >
                                            {option.label}
                                        </Typography>
                                        {m && <StatusLabel status={m.status as string} />}
                                    </Stack>
                                    {m && (
                                        <Stack
                                            alignItems="center"
                                            direction="row"
                                            spacing={1}
                                            sx={{ pl: 2.5 }}
                                        >
                                            <Chip size="sm" variant="outlined">
                                                {linkedSprintName}
                                            </Chip>
                                            <Typography level="body-xs" sx={{ opacity: 0.7 }}>
                                                {closed}/{total}
                                                {t.tasks.picker.tasksSuffix}
                                            </Typography>
                                            <Box sx={{ flex: 1, minWidth: 60 }}>
                                                <LinearProgress
                                                    color={pct === 100 ? "success" : "primary"}
                                                    size="sm"
                                                    value={pct}
                                                    sx={{
                                                        "--LinearProgress-thickness": "4px",
                                                    }}
                                                    determinate
                                                />
                                            </Box>
                                            {m.assignees && m.assignees.length > 0 && (
                                                <AvatarGroup size="sm">
                                                    {m.assignees.slice(0, 3).map((a) => (
                                                        <BaseAvatar
                                                            key={String(a.userId)}
                                                            name={a.username}
                                                            size="xs"
                                                        />
                                                    ))}
                                                </AvatarGroup>
                                            )}
                                        </Stack>
                                    )}
                                </Stack>
                            </li>
                        );
                    }}
                    disableClearable
                    onChange={(_, v) => {
                        // The sprint follows the milestone, so it goes up with
                        // the pick in a SINGLE callback (see `onChangeMilestone`
                        // above for why two callbacks corrupted the state).
                        onChangeMilestone(
                            v?.id ?? null,
                            v?.milestone?.taskId ?? null,
                            v?.milestone?.sprintId ?? null
                        );
                    }}
                />
            )}
        </Stack>
    );
};

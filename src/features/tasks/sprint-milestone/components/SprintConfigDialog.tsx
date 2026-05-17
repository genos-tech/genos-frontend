import { useEffect, useMemo, useState } from "react";
import {
    Box,
    Button,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    FormHelperText,
    FormLabel,
    Input,
    Link,
    Modal,
    ModalDialog,
    Option,
    Select,
    Sheet,
    Stack,
    Switch,
    Typography,
} from "@mui/joy";

import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { Sprint } from "../types";

type Props = {
    open: boolean;
    onClose: () => void;
    projectId: number;
    useSM: SprintMilestoneManagementState;
};

const DURATION_PRESETS = [
    { label: "1 week", value: 7 },
    { label: "2 weeks", value: 14 },
    { label: "3 weeks", value: 21 },
    { label: "4 weeks", value: 28 },
];

const WEEKDAYS = [
    { label: "Sunday", value: 0 },
    { label: "Monday", value: 1 },
    { label: "Tuesday", value: 2 },
    { label: "Wednesday", value: 3 },
    { label: "Thursday", value: 4 },
    { label: "Friday", value: 5 },
    { label: "Saturday", value: 6 },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

const weekdayOf = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

const nextOnOrAfter = (fromIso: string, dow: number) => {
    const d = new Date(`${fromIso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + ((dow - d.getUTCDay() + 7) % 7));
    return d.toISOString().slice(0, 10);
};

const addDaysIso = (iso: string, days: number) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
};

type RealignmentPlanItem = {
    sprintId: number;
    name: string;
    oldStart: string;
    oldEnd: string;
    newStart: string;
    newEnd: string;
};

const computeRealignmentPlan = (
    allSprints: Sprint[],
    anchorDate: string,
    durationDays: number,
    today: string
): RealignmentPlanItem[] => {
    const lowerBound = allSprints
        .filter((s) => s.startDate <= today)
        .reduce((max, s) => (s.endDate > max ? s.endDate : max), today);
    const futures = allSprints
        .filter((s) => s.startDate > today)
        .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    if (futures.length === 0) return [];
    let firstSlot = anchorDate;
    while (firstSlot <= lowerBound) firstSlot = addDaysIso(firstSlot, durationDays);
    return futures.map((s, i) => ({
        sprintId: s.sprintId,
        name: s.name,
        oldStart: s.startDate,
        oldEnd: s.endDate,
        newStart: addDaysIso(firstSlot, i * durationDays),
        newEnd: addDaysIso(firstSlot, i * durationDays + durationDays - 1),
    }));
};

export const SprintConfigDialog = ({ open, onClose, projectId, useSM }: Props) => {
    const [durationDays, setDurationDays] = useState<number>(14);
    const [anchorDate, setAnchorDate] = useState<string>(todayIso());
    const [autoRoll, setAutoRoll] = useState<boolean>(true);
    const [upcomingHorizon, setUpcomingHorizon] = useState<number>(6);
    const [showDateOverride, setShowDateOverride] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Hydrate the form from the existing config when the dialog opens.
    useEffect(() => {
        if (!open) return;
        const cfg = useSM.sprintConfig;
        if (cfg) {
            setDurationDays(cfg.durationDays);
            setAnchorDate(cfg.anchorDate);
            setAutoRoll(cfg.autoRoll);
            setUpcomingHorizon(cfg.upcomingHorizon);
        } else {
            setDurationDays(14);
            setAnchorDate(todayIso());
            setAutoRoll(true);
            setUpcomingHorizon(6);
        }
        setShowDateOverride(false);
        setError(null);
    }, [open, useSM.sprintConfig]);

    const isPreset = useMemo(
        () => DURATION_PRESETS.some((p) => p.value === durationDays),
        [durationDays]
    );

    const selectedWeekday = useMemo(() => weekdayOf(anchorDate), [anchorDate]);

    const realignmentPlan = useMemo(() => {
        const cfg = useSM.sprintConfig;
        if (!cfg) return [];
        if (cfg.anchorDate === anchorDate && cfg.durationDays === durationDays) return [];
        return computeRealignmentPlan(
            useSM.projectSprints[projectId] ?? [],
            anchorDate,
            durationDays,
            todayIso()
        ).filter((p) => p.oldStart !== p.newStart || p.oldEnd !== p.newEnd);
    }, [useSM.sprintConfig, useSM.projectSprints, projectId, anchorDate, durationDays]);

    const willRealign = realignmentPlan.length > 0;

    const handleSave = async () => {
        setError(null);
        if (!projectId || durationDays <= 0 || !anchorDate) {
            setError("Duration and start date are required.");
            return;
        }
        setIsSaving(true);
        try {
            // Realign BEFORE saveConfig: the backend's POST /sprint/config/
            // immediately auto-creates new sprints in every new-anchor slot, so
            // any PATCH after that would collide with those fresh rows.
            const cfg = useSM.sprintConfig;
            const anchorChanged =
                !cfg || cfg.anchorDate !== anchorDate || cfg.durationDays !== durationDays;

            let realignFailed: string[] = [];

            if (anchorChanged) {
                // Recompute from current form values (don't rely on the memoized
                // plan in case the closure is stale).
                const plan = computeRealignmentPlan(
                    useSM.projectSprints[projectId] ?? [],
                    anchorDate,
                    durationDays,
                    todayIso()
                );

                if (plan.length > 0) {
                    const shiftingForward = plan[0].newStart > plan[0].oldStart;
                    const order = shiftingForward ? [...plan.keys()].reverse() : [...plan.keys()];

                    const pending = new Set<number>();
                    for (const i of order) {
                        const p = plan[i];
                        if (p.oldStart === p.newStart && p.oldEnd === p.newEnd) continue;
                        const ok = await useSM.updateExistingSprint({
                            sprintId: p.sprintId,
                            startDate: p.newStart,
                            endDate: p.newEnd,
                        });
                        if (!ok) pending.add(i);
                    }

                    if (pending.size) {
                        const retryOrder = shiftingForward
                            ? [...pending].sort((a, b) => a - b)
                            : [...pending].sort((a, b) => b - a);
                        for (const i of retryOrder) {
                            const p = plan[i];
                            const ok = await useSM.updateExistingSprint({
                                sprintId: p.sprintId,
                                startDate: p.newStart,
                                endDate: p.newEnd,
                            });
                            if (ok) pending.delete(i);
                        }
                    }

                    if (pending.size) {
                        realignFailed = [...pending].map((i) => plan[i].name);
                    }
                }
            }

            const saved = await useSM.saveConfig({
                projectId,
                durationDays,
                anchorDate,
                autoRoll,
                upcomingHorizon,
            });
            if (!saved) {
                setError("Failed to save sprint config.");
                return;
            }

            await useSM.loadSprintsForProject(projectId);

            if (realignFailed.length) {
                setError(
                    `Saved, but ${realignFailed.length} sprint(s) could not be realigned (likely overlap with the current sprint): ${realignFailed.join(", ")}`
                );
                return;
            }

            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal open={open} onClose={onClose}>
            <ModalDialog sx={{ minWidth: 460, maxHeight: "85vh" }}>
                <DialogTitle>Sprint settings</DialogTitle>
                <Divider />
                <DialogContent sx={{ overflowY: "auto" }}>
                    <Stack spacing={2.5} sx={{ pt: 1 }}>
                        <Typography level="body-sm">
                            Configure the sprint cadence for this project. Auto-rolled sprints are
                            generated forward from the start date.
                        </Typography>

                        <FormControl>
                            <FormLabel>Sprint length</FormLabel>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Select
                                    size="sm"
                                    value={isPreset ? String(durationDays) : "custom"}
                                    onChange={(_, v) => {
                                        if (v == null || v === "custom") return;
                                        const n = parseInt(v, 10);
                                        if (!Number.isNaN(n) && n > 0) setDurationDays(n);
                                    }}
                                    sx={{ minWidth: 140 }}
                                >
                                    {DURATION_PRESETS.map((p) => (
                                        <Option key={p.value} value={String(p.value)}>
                                            {p.label}
                                        </Option>
                                    ))}
                                    <Option value="custom">Custom…</Option>
                                </Select>
                                <Input
                                    type="number"
                                    size="sm"
                                    value={durationDays}
                                    onChange={(e) => {
                                        const n = parseInt(e.target.value, 10);
                                        if (!Number.isNaN(n) && n > 0) setDurationDays(n);
                                    }}
                                    endDecorator={<Typography level="body-xs">days</Typography>}
                                    sx={{ width: 140 }}
                                />
                            </Stack>
                        </FormControl>

                        <FormControl>
                            <FormLabel>Sprint starts on</FormLabel>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                                <Select
                                    size="sm"
                                    value={String(selectedWeekday)}
                                    onChange={(_, v) => {
                                        if (v == null) return;
                                        setAnchorDate(nextOnOrAfter(todayIso(), parseInt(v, 10)));
                                        setShowDateOverride(false);
                                    }}
                                    sx={{ minWidth: 160 }}
                                >
                                    {WEEKDAYS.map((w) => (
                                        <Option key={w.value} value={String(w.value)}>
                                            {w.label}
                                        </Option>
                                    ))}
                                </Select>
                                <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                                    Starts on {anchorDate}
                                </Typography>
                            </Stack>
                            {showDateOverride ? (
                                <Input
                                    type="date"
                                    size="sm"
                                    value={anchorDate}
                                    onChange={(e) => setAnchorDate(e.target.value)}
                                    sx={{ mt: 1, width: 200 }}
                                />
                            ) : (
                                <Link
                                    level="body-xs"
                                    component="button"
                                    type="button"
                                    onClick={() => setShowDateOverride(true)}
                                    sx={{ mt: 0.5, alignSelf: "flex-start" }}
                                >
                                    Pick a specific date →
                                </Link>
                            )}
                            <FormHelperText>
                                Future sprints are generated forward from this date.
                                {durationDays % 7 !== 0 &&
                                    " Sprint length isn't a multiple of 7, so later sprints won't keep this weekday."}
                            </FormHelperText>
                        </FormControl>

                        <FormControl>
                            <FormLabel>Auto-roll sprints</FormLabel>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                                <Switch
                                    checked={autoRoll}
                                    onChange={(e) => setAutoRoll(e.target.checked)}
                                />
                                <Typography level="body-sm">
                                    {autoRoll
                                        ? "Generate upcoming sprints automatically"
                                        : "Disabled — sprints must be created manually"}
                                </Typography>
                            </Stack>
                        </FormControl>

                        <FormControl>
                            <FormLabel>Upcoming sprints to keep</FormLabel>
                            <Input
                                type="number"
                                size="sm"
                                value={upcomingHorizon}
                                onChange={(e) => {
                                    const n = parseInt(e.target.value, 10);
                                    if (!Number.isNaN(n) && n > 0) setUpcomingHorizon(n);
                                }}
                                sx={{ width: 140 }}
                            />
                            <FormHelperText>
                                How many future sprints to pre-generate at any time.
                            </FormHelperText>
                        </FormControl>

                        {realignmentPlan.length > 0 && (
                            <Sheet
                                variant="soft"
                                color="warning"
                                sx={{ p: 1.5, borderRadius: 8 }}
                            >
                                <Typography level="title-sm" sx={{ color: "inherit", mb: 1 }}>
                                    These {realignmentPlan.length} sprint
                                    {realignmentPlan.length === 1 ? "" : "s"} will be updated on
                                    save
                                </Typography>
                                <Stack spacing={0.5}>
                                    {realignmentPlan.map((p) => (
                                        <Stack
                                            key={p.sprintId}
                                            direction="row"
                                            spacing={1}
                                            alignItems="center"
                                            sx={{ flexWrap: "wrap" }}
                                        >
                                            <Typography
                                                level="body-xs"
                                                sx={{
                                                    minWidth: 110,
                                                    fontWeight: 600,
                                                    color: "inherit",
                                                }}
                                            >
                                                {p.name}
                                            </Typography>
                                            <Typography
                                                level="body-xs"
                                                sx={{ color: "inherit", opacity: 0.65 }}
                                            >
                                                {p.oldStart} → {p.oldEnd}
                                            </Typography>
                                            <Typography
                                                level="body-xs"
                                                sx={{ color: "inherit", opacity: 0.5 }}
                                            >
                                                ⇒
                                            </Typography>
                                            <Typography
                                                level="body-xs"
                                                sx={{ fontWeight: 700, color: "inherit" }}
                                            >
                                                {p.newStart} → {p.newEnd}
                                            </Typography>
                                        </Stack>
                                    ))}
                                </Stack>
                            </Sheet>
                        )}

                        {error && (
                            <Box
                                sx={{
                                    p: 1,
                                    borderRadius: 8,
                                    bgcolor: "danger.softBg",
                                    color: "danger.softColor",
                                }}
                            >
                                <Typography level="body-sm" color="danger">
                                    {error}
                                </Typography>
                            </Box>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    {willRealign && (
                        <Typography
                            level="body-xs"
                            sx={{ color: "warning.plainColor", mr: "auto" }}
                        >
                            Will re-date {realignmentPlan.length} future sprint
                            {realignmentPlan.length === 1 ? "" : "s"}.
                        </Typography>
                    )}
                    <Button variant="plain" color="neutral" onClick={onClose} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} loading={isSaving}>
                        Save
                    </Button>
                </DialogActions>
            </ModalDialog>
        </Modal>
    );
};

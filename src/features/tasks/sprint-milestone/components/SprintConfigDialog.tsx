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
    Stack,
    Switch,
    Typography,
} from "@mui/joy";

import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";

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

    const futuresCount = useMemo(() => {
        const today = todayIso();
        return (useSM.projectSprints[projectId] ?? []).filter((s) => s.startDate > today).length;
    }, [useSM.projectSprints, projectId]);

    const willRealign = useMemo(() => {
        if (futuresCount === 0) return false;
        const cfg = useSM.sprintConfig;
        if (!cfg) return false;
        return cfg.anchorDate !== anchorDate || cfg.durationDays !== durationDays;
    }, [futuresCount, useSM.sprintConfig, anchorDate, durationDays]);

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
                const today = todayIso();
                const allSprints = useSM.projectSprints[projectId] ?? [];
                // First realigned slot must clear today AND the current sprint's end —
                // otherwise Sprint 2's new PATCH overlaps the in-progress Sprint 1 and
                // the rest cascade-fail behind it.
                const lowerBound = allSprints
                    .filter((s) => s.startDate <= today)
                    .reduce((max, s) => (s.endDate > max ? s.endDate : max), today);
                const futures = allSprints
                    .filter((s) => s.startDate > today)
                    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

                if (futures.length > 0) {
                    let firstSlot = anchorDate;
                    while (firstSlot <= lowerBound)
                        firstSlot = addDaysIso(firstSlot, durationDays);

                    const slots = futures.map((_, i) => ({
                        start: addDaysIso(firstSlot, i * durationDays),
                        end: addDaysIso(firstSlot, i * durationDays + durationDays - 1),
                    }));

                    const shiftingForward = slots[0].start > futures[0].startDate;
                    const order = shiftingForward
                        ? [...futures.keys()].reverse()
                        : [...futures.keys()];

                    const pending = new Set<number>();
                    for (const i of order) {
                        const s = futures[i];
                        if (s.startDate === slots[i].start && s.endDate === slots[i].end) continue;
                        const ok = await useSM.updateExistingSprint({
                            sprintId: s.sprintId,
                            startDate: slots[i].start,
                            endDate: slots[i].end,
                        });
                        if (!ok) pending.add(i);
                    }

                    if (pending.size) {
                        const retryOrder = shiftingForward
                            ? [...pending].sort((a, b) => a - b)
                            : [...pending].sort((a, b) => b - a);
                        for (const i of retryOrder) {
                            const s = futures[i];
                            const ok = await useSM.updateExistingSprint({
                                sprintId: s.sprintId,
                                startDate: slots[i].start,
                                endDate: slots[i].end,
                            });
                            if (ok) pending.delete(i);
                        }
                    }

                    if (pending.size) {
                        realignFailed = [...pending].map((i) => futures[i].name);
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
            <ModalDialog sx={{ minWidth: 460 }}>
                <DialogTitle>Sprint settings</DialogTitle>
                <Divider />
                <DialogContent>
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
                        <Typography level="body-xs" sx={{ color: "warning.400", mr: "auto" }}>
                            Will re-date {futuresCount} future sprint
                            {futuresCount === 1 ? "" : "s"}.
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

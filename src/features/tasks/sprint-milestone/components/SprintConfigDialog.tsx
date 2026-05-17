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

const weekdayOf = (iso: string) => new Date(`${iso}T00:00:00`).getDay();

const nextOnOrAfter = (fromIso: string, dow: number) => {
    const d = new Date(`${fromIso}T00:00:00`);
    d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7));
    return d.toISOString().slice(0, 10);
};

const addDaysIso = (iso: string, days: number) => {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
};

export const SprintConfigDialog = ({ open, onClose, projectId, useSM }: Props) => {
    const [durationDays, setDurationDays] = useState<number>(14);
    const [anchorDate, setAnchorDate] = useState<string>(todayIso());
    const [autoRoll, setAutoRoll] = useState<boolean>(true);
    const [upcomingHorizon, setUpcomingHorizon] = useState<number>(6);
    const [realign, setRealign] = useState<boolean>(false);
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
        setRealign(false);
        setError(null);
    }, [open, useSM.sprintConfig]);

    const isPreset = useMemo(
        () => DURATION_PRESETS.some((p) => p.value === durationDays),
        [durationDays]
    );

    const selectedWeekday = useMemo(() => weekdayOf(anchorDate), [anchorDate]);

    const handleSave = async () => {
        setError(null);
        if (!projectId || durationDays <= 0 || !anchorDate) {
            setError("Duration and start date are required.");
            return;
        }
        setIsSaving(true);
        try {
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

            if (realign) {
                const today = todayIso();
                const futures = (useSM.projectSprints[projectId] ?? [])
                    .filter((s) => s.startDate > today)
                    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

                let cursor = anchorDate;
                while (cursor <= today) cursor = addDaysIso(cursor, durationDays);

                const failed: string[] = [];
                for (const s of futures) {
                    const newStart = cursor;
                    const newEnd = addDaysIso(cursor, durationDays - 1);
                    const res = await useSM.updateExistingSprint({
                        sprintId: s.sprintId,
                        startDate: newStart,
                        endDate: newEnd,
                    });
                    if (!res) failed.push(s.name);
                    cursor = addDaysIso(cursor, durationDays);
                }

                if (failed.length) {
                    await useSM.loadSprintsForProject(projectId);
                    setError(
                        `Realigned, but ${failed.length} sprint(s) failed (likely overlap): ${failed.join(", ")}`
                    );
                    return;
                }
            }

            await useSM.loadSprintsForProject(projectId);
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
                            <FormLabel>Start day of week (optional)</FormLabel>
                            <Select
                                size="sm"
                                value={String(selectedWeekday)}
                                onChange={(_, v) => {
                                    if (v == null) return;
                                    setAnchorDate(nextOnOrAfter(todayIso(), parseInt(v, 10)));
                                }}
                                sx={{ minWidth: 160 }}
                            >
                                {WEEKDAYS.map((w) => (
                                    <Option key={w.value} value={String(w.value)}>
                                        {w.label}
                                    </Option>
                                ))}
                            </Select>
                            <FormHelperText>
                                Snaps the anchor date to the next {WEEKDAYS[selectedWeekday].label}
                                .
                                {durationDays % 7 !== 0 &&
                                    " Note: sprint length isn't a multiple of 7, so later sprints won't keep this weekday."}
                            </FormHelperText>
                        </FormControl>

                        <FormControl>
                            <FormLabel>Sprint start (anchor date)</FormLabel>
                            <Input
                                type="date"
                                size="sm"
                                value={anchorDate}
                                onChange={(e) => setAnchorDate(e.target.value)}
                            />
                            <FormHelperText>
                                All future sprints are generated from this date forward.
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
                            <FormLabel>Realign existing future sprints</FormLabel>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                                <Switch
                                    checked={realign}
                                    onChange={(e) => setRealign(e.target.checked)}
                                />
                                <Typography level="body-sm">
                                    {realign
                                        ? "Upcoming sprints will be re-dated to match the new anchor"
                                        : "Existing future sprints keep their current dates"}
                                </Typography>
                            </Stack>
                            <FormHelperText>
                                Only sprints that haven't started yet. Past and current sprints are
                                never modified.
                            </FormHelperText>
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

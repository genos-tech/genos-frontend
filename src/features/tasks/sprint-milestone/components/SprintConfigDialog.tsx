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
import { fmt, useTranslation } from "../../../../i18n";
import { Sprint } from "../types";

type Props = {
    open: boolean;
    onClose: () => void;
    projectId: number;
    useSM: SprintMilestoneManagementState;
};

const DURATION_PRESETS = [
    { labelKey: "oneWeek" as const, value: 7 },
    { labelKey: "twoWeeks" as const, value: 14 },
    { labelKey: "threeWeeks" as const, value: 21 },
    { labelKey: "fourWeeks" as const, value: 28 },
];

const WEEKDAYS = [
    { labelKey: "sunday" as const, value: 0 },
    { labelKey: "monday" as const, value: 1 },
    { labelKey: "tuesday" as const, value: 2 },
    { labelKey: "wednesday" as const, value: 3 },
    { labelKey: "thursday" as const, value: 4 },
    { labelKey: "friday" as const, value: 5 },
    { labelKey: "saturday" as const, value: 6 },
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
    const { t } = useTranslation();
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
            setError(t.tasks.sprint.durationRequired);
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
                setError(t.tasks.sprint.saveConfigFailed);
                return;
            }

            await useSM.loadSprintsForProject(projectId);

            if (realignFailed.length) {
                setError(
                    fmt(t.tasks.sprint.realignPartialFailure, {
                        count: realignFailed.length,
                        names: realignFailed.join(", "),
                    })
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
            <ModalDialog
                sx={{
                    width: { xs: "calc(100vw - 24px)", md: "auto" },
                    minWidth: { xs: 0, md: 460 },
                    maxWidth: { xs: "100vw", md: 700 },
                    maxHeight: { xs: "calc(100dvh - 32px)", md: "85vh" },
                    overflow: "auto",
                }}
            >
                <DialogTitle>{t.tasks.sprint.configDialogTitle}</DialogTitle>
                <Divider />
                <DialogContent sx={{ overflowY: "auto" }}>
                    <Stack spacing={2.5} sx={{ pt: 1 }}>
                        <Typography level="body-sm">{t.tasks.sprint.configIntro}</Typography>

                        <FormControl>
                            <FormLabel>{t.tasks.sprint.sprintLength}</FormLabel>
                            <Stack alignItems="center" direction="row" spacing={1}>
                                <Select
                                    size="sm"
                                    sx={{ minWidth: 140 }}
                                    value={isPreset ? String(durationDays) : "custom"}
                                    onChange={(_, v) => {
                                        if (v == null || v === "custom") return;
                                        const n = parseInt(v, 10);
                                        if (!Number.isNaN(n) && n > 0) setDurationDays(n);
                                    }}
                                >
                                    {DURATION_PRESETS.map((p) => (
                                        <Option key={p.value} value={String(p.value)}>
                                            {t.tasks.sprint.durations[p.labelKey]}
                                        </Option>
                                    ))}
                                    <Option value="custom">{t.tasks.sprint.customOption}</Option>
                                </Select>
                                <Input
                                    size="sm"
                                    sx={{ width: 140 }}
                                    type="number"
                                    value={durationDays}
                                    endDecorator={
                                        <Typography level="body-xs">
                                            {t.tasks.sprint.days}
                                        </Typography>
                                    }
                                    onChange={(e) => {
                                        const n = parseInt(e.target.value, 10);
                                        if (!Number.isNaN(n) && n > 0) setDurationDays(n);
                                    }}
                                />
                            </Stack>
                        </FormControl>

                        <FormControl>
                            <FormLabel>{t.tasks.sprint.sprintStartsOn}</FormLabel>
                            <Stack alignItems="center" direction="row" spacing={1.5}>
                                <Select
                                    size="sm"
                                    sx={{ minWidth: 160 }}
                                    value={String(selectedWeekday)}
                                    onChange={(_, v) => {
                                        if (v == null) return;
                                        setAnchorDate(nextOnOrAfter(todayIso(), parseInt(v, 10)));
                                        setShowDateOverride(false);
                                    }}
                                >
                                    {WEEKDAYS.map((w) => (
                                        <Option key={w.value} value={String(w.value)}>
                                            {t.tasks.sprint.weekdays[w.labelKey]}
                                        </Option>
                                    ))}
                                </Select>
                                <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                                    {t.tasks.sprint.startsOnLabel}
                                    {anchorDate}
                                </Typography>
                            </Stack>
                            {showDateOverride ? (
                                <Input
                                    size="sm"
                                    sx={{ mt: 1, width: 200 }}
                                    type="date"
                                    value={anchorDate}
                                    onChange={(e) => setAnchorDate(e.target.value)}
                                />
                            ) : (
                                <Link
                                    component="button"
                                    level="body-xs"
                                    sx={{ mt: 0.5, alignSelf: "flex-start" }}
                                    type="button"
                                    onClick={() => setShowDateOverride(true)}
                                >
                                    {t.tasks.sprint.pickSpecificDate}
                                </Link>
                            )}
                            <FormHelperText>
                                {t.tasks.sprint.futureGeneratedHelper}
                                {durationDays % 7 !== 0 && t.tasks.sprint.weekdayWarning}
                            </FormHelperText>
                        </FormControl>

                        <FormControl>
                            <FormLabel>{t.tasks.sprint.autoRollSprints}</FormLabel>
                            <Stack alignItems="center" direction="row" spacing={1.5}>
                                <Switch
                                    checked={autoRoll}
                                    onChange={(e) => setAutoRoll(e.target.checked)}
                                />
                                <Typography level="body-sm">
                                    {autoRoll
                                        ? t.tasks.sprint.autoRollEnabled
                                        : t.tasks.sprint.autoRollDisabled}
                                </Typography>
                            </Stack>
                        </FormControl>

                        <FormControl>
                            <FormLabel>{t.tasks.sprint.upcomingSprintsToKeep}</FormLabel>
                            <Input
                                size="sm"
                                sx={{ width: 140 }}
                                type="number"
                                value={upcomingHorizon}
                                onChange={(e) => {
                                    const n = parseInt(e.target.value, 10);
                                    if (!Number.isNaN(n) && n > 0) setUpcomingHorizon(n);
                                }}
                            />
                            <FormHelperText>{t.tasks.sprint.upcomingHelper}</FormHelperText>
                        </FormControl>

                        {realignmentPlan.length > 0 && (
                            <Sheet color="warning" sx={{ p: 1.5, borderRadius: 8 }} variant="soft">
                                <Typography level="title-sm" sx={{ color: "inherit", mb: 1 }}>
                                    {fmt(t.tasks.sprint.realignWarningTitle, {
                                        count: realignmentPlan.length,
                                        plural: realignmentPlan.length === 1 ? "" : "s",
                                    })}
                                </Typography>
                                <Stack spacing={0.5}>
                                    {realignmentPlan.map((p) => (
                                        <Stack
                                            key={p.sprintId}
                                            alignItems="center"
                                            direction="row"
                                            spacing={1}
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
                                <Typography color="danger" level="body-sm">
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
                            {fmt(t.tasks.sprint.willRealign, {
                                count: realignmentPlan.length,
                                plural: realignmentPlan.length === 1 ? "" : "s",
                            })}
                        </Typography>
                    )}
                    <Button color="neutral" disabled={isSaving} variant="plain" onClick={onClose}>
                        {t.tasks.sprint.cancelButton}
                    </Button>
                    <Button loading={isSaving} onClick={handleSave}>
                        {t.tasks.sprint.saveButton}
                    </Button>
                </DialogActions>
            </ModalDialog>
        </Modal>
    );
};

import { useEffect, useState } from "react";
import NotificationsPausedRoundedIcon from "@mui/icons-material/NotificationsPausedRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import {
    Box,
    Button,
    Divider,
    Dropdown,
    Input,
    ListDivider,
    Menu,
    MenuButton,
    MenuItem,
    Modal,
    ModalClose,
    ModalDialog,
    Stack,
    Switch,
    Typography,
} from "@mui/joy";

import { NotificationPauseState } from "../../hooks/common/useNotificationPause";
import { fmt, useTranslation } from "../../i18n";
import { Messages } from "../../i18n/types";
// The one-shot-instant formatter and the datetime-local (de)serialiser are
// shared with the custom-status expiry feature, which formats the same kind of
// absolute instant. Defined in `statusExpiry.ts`; imported here so the pause
// status line and the status expiry note read identically.
import { formatStatusExpiry, toLocalInputValue } from "./statusExpiry";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * The single-line "current pause state" summary, e.g. "Paused until 3:30 PM" /
 * "Scheduled 17:00–09:00" / "Not paused". Extracted so the settings section
 * AND the profile modal's self-only pause line (ModalUserProfile) read the same
 * wording from one place rather than each re-deriving the branch order.
 *
 * `p` is the `pause` i18n subtree; passing it in (rather than calling
 * `useTranslation` here) keeps this a pure function usable from any caller.
 */
export const formatPauseStatusText = (
    pause: Pick<NotificationPauseState, "isPausedNow" | "snoozeUntil" | "snoozeSchedule">,
    p: Messages["services"]["notifications"]["pause"]
): string => {
    const { isPausedNow, snoozeUntil, snoozeSchedule } = pause;
    const untilActive = !!snoozeUntil && Date.parse(snoozeUntil) > Date.now();
    const scheduleEnabled = snoozeSchedule?.enabled === true;
    if (untilActive) {
        return fmt(p.statusPausedUntil, { time: formatStatusExpiry(snoozeUntil as string) });
    }
    if (scheduleEnabled && isPausedNow) {
        return fmt(p.statusPausedSchedule, {
            start: snoozeSchedule!.start,
            end: snoozeSchedule!.end,
        });
    }
    if (scheduleEnabled) {
        return fmt(p.statusScheduledOnly, {
            start: snoozeSchedule!.start,
            end: snoozeSchedule!.end,
        });
    }
    return p.statusNotPaused;
};

// Defaults offered the first time someone enables the daily schedule — a
// classic "evening to morning" overnight window, so the overnight branch is
// exercised out of the box and the example in the copy matches what's shown.
const DEFAULT_SCHEDULE_START = "17:00";
const DEFAULT_SCHEDULE_END = "09:00";

type PresetItemsProps = Pick<
    NotificationPauseState,
    "isPausedNow" | "pauseFor" | "pauseUntilTomorrow" | "pauseUntilNextWeek" | "resume"
> & {
    /** When set, render a "Pick a date & time…" row calling this. The caller
     *  owns the modal so it survives the menu closing (a modal mounted inside
     *  the menu subtree would unmount with it on click). Omit to hide custom. */
    onCustom?: () => void;
};

/**
 * The shared list of pause-duration `<MenuItem>` rows. Drops into any Joy
 * `<Menu>` — the settings section's own dropdown AND the profile-status
 * presence menu — so the presets read identically in both places. Renders a
 * Resume row (only) while paused.
 */
export const NotificationPausePresetItems = ({
    isPausedNow,
    pauseFor,
    pauseUntilTomorrow,
    pauseUntilNextWeek,
    resume,
    onCustom,
}: PresetItemsProps) => {
    const { t } = useTranslation();
    const p = t.services.notifications.pause;
    return (
        <>
            <MenuItem onClick={() => pauseFor(30 * MINUTE)}>{p.for30m}</MenuItem>
            <MenuItem onClick={() => pauseFor(HOUR)}>{p.for1h}</MenuItem>
            <MenuItem onClick={() => pauseFor(2 * HOUR)}>{p.for2h}</MenuItem>
            <MenuItem onClick={pauseUntilTomorrow}>{p.untilTomorrow}</MenuItem>
            <MenuItem onClick={pauseUntilNextWeek}>{p.untilNextWeek}</MenuItem>
            {onCustom && <MenuItem onClick={onCustom}>{p.custom}</MenuItem>}
            {isPausedNow && (
                <>
                    <ListDivider />
                    <MenuItem color="danger" onClick={resume}>
                        <PlayArrowRoundedIcon />
                        {p.resumeShort}
                    </MenuItem>
                </>
            )}
        </>
    );
};

type SectionProps = {
    /** The pause slice of the notifications state (the full `NotificationsState`
     *  satisfies this, so callers pass their context straight in). */
    pause: NotificationPauseState;
};

/**
 * The full "Pause notifications" settings section: current status, a duration
 * dropdown (with a custom date/time picker), a quick Resume, and the recurring
 * daily-schedule editor. Rendered inside `NotificationSettingsPanel`; the
 * profile-status dropdown uses `NotificationPausePresetItems` directly instead.
 */
export const NotificationPauseSection = ({ pause }: SectionProps) => {
    const { t } = useTranslation();
    const p = t.services.notifications.pause;

    const {
        isPausedNow,
        snoozeUntil,
        snoozeSchedule,
        pauseFor,
        pauseUntilTomorrow,
        pauseUntilNextWeek,
        pauseUntil,
        resume,
        setSchedule,
    } = pause;

    // --- Custom date/time modal (owned here so it outlives the dropdown) ---
    const [customOpen, setCustomOpen] = useState(false);
    const [customValue, setCustomValue] = useState("");
    const openCustom = () => {
        // Seed one hour ahead so the picker opens on a sensible near-future
        // value rather than "now" (which would be in the past by the time
        // they hit Set).
        setCustomValue(toLocalInputValue(new Date(Date.now() + HOUR)));
        setCustomOpen(true);
    };
    const commitCustom = () => {
        if (!customValue) return;
        const parsed = new Date(customValue);
        if (!Number.isNaN(parsed.getTime())) pauseUntil(parsed.toISOString());
        setCustomOpen(false);
    };

    // --- Schedule editor: local draft, synced from the persisted value ------
    // Kept in local state so typing in the time inputs is smooth; committed on
    // every change (each is a debounced PUT upstream). Re-synced when the
    // server hydrate or another surface changes the stored schedule.
    const [schedEnabled, setSchedEnabled] = useState(snoozeSchedule?.enabled ?? false);
    const [schedStart, setSchedStart] = useState(snoozeSchedule?.start || DEFAULT_SCHEDULE_START);
    const [schedEnd, setSchedEnd] = useState(snoozeSchedule?.end || DEFAULT_SCHEDULE_END);
    useEffect(() => {
        setSchedEnabled(snoozeSchedule?.enabled ?? false);
        if (snoozeSchedule?.start) setSchedStart(snoozeSchedule.start);
        if (snoozeSchedule?.end) setSchedEnd(snoozeSchedule.end);
    }, [snoozeSchedule]);

    const commitSchedule = (next: { enabled: boolean; start: string; end: string }) => {
        setSchedEnabled(next.enabled);
        setSchedStart(next.start);
        setSchedEnd(next.end);
        setSchedule(next);
    };

    // --- Status line --------------------------------------------------------
    // The "Resume" button is only meaningful for a one-shot pause; the shared
    // helper owns the wording of the status text itself.
    const untilActive = !!snoozeUntil && Date.parse(snoozeUntil) > Date.now();
    const statusText = formatPauseStatusText({ isPausedNow, snoozeUntil, snoozeSchedule }, p);

    return (
        <Box>
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <NotificationsPausedRoundedIcon
                    sx={{ color: isPausedNow ? "warning.400" : undefined }}
                />
                <Typography level="title-md">{p.heading}</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1 }}>
                {p.description}
            </Typography>

            <Stack
                alignItems="center"
                direction="row"
                spacing={1}
                sx={{ mb: 1, flexWrap: "wrap" }}
            >
                <Typography
                    level="body-sm"
                    sx={{ fontWeight: 600, color: isPausedNow ? "warning.500" : undefined }}
                >
                    {statusText}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Dropdown>
                    <MenuButton
                        size="sm"
                        variant={isPausedNow ? "soft" : "outlined"}
                        color={isPausedNow ? "warning" : "neutral"}
                        startDecorator={<NotificationsPausedRoundedIcon />}
                    >
                        {p.durationMenuLabel}
                    </MenuButton>
                    <Menu sx={{ zIndex: 10010 }} placement="bottom-end">
                        <NotificationPausePresetItems
                            isPausedNow={isPausedNow}
                            pauseFor={pauseFor}
                            pauseUntilTomorrow={pauseUntilTomorrow}
                            pauseUntilNextWeek={pauseUntilNextWeek}
                            resume={resume}
                            onCustom={openCustom}
                        />
                    </Menu>
                </Dropdown>
                {untilActive && (
                    <Button
                        size="sm"
                        color="danger"
                        variant="plain"
                        startDecorator={<PlayArrowRoundedIcon />}
                        onClick={resume}
                    >
                        {p.resumeShort}
                    </Button>
                )}
            </Stack>

            {/* Recurring daily schedule */}
            <Divider sx={{ my: 1 }} />
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <ScheduleRoundedIcon fontSize="small" />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">{p.scheduleHeading}</Typography>
                </Box>
                <Switch
                    checked={schedEnabled}
                    onChange={(e) =>
                        commitSchedule({
                            enabled: e.target.checked,
                            start: schedStart,
                            end: schedEnd,
                        })
                    }
                />
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1 }}>
                {p.scheduleDescription}
            </Typography>
            <Stack
                alignItems="center"
                direction="row"
                spacing={1.5}
                sx={{ opacity: schedEnabled ? 1 : 0.5 }}
            >
                <Stack direction="row" alignItems="center" spacing={0.75}>
                    <Typography level="body-sm">{p.scheduleStart}</Typography>
                    <Input
                        type="time"
                        size="sm"
                        value={schedStart}
                        disabled={!schedEnabled}
                        onChange={(e) =>
                            commitSchedule({
                                enabled: schedEnabled,
                                start: e.target.value,
                                end: schedEnd,
                            })
                        }
                    />
                </Stack>
                <Stack direction="row" alignItems="center" spacing={0.75}>
                    <Typography level="body-sm">{p.scheduleEnd}</Typography>
                    <Input
                        type="time"
                        size="sm"
                        value={schedEnd}
                        disabled={!schedEnabled}
                        onChange={(e) =>
                            commitSchedule({
                                enabled: schedEnabled,
                                start: schedStart,
                                end: e.target.value,
                            })
                        }
                    />
                </Stack>
            </Stack>

            <Modal open={customOpen} onClose={() => setCustomOpen(false)}>
                <ModalDialog sx={{ zIndex: 10020 }}>
                    <ModalClose />
                    <Typography level="title-md">{p.customTitle}</Typography>
                    <Input
                        type="datetime-local"
                        value={customValue}
                        slotProps={{ input: { min: toLocalInputValue(new Date()) } }}
                        onChange={(e) => setCustomValue(e.target.value)}
                    />
                    <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1 }}>
                        <Button
                            color="neutral"
                            variant="plain"
                            onClick={() => setCustomOpen(false)}
                        >
                            {p.customCancel}
                        </Button>
                        <Button disabled={!customValue} onClick={commitCustom}>
                            {p.customSet}
                        </Button>
                    </Stack>
                </ModalDialog>
            </Modal>
        </Box>
    );
};

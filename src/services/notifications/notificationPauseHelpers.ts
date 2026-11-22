import { NotificationPauseState } from "../../hooks/common/useNotificationPause";
import { fmt, type Locale } from "../../i18n";
import { Messages } from "../../i18n/types";
import { formatStatusExpiry } from "./statusExpiry";

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
    p: Messages["services"]["notifications"]["pause"],
    locale: Locale
): string => {
    const { isPausedNow, snoozeUntil, snoozeSchedule } = pause;
    const untilActive = !!snoozeUntil && Date.parse(snoozeUntil) > Date.now();
    const scheduleEnabled = snoozeSchedule?.enabled === true;
    if (untilActive) {
        return fmt(p.statusPausedUntil, {
            time: formatStatusExpiry(snoozeUntil as string, locale),
        });
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

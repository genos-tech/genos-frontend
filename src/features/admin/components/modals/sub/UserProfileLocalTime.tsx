import { useEffect, useState } from "react";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import { Box, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { ProfileModalStyles } from "../../../../../components/ui/styles/commonStyle";
import { fmt, useTranslation } from "../../../../../i18n";
import { UserProps } from "../../../../../types/admin";
import {
    formatTimeInZone,
    hoursFromViewer,
    resolveDisplayZone,
} from "../../../../../utils/userTimezone";

// The clock only shows hours and minutes, so anything faster than this is
// re-rendering to produce identical output. Half a minute keeps the
// displayed time at most 30s stale, which is under the resolution of what
// it's being used for ("is it the middle of their night?").
const TICK_MS = 30_000;

type Props = {
    user?: UserProps;
};

/**
 * What time it is where this person is.
 *
 * The zone comes from `resolveDisplayZone` — the location they picked if
 * they picked one, otherwise the zone their browser reported. Nothing
 * renders when we know neither: there is no honest default for "where is
 * this person", and a card that quietly assumed UTC would state a guess
 * in the same voice as a fact.
 *
 * The offset beside the time is the point of the row. "15:04" is only
 * useful once you know it's four hours behind you, and the alternative —
 * making every reader do that subtraction — is the reason people send
 * meeting invites into other people's evenings.
 */
export const UserProfileLocalTime = ({ user }: Props) => {
    const { mode } = useColorScheme();
    const { t, locale } = useTranslation();
    const isDark = mode === "dark";
    const styles = isDark ? ProfileModalStyles.dark : ProfileModalStyles.light;

    const zoneId = user ? resolveDisplayZone(user) : null;
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        if (!zoneId) return;
        const id = setInterval(() => setNow(new Date()), TICK_MS);
        return () => clearInterval(id);
    }, [zoneId]);

    if (!zoneId) return null;

    const time = formatTimeInZone(zoneId, locale, now);
    // A zone name that outlived the tzdata that knew it. Say nothing
    // rather than show a time computed in the viewer's own zone and
    // labelled as someone else's.
    if (time === null) return null;

    const offset = hoursFromViewer(zoneId, now);
    const offsetLabel =
        offset === null
            ? null
            : offset === 0
              ? t.admin.userProfile.sameTimeAsYou
              : fmt(
                    offset > 0
                        ? t.admin.userProfile.hoursAheadOfYou
                        : t.admin.userProfile.hoursBehindYou,
                    { count: Math.abs(offset) }
                );

    return (
        <Box
            sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                px: 1.5,
                py: 0.5,
                borderRadius: "6px",
                background: isDark
                    ? "rgba(var(--gp-brand-700-rgb), 0.1)"
                    : "rgba(var(--gp-brand-700-rgb), 0.05)",
                border: `1px solid ${styles.border}`,
                width: "fit-content",
            }}
        >
            <ScheduleRoundedIcon sx={{ fontSize: 16, color: styles.accentColor }} />
            <Typography
                fontWeight={600}
                sx={{ userSelect: "text", color: styles.valueColor, fontSize: "13px" }}
            >
                {time}
            </Typography>
            {offsetLabel && (
                <Typography sx={{ color: styles.labelColor, fontSize: "12px" }}>
                    {offsetLabel}
                </Typography>
            )}
        </Box>
    );
};

import { useEffect, useMemo, useState } from "react";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import {
    Autocomplete,
    AutocompleteOption,
    Box,
    Chip,
    ListItemContent,
    Stack,
    Switch,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { ProfileModalStyles } from "../../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../../context/AuthContext";
import { fmt, useTranslation } from "../../../../../i18n";
import { UserProps } from "../../../../../types/admin";
import {
    listZoneOptions,
    resolveZone,
    zoneLabel,
    type ZoneOption,
} from "../../../../../utils/userTimezone";
import { updateUserProfile } from "../../../services/updateUserProfile";

type Props = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    user?: UserProps;
};

/**
 * The location row: detected by default, overridable by hand.
 *
 * Nobody should have to set this. The browser already knows the zone and
 * reports it on every boot (`useReportBrowserTimezone`), so the row
 * arrives filled in and correct for the overwhelming majority of people,
 * and the picker exists for the two cases detection can't cover: someone
 * whose machine is set to the wrong zone, and someone travelling who
 * wants their card to keep saying where they actually live.
 *
 * The unit is a zone, not a city — someone in Osaka shows as Tokyo. That
 * is the trade the whole field is built on and the correct one: what a
 * colleague needs before pinging you is "don't call me at 3am", which is
 * a question about zones. See `utils/userTimezone`.
 *
 * Replaces the old country picker, which asked for less (a country tells
 * you nothing about the time in Vancouver vs Toronto), answered wrong
 * (its `value` was pinned to a constant, so the field always displayed
 * Japan regardless of what was stored), and had to be filled in by hand.
 */
export const UserProfileLocation = ({ myself, setMyself, user }: Props) => {
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const styles = isDark ? ProfileModalStyles.dark : ProfileModalStyles.light;

    const isSelfView = myself.userId === user?.userId;
    const source = isSelfView ? myself : user;
    const resolved = source ? resolveZone(source, isSelfView) : null;
    const zoneId = resolved?.id ?? "";
    const isDetected = resolved?.source === "detected";

    const [editing, setEditing] = useState(false);
    const [listOpen, setListOpen] = useState(true);

    // ~450 entries, mapped and sorted. Cheap, but this component
    // re-renders on every parent state change and the modal has a lot of
    // them, so it isn't free either.
    const options = useMemo(() => listZoneOptions(), []);
    // Seeded with the detected zone as well as a picked one, so opening
    // the picker starts from what the row is currently showing rather
    // than from blank.
    const selected = useMemo(
        () => options.find((option) => option.id === zoneId) ?? null,
        [options, zoneId]
    );

    useEffect(() => {
        if (!editing) setListOpen(true);
    }, [editing]);

    // `""` is not "no location" but "stop overriding" — it clears the
    // manual column and lets the detected zone show through again.
    const persist = (nextZoneId: string) => {
        updateUserProfile({
            accessToken: accessToken,
            userId: myself.userId,
            currentLocation: nextZoneId,
        });
        setMyself({ ...myself, currentLocation: nextZoneId });
        localStorage.setItem("currentLocation", nextZoneId);
        setEditing(false);
    };

    // Absent means shared (server default), so only an explicit `false` is off.
    const isShared = myself.locationShared !== false;

    // Flip the opt-out. Persists to the server (which re-gates every roster
    // row for this user) and mirrors into localStorage so the toggle keeps
    // its state across a reload without a round-trip.
    const persistSharing = (nextShared: boolean) => {
        updateUserProfile({
            accessToken: accessToken,
            userId: myself.userId,
            locationShared: nextShared,
        });
        setMyself({ ...myself, locationShared: nextShared });
        localStorage.setItem("locationShared", nextShared ? "true" : "false");
    };

    if (editing) {
        return (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                <Autocomplete
                    getOptionLabel={(option: ZoneOption) => option.city}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    open={listOpen}
                    options={options}
                    placeholder={t.admin.userProfile.locationPlaceholder}
                    sx={{ width: { xs: "100%", sm: 300 } }}
                    value={selected}
                    renderOption={(optionProps, option) => {
                        // Joy passes `key` inside the spread props, which
                        // React 19 warns about; pull it out and set it
                        // explicitly. Same shape as the sibling pickers.
                        const { key, ...rest } = optionProps as typeof optionProps & {
                            key?: string;
                        };
                        return (
                            <AutocompleteOption key={key ?? option.id} {...rest}>
                                <ListItemContent sx={{ fontSize: "sm" }}>
                                    {option.city}
                                    <Typography level="body-xs">
                                        {option.region} · {option.id}
                                    </Typography>
                                </ListItemContent>
                            </AutocompleteOption>
                        );
                    }}
                    slotProps={{
                        input: { autoComplete: "new-password" },
                        listbox: { sx: { zIndex: 10001 } },
                    }}
                    autoHighlight
                    onClose={() => setListOpen(false)}
                    onOpen={() => setListOpen(true)}
                    onChange={(_event, value) => {
                        // `null` is the clear button, which means the same
                        // thing as the "use detected" chip below.
                        persist(value ? value.id : "");
                    }}
                />
                {/* Only worth offering once there's an override to undo;
                    otherwise it's a button that changes nothing. */}
                {!isDetected && (
                    <Chip
                        size="sm"
                        sx={{ borderRadius: "sm" }}
                        variant="outlined"
                        onClick={() => persist("")}
                    >
                        {t.admin.userProfile.locationUseDetected}
                    </Chip>
                )}
                <Chip
                    color="danger"
                    size="sm"
                    sx={{ borderRadius: "sm", fontWeight: "bold" }}
                    variant="outlined"
                    onClick={() => setEditing(false)}
                >
                    {t.common.profileEdit.cancel}
                </Chip>
            </Stack>
        );
    }

    // Nothing detected and nothing picked. On your own card that's the
    // prompt to pick; on someone else's there is simply nothing to say.
    if (!zoneId && !isSelfView) return null;

    const label = zoneId ? zoneLabel(zoneId) : t.admin.userProfile.locationNotSet;

    const locationBox = (
        <Box
            component={isSelfView ? "button" : "div"}
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
                cursor: isSelfView ? "pointer" : "default",
                "&:hover": isSelfView
                    ? {
                          background: isDark
                              ? "rgba(var(--gp-brand-700-rgb), 0.2)"
                              : "rgba(var(--gp-brand-700-rgb), 0.1)",
                      }
                    : undefined,
            }}
            title={
                isSelfView && isDetected && zoneId
                    ? fmt(t.admin.userProfile.locationDetectedHint, { zone: zoneId })
                    : undefined
            }
            onClick={isSelfView ? () => setEditing(true) : undefined}
        >
            <PlaceRoundedIcon sx={{ fontSize: 16, color: styles.accentColor }} />
            <Typography
                fontWeight={600}
                sx={{
                    userSelect: "text",
                    color: zoneId ? styles.valueColor : styles.labelColor,
                    fontSize: "13px",
                }}
            >
                {label}
            </Typography>
            {/* Only on your own card. A colleague doesn't need to know
                whether you typed your location or your laptop did — but
                you do, because it's the difference between a value that
                follows you when you travel and one that doesn't. */}
            {isSelfView && isDetected && zoneId && (
                <Typography sx={{ color: styles.labelColor, fontSize: "11px" }}>
                    {t.admin.userProfile.locationAuto}
                </Typography>
            )}
        </Box>
    );

    // Others just see the location row (or nothing). Only the owner gets the
    // share toggle — it governs what THEIR row discloses, so it has no meaning
    // on someone else's card, and the server wouldn't accept the write anyway.
    if (!isSelfView) return locationBox;

    return (
        <Stack spacing={0.75} sx={{ alignItems: "flex-start" }}>
            {locationBox}
            <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center" }}
                title={t.admin.userProfile.locationShareHint}
            >
                <Switch
                    checked={isShared}
                    size="sm"
                    onChange={(e) => persistSharing(e.target.checked)}
                />
                <Typography sx={{ color: styles.labelColor, fontSize: "12px" }}>
                    {isShared
                        ? t.admin.userProfile.locationShared
                        : t.admin.userProfile.locationHidden}
                </Typography>
            </Stack>
        </Stack>
    );
};

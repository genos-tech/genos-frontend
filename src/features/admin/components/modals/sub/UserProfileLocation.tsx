import { useEffect, useMemo, useState } from "react";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import {
    Autocomplete,
    AutocompleteOption,
    Box,
    Chip,
    ListItemContent,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { ProfileModalStyles } from "../../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../../context/AuthContext";
import { useTranslation } from "../../../../../i18n";
import { UserProps } from "../../../../../types/admin";
import { listZoneOptions, type ZoneOption } from "../../../../../utils/userTimezone";
import { updateUserProfile } from "../../../services/updateUserProfile";

type Props = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    user?: UserProps;
};

/**
 * The location row: a city picker whose options are the IANA zone
 * database, so picking a city is also how someone sets their timezone.
 *
 * Replaces the old country picker, which asked for less (a country tells
 * you nothing about the time in Vancouver vs Toronto) and answered wrong
 * (its `value` was pinned to a constant, so the field always displayed
 * Japan regardless of what was stored).
 *
 * The stored value is the zone id; the label is its city. See
 * `utils/userTimezone` for why the zone list is the city list.
 */
export const UserProfileLocation = ({ myself, setMyself, user }: Props) => {
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const styles = isDark ? ProfileModalStyles.dark : ProfileModalStyles.light;

    const isSelfView = myself.userId === user?.userId;
    const zoneId = (isSelfView ? myself.currentLocation : user?.currentLocation) ?? "";

    const [editing, setEditing] = useState(false);
    const [listOpen, setListOpen] = useState(true);

    // ~450 entries, mapped and sorted. Cheap, but this component
    // re-renders on every parent state change and the modal has a lot of
    // them, so it isn't free either.
    const options = useMemo(() => listZoneOptions(), []);
    const selected = useMemo(
        () => options.find((option) => option.id === zoneId) ?? null,
        [options, zoneId]
    );

    useEffect(() => {
        if (!editing) setListOpen(true);
    }, [editing]);

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
                        // `null` is the clear button — a legitimate way to
                        // say "I'd rather not", and the server accepts ""
                        // for it.
                        persist(value ? value.id : "");
                    }}
                />
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

    if (!zoneId && !isSelfView) return null;

    const label = selected
        ? selected.city
        : zoneId
          ? // A stored zone this runtime's tzdata no longer lists. Show
            // the raw id rather than "not set" — it's still the truest
            // thing we know about where they are.
            zoneId
          : t.admin.userProfile.locationNotSet;

    return (
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
        </Box>
    );
};

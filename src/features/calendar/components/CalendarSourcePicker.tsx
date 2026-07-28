import { useMemo } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import {
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    Divider,
    Sheet,
    Stack,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useTranslation } from "../../../i18n";
import { CalendarSummary, sourceKey } from "../../integrations/services/calendar";

interface CalendarSourcePickerProps {
    calendars: CalendarSummary[];
    selectedKeys: Set<string>;
    colorBySource: Record<string, string>;
    loading: boolean;
    /** Toggle one calendar. */
    onToggle: (key: string) => void;
    /** Tick / untick every calendar on one account at once. */
    onToggleAccount: (accountId: string, selected: boolean) => void;
    /** Start the OAuth connect flow to attach another Google account. */
    onAddAccount: () => void;
}

interface AccountGroup {
    accountId: string;
    accountEmail: string;
    calendars: CalendarSummary[];
}

/**
 * The calendar/account selector: a checkbox list grouped by Google
 * account, each row carrying its color swatch.
 *
 * Grouping by account (rather than one flat list) is what makes a
 * two-account setup legible — "everything under me@work.com" is the
 * distinction the user actually thinks in, and the account header
 * doubles as a one-click toggle for the whole group.
 *
 * Rendered as a persistent side rail rather than a dropdown: with
 * several calendars overlaid, the color legend IS the key to reading
 * the grid, so it has to stay visible while looking at events.
 */
export const CalendarSourcePicker = ({
    calendars,
    selectedKeys,
    colorBySource,
    loading,
    onToggle,
    onToggleAccount,
    onAddAccount,
}: CalendarSourcePickerProps) => {
    const { t } = useTranslation();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    // Group in the order the server returned (login-identity account
    // first) so the rail doesn't reshuffle between loads.
    const groups = useMemo<AccountGroup[]>(() => {
        const byAccount = new Map<string, AccountGroup>();
        for (const c of calendars) {
            let group = byAccount.get(c.account_id);
            if (!group) {
                group = {
                    accountId: c.account_id,
                    accountEmail: c.account_email || t.calendar.sources.unknownAccount,
                    calendars: [],
                };
                byAccount.set(c.account_id, group);
            }
            group.calendars.push(c);
        }
        return [...byAccount.values()];
    }, [calendars, t]);

    const borderColor = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
    const mutedText = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)";

    return (
        <Sheet
            variant="outlined"
            sx={{
                width: 232,
                flexShrink: 0,
                borderRadius: "sm",
                borderColor,
                p: 1,
                overflowY: "auto",
                overflowX: "hidden",
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
            }}
        >
            <Stack alignItems="center" direction="row" spacing={1} sx={{ px: 0.5, mb: 0.25 }}>
                <Typography
                    level="body-xs"
                    sx={{
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: mutedText,
                    }}
                >
                    {t.calendar.sources.title}
                </Typography>
                <Box sx={{ flex: 1 }} />
                {loading && <CircularProgress size="sm" />}
            </Stack>

            {groups.map((group, groupIndex) => {
                const groupKeys = group.calendars.map((c) => sourceKey(c.account_id, c.id));
                const selectedCount = groupKeys.filter((k) => selectedKeys.has(k)).length;
                const allSelected = selectedCount === groupKeys.length && groupKeys.length > 0;
                const someSelected = selectedCount > 0 && !allSelected;
                return (
                    <Box key={group.accountId}>
                        {groupIndex > 0 && <Divider sx={{ my: 0.75 }} />}
                        {/* Account header — one click ticks or unticks
                            every calendar under this account. */}
                        <Tooltip
                            size="sm"
                            title={
                                allSelected
                                    ? t.calendar.sources.hideAllFrom
                                    : t.calendar.sources.showAllFrom
                            }
                            variant="outlined"
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.75,
                                    px: 0.5,
                                    py: 0.5,
                                    borderRadius: "sm",
                                    cursor: "pointer",
                                    "&:hover": {
                                        backgroundColor: isDark
                                            ? "rgba(255,255,255,0.06)"
                                            : "rgba(0,0,0,0.04)",
                                    },
                                }}
                                onClick={() => onToggleAccount(group.accountId, !allSelected)}
                            >
                                <Checkbox
                                    checked={allSelected}
                                    indeterminate={someSelected}
                                    size="sm"
                                    // The row owns the click so the whole
                                    // header is a target, not just the 16px
                                    // box; the checkbox is presentational.
                                    onChange={() => onToggleAccount(group.accountId, !allSelected)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <Typography
                                    level="body-xs"
                                    sx={{ fontWeight: 600, minWidth: 0 }}
                                    noWrap
                                    title={group.accountEmail}
                                >
                                    {group.accountEmail}
                                </Typography>
                            </Box>
                        </Tooltip>

                        <Stack spacing={0} sx={{ pl: 0.5 }}>
                            {group.calendars.map((c) => {
                                const key = sourceKey(c.account_id, c.id);
                                const checked = selectedKeys.has(key);
                                const color = colorBySource[key];
                                const isShared =
                                    !!c.access_role &&
                                    !["owner", "writer"].includes(c.access_role);
                                return (
                                    <Box
                                        key={key}
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 0.75,
                                            px: 0.5,
                                            py: 0.4,
                                            borderRadius: "sm",
                                            cursor: "pointer",
                                            "&:hover": {
                                                backgroundColor: isDark
                                                    ? "rgba(255,255,255,0.06)"
                                                    : "rgba(0,0,0,0.04)",
                                            },
                                        }}
                                        onClick={() => onToggle(key)}
                                    >
                                        <Checkbox
                                            checked={checked}
                                            size="sm"
                                            // Tint the control with the
                                            // calendar's own color so the
                                            // checkbox doubles as the legend
                                            // swatch — one glance maps a
                                            // color on the grid back to a row.
                                            sx={{
                                                "& .MuiCheckbox-checkbox": {
                                                    backgroundColor: checked
                                                        ? color
                                                        : "transparent",
                                                    borderColor: color,
                                                },
                                            }}
                                            onChange={() => onToggle(key)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <Typography
                                            level="body-xs"
                                            sx={{ minWidth: 0, flex: 1 }}
                                            noWrap
                                            title={c.summary || c.id}
                                        >
                                            {c.summary || c.id}
                                        </Typography>
                                        {isShared && (
                                            <Chip
                                                color="neutral"
                                                size="sm"
                                                sx={{ "--Chip-minHeight": "16px", px: 0.5 }}
                                                variant="soft"
                                            >
                                                {t.calendar.sources.sharedBadge}
                                            </Chip>
                                        )}
                                    </Box>
                                );
                            })}
                        </Stack>
                    </Box>
                );
            })}

            <Box sx={{ flex: 1, minHeight: 8 }} />
            <Button
                size="sm"
                startDecorator={<AddRoundedIcon />}
                sx={{ flexShrink: 0 }}
                variant="outlined"
                onClick={onAddAccount}
            >
                {t.calendar.sources.addAccount}
            </Button>
        </Sheet>
    );
};

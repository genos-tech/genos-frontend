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
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AppTooltip } from "../../../components/ui/AppTooltip";
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
    /** `rail` = desktop side column. `strip` = compact horizontal
     *  scroller for mobile, so the grid keeps the full viewport width. */
    layout?: "rail" | "strip";
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
 * Desktop (`rail`): persistent side column — the color legend stays
 * visible while looking at events. Mobile (`strip`): a short
 * horizontally-scrolling chip bar above the grid so a 232px rail
 * doesn't steal half the phone's width.
 */
export const CalendarSourcePicker = ({
    calendars,
    selectedKeys,
    colorBySource,
    loading,
    onToggle,
    onToggleAccount,
    onAddAccount,
    layout = "rail",
}: CalendarSourcePickerProps) => {
    const { t } = useTranslation();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const isStrip = layout === "strip";

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

    if (isStrip) {
        // Flat list of calendars as chips — account grouping stays
        // available via long-press/tooltip on the chip label rather
        // than eating vertical space on a phone.
        const flat = groups.flatMap((g) =>
            g.calendars.map((c) => ({
                ...c,
                accountEmail: g.accountEmail,
            }))
        );
        return (
            <Sheet
                variant="outlined"
                sx={{
                    flexShrink: 0,
                    borderRadius: "sm",
                    borderColor,
                    px: 0.75,
                    py: 0.5,
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    overflowX: "auto",
                    overflowY: "hidden",
                    scrollbarWidth: "none",
                    "&::-webkit-scrollbar": { display: "none" },
                    maxWidth: "100%",
                }}
            >
                <Typography
                    level="body-xs"
                    sx={{
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: mutedText,
                        flexShrink: 0,
                        pr: 0.25,
                    }}
                >
                    {t.calendar.sources.title}
                </Typography>
                {loading && <CircularProgress size="sm" />}
                {flat.map((c) => {
                    const key = sourceKey(c.account_id, c.id);
                    const checked = selectedKeys.has(key);
                    const color = colorBySource[key];
                    const label = c.summary || c.id;
                    return (
                        <AppTooltip key={key} size="sm" title={`${label} — ${c.accountEmail}`}>
                            <Chip
                                size="sm"
                                variant={checked ? "solid" : "outlined"}
                                sx={{
                                    flexShrink: 0,
                                    cursor: "pointer",
                                    // Color swatch doubles as the chip
                                    // accent so the strip stays a legend.
                                    "--Chip-bg": checked ? color : undefined,
                                    borderColor: color,
                                    color: checked ? "#fff" : undefined,
                                    maxWidth: 140,
                                }}
                                onClick={() => onToggle(key)}
                            >
                                <Box
                                    component="span"
                                    sx={{
                                        display: "block",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        maxWidth: 120,
                                    }}
                                >
                                    {label}
                                </Box>
                            </Chip>
                        </AppTooltip>
                    );
                })}
                <Button
                    size="sm"
                    startDecorator={<AddRoundedIcon />}
                    sx={{ flexShrink: 0 }}
                    variant="plain"
                    onClick={onAddAccount}
                >
                    {t.calendar.sources.addAccount}
                </Button>
            </Sheet>
        );
    }

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
                        <AppTooltip
                            size="sm"
                            title={
                                allSelected
                                    ? t.calendar.sources.hideAllFrom
                                    : t.calendar.sources.showAllFrom
                            }
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
                                    title={group.accountEmail}
                                    noWrap
                                >
                                    {group.accountEmail}
                                </Typography>
                            </Box>
                        </AppTooltip>

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
                                        <AppTooltip title={c.summary || c.id}>
                                            <Typography
                                                level="body-xs"
                                                sx={{ minWidth: 0, flex: 1 }}
                                                noWrap
                                            >
                                                {c.summary || c.id}
                                            </Typography>
                                        </AppTooltip>
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

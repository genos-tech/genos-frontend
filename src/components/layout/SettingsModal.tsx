import { useEffect, useMemo, useState } from "react";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import KeyboardRoundedIcon from "@mui/icons-material/KeyboardRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import PlaylistAddCheckRoundedIcon from "@mui/icons-material/PlaylistAddCheckRounded";
import PrivacyTipRoundedIcon from "@mui/icons-material/PrivacyTipRounded";
import SettingsBrightnessRoundedIcon from "@mui/icons-material/SettingsBrightnessRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import ViewStreamRoundedIcon from "@mui/icons-material/ViewStreamRounded";
import {
    Box,
    Button,
    Divider,
    IconButton,
    Modal,
    ModalDialog,
    Option,
    Select,
    Sheet,
    Stack,
    Switch,
    Tab,
    TabList,
    TabPanel,
    Tabs,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useAuth } from "../../context/AuthContext";
import { ConnectionsSection } from "../../features/integrations/components/ConnectionsSection";
import { OAUTH_INTEGRATIONS_ENABLED } from "../../features/integrations/featureFlags";
import {
    findGoogleConnection,
    hasCalendarScope,
    listConnections,
} from "../../features/integrations/services/connections";
import { redirectToOAuthConnect } from "../../features/integrations/services/oauth";
import { useAnalyticsPreferences } from "../../hooks/common/useAnalyticsPreferences";
import { useAutoCloseOnPrMergePreference } from "../../hooks/common/useAutoCloseOnPrMergePreference";
import { useAutoSyncCalendarPreference } from "../../hooks/common/useAutoSyncCalendarPreference";
import {
    BubbleStyle,
    useBubbleStylePreference,
} from "../../hooks/common/useBubbleStylePreference";
import { useDoubleClickTodoPreference } from "../../hooks/common/useDoubleClickTodoPreference";
import { useSpotlightPreferences } from "../../hooks/common/useSpotlightPreferences";
import { ThemePreference, useThemePreference } from "../../hooks/common/useThemePreference";
import { fmt, Locale, useTranslation } from "../../i18n";
import { NotificationSettingsPanel } from "../../services/notifications/NotificationSettingsPanel";
import { getServiceShortcutModifierKeys, isMac } from "../../utils/platform";

type Props = {
    open: boolean;
    onClose: () => void;
};

/**
 * Tiny inline `<kbd>` chip — Joy doesn't ship one, so we style a native
 * element to keep semantics for screen readers / a11y tooling.
 */
const Kbd = ({ children }: { children: React.ReactNode }) => (
    <Box
        component="kbd"
        sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 22,
            px: 0.75,
            py: 0.1,
            fontFamily: "monospace",
            fontSize: "0.72rem",
            fontWeight: 600,
            lineHeight: 1.3,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "sm",
            bgcolor: "background.level1",
            color: "text.primary",
            boxShadow: "0 1px 0 rgba(0,0,0,0.08)",
        }}
    >
        {children}
    </Box>
);

// Pill-style active state replacing Joy's default left-bar indicator
// on the modal's vertical sidebar. Reused on every Tab in the rail.
const SIDEBAR_TAB_SX = {
    justifyContent: "flex-start",
    gap: 1.25,
    borderRadius: "md",
    px: 1.5,
    py: 0.85,
    minHeight: 36,
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "text.secondary",
    transition: "background-color 0.12s ease, color 0.12s ease",
    "&::after": { display: "none" },
    "&:hover:not([aria-selected='true'])": {
        bgcolor: "background.level1",
        color: "text.primary",
    },
    "&[aria-selected='true']": {
        bgcolor: "primary.softBg",
        color: "primary.softColor",
        fontWeight: 600,
    },
} as const;

const SIDEBAR_TAB_ICON_SX = { fontSize: 18, flexShrink: 0 } as const;

const AppearanceSection = () => {
    const { preference, setPreference } = useThemePreference();
    const { t } = useTranslation();
    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <PaletteRoundedIcon />
                <Typography level="title-md">{t.settings.appearance.heading}</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {t.settings.appearance.description}
            </Typography>

            <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">{t.settings.appearance.themeLabel}</Typography>
                    <Typography level="body-xs">{t.settings.appearance.themeHelper}</Typography>
                </Box>
                <Select
                    size="sm"
                    sx={{ minWidth: 140 }}
                    value={preference}
                    onChange={(_e, value) => {
                        if (value) setPreference(value as ThemePreference);
                    }}
                >
                    <Option value="light">
                        <Stack alignItems="center" direction="row" spacing={1}>
                            <LightModeRoundedIcon sx={{ fontSize: 18 }} />
                            <Typography level="body-sm">
                                {t.settings.appearance.themeLight}
                            </Typography>
                        </Stack>
                    </Option>
                    <Option value="dark">
                        <Stack alignItems="center" direction="row" spacing={1}>
                            <DarkModeRoundedIcon sx={{ fontSize: 18 }} />
                            <Typography level="body-sm">
                                {t.settings.appearance.themeDark}
                            </Typography>
                        </Stack>
                    </Option>
                    <Option value="system">
                        <Stack alignItems="center" direction="row" spacing={1}>
                            <SettingsBrightnessRoundedIcon sx={{ fontSize: 18 }} />
                            <Typography level="body-sm">
                                {t.settings.appearance.themeSystem}
                            </Typography>
                        </Stack>
                    </Option>
                </Select>
            </Stack>
        </Sheet>
    );
};

const MessageLayoutSection = () => {
    const { style, setStyle } = useBubbleStylePreference();
    const { t } = useTranslation();
    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <ChatBubbleOutlineRoundedIcon />
                <Typography level="title-md">{t.settings.messageLayout.heading}</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {t.settings.messageLayout.description}
            </Typography>

            <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">{t.settings.messageLayout.styleLabel}</Typography>
                    <Typography level="body-xs">{t.settings.messageLayout.styleHelper}</Typography>
                </Box>
                <Select
                    size="sm"
                    sx={{ minWidth: 140 }}
                    value={style}
                    onChange={(_e, value) => {
                        if (value) setStyle(value as BubbleStyle);
                    }}
                >
                    <Option value="bubble">
                        <Stack alignItems="center" direction="row" spacing={1}>
                            <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 18 }} />
                            <Typography level="body-sm">
                                {t.settings.messageLayout.styleBubble}
                            </Typography>
                        </Stack>
                    </Option>
                    <Option value="compact">
                        <Stack alignItems="center" direction="row" spacing={1}>
                            <ViewStreamRoundedIcon sx={{ fontSize: 18 }} />
                            <Typography level="body-sm">
                                {t.settings.messageLayout.styleCompact}
                            </Typography>
                        </Stack>
                    </Option>
                </Select>
            </Stack>
        </Sheet>
    );
};

const DoubleClickTodoSection = () => {
    const { enabled, setEnabled } = useDoubleClickTodoPreference();
    const { t } = useTranslation();
    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <PlaylistAddCheckRoundedIcon />
                <Typography level="title-md">{t.settings.doubleClickTodo.heading}</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {t.settings.doubleClickTodo.description}
            </Typography>

            <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">
                        {t.settings.doubleClickTodo.toggleLabel}
                    </Typography>
                    <Typography level="body-xs">
                        {t.settings.doubleClickTodo.toggleHelper}
                    </Typography>
                </Box>
                <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            </Stack>
        </Sheet>
    );
};

const SpotlightSection = () => {
    const { aiAnswers, webSearch, setAiAnswers, setWebSearch } = useSpotlightPreferences();
    const { t } = useTranslation();
    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <AutoAwesomeRoundedIcon />
                <Typography level="title-md">{t.settings.spotlight.heading}</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {t.settings.spotlight.description}
            </Typography>

            <Stack
                alignItems="center"
                direction="row"
                justifyContent="space-between"
                spacing={2}
                sx={{ mb: 1.5 }}
            >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">{t.settings.spotlight.aiAnswersLabel}</Typography>
                    <Typography level="body-xs">{t.settings.spotlight.aiAnswersHelper}</Typography>
                </Box>
                <Switch checked={aiAnswers} onChange={(e) => setAiAnswers(e.target.checked)} />
            </Stack>

            <Divider />

            <Stack
                alignItems="center"
                direction="row"
                justifyContent="space-between"
                spacing={2}
                sx={{ mt: 1.5, opacity: aiAnswers ? 1 : 0.5 }}
            >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">{t.settings.spotlight.webSearchLabel}</Typography>
                    <Typography level="body-xs">{t.settings.spotlight.webSearchHelper}</Typography>
                </Box>
                <Switch
                    checked={webSearch}
                    disabled={!aiAnswers}
                    onChange={(e) => setWebSearch(e.target.checked)}
                />
            </Stack>
        </Sheet>
    );
};

const PrivacySection = () => {
    const { enabled, setEnabled } = useAnalyticsPreferences();
    const { t } = useTranslation();
    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <PrivacyTipRoundedIcon />
                <Typography level="title-md">{t.settings.privacy.heading}</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {t.settings.privacy.description}
            </Typography>

            <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">{t.settings.privacy.shareLabel}</Typography>
                    <Typography level="body-xs">{t.settings.privacy.shareHelper}</Typography>
                </Box>
                <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            </Stack>
        </Sheet>
    );
};

const LanguageSection = () => {
    const { t, locale, setLocale } = useTranslation();
    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <LanguageRoundedIcon />
                <Typography level="title-md">{t.settings.language.heading}</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {t.settings.language.description}
            </Typography>

            <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">{t.settings.language.label}</Typography>
                    <Typography level="body-xs">{t.settings.language.helper}</Typography>
                </Box>
                <Select
                    size="sm"
                    sx={{ minWidth: 140 }}
                    value={locale}
                    onChange={(_e, value) => {
                        if (value) setLocale(value as Locale);
                    }}
                >
                    <Option value="en">
                        <Typography level="body-sm">{t.settings.language.english}</Typography>
                    </Option>
                    <Option value="ja">
                        <Typography level="body-sm">{t.settings.language.japanese}</Typography>
                    </Option>
                    <Option value="es">
                        <Typography level="body-sm">{t.settings.language.spanish}</Typography>
                    </Option>
                    <Option value="fr">
                        <Typography level="body-sm">{t.settings.language.french}</Typography>
                    </Option>
                    <Option value="zh">
                        <Typography level="body-sm">{t.settings.language.chinese}</Typography>
                    </Option>
                    <Option value="ar">
                        <Typography level="body-sm">{t.settings.language.arabic}</Typography>
                    </Option>
                    <Option value="hi">
                        <Typography level="body-sm">{t.settings.language.hindi}</Typography>
                    </Option>
                </Select>
            </Stack>
        </Sheet>
    );
};

const AutoCloseOnPrMergeSection = () => {
    const { enabled, loading, setEnabled } = useAutoCloseOnPrMergePreference();
    const { t } = useTranslation();
    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <CheckCircleOutlineRoundedIcon />
                <Typography level="title-md">{t.settings.autoCloseOnPrMerge.heading}</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {t.settings.autoCloseOnPrMerge.description}
            </Typography>

            <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">
                        {t.settings.autoCloseOnPrMerge.toggleLabel}
                    </Typography>
                    <Typography level="body-xs">
                        {t.settings.autoCloseOnPrMerge.toggleHelper}
                    </Typography>
                </Box>
                <Switch
                    checked={enabled}
                    disabled={loading}
                    onChange={(e) => setEnabled(e.target.checked)}
                />
            </Stack>
        </Sheet>
    );
};

const AutoSyncCalendarSection = () => {
    const { enabled, loading, setEnabled, backfill, backfillRunning } =
        useAutoSyncCalendarPreference();
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    // Local connection probe. Two booleans because sign-in-via-Google
    // produces "connected but no calendar scope" — the toggle is only
    // useful when BOTH are true. Null = still loading.
    const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
    const [calendarAuthorized, setCalendarAuthorized] = useState<boolean | null>(null);
    const [backfillMessage, setBackfillMessage] = useState<string | null>(null);
    const [backfillError, setBackfillError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (!accessToken) {
            setGoogleConnected(false);
            setCalendarAuthorized(false);
            return;
        }
        (async () => {
            const res = await listConnections(accessToken);
            if (cancelled) return;
            const google = findGoogleConnection(res);
            setGoogleConnected(!!google);
            setCalendarAuthorized(hasCalendarScope(google));
        })();
        return () => {
            cancelled = true;
        };
    }, [accessToken]);

    const handleBackfill = async () => {
        setBackfillError(null);
        setBackfillMessage(null);
        const result = await backfill();
        if (result === null) {
            setBackfillError(t.settings.autoSyncCalendar.backfillFailed);
            return;
        }
        // Three message branches keep the toast honest:
        //  - nothing eligible → "up to date"
        //  - only cleared links (events deleted on Google) → explain
        //    what happened so the user doesn't think the sync did
        //    something visible when it didn't
        //  - any real sync, with or without clears → show the counts
        if (result.synced === 0 && result.cleared === 0) {
            setBackfillMessage(t.settings.autoSyncCalendar.backfillUpToDate);
            return;
        }
        if (result.synced === 0 && result.cleared > 0) {
            setBackfillMessage(
                fmt(t.settings.autoSyncCalendar.backfillOnlyCleared, {
                    cleared: result.cleared,
                })
            );
            return;
        }
        const template =
            result.cleared > 0
                ? t.settings.autoSyncCalendar.backfillSuccessWithCleared
                : t.settings.autoSyncCalendar.backfillSuccess;
        setBackfillMessage(
            fmt(template, {
                total: result.synced,
                created: result.created,
                patched: result.patched,
                cleared: result.cleared,
            })
        );
    };

    // Toggle is disabled while we don't know the connection state, or
    // when the user clearly can't use the feature yet (not connected,
    // or connected without calendar scope).
    const togglesDisabled = loading || googleConnected === false || calendarAuthorized === false;

    let helperText: string = t.settings.autoSyncCalendar.toggleHelper;
    if (googleConnected === false) {
        helperText = t.settings.autoSyncCalendar.connectPrompt;
    } else if (calendarAuthorized === false) {
        helperText = t.settings.autoSyncCalendar.grantPrompt;
    }

    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <CalendarMonthRoundedIcon />
                <Typography level="title-md">{t.settings.autoSyncCalendar.heading}</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {t.settings.autoSyncCalendar.description}
            </Typography>

            <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">
                        {t.settings.autoSyncCalendar.toggleLabel}
                    </Typography>
                    <Typography level="body-xs">{helperText}</Typography>
                </Box>
                <Switch
                    checked={enabled}
                    disabled={togglesDisabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                />
            </Stack>

            {/* Connected but missing calendar scope → inline Grant
                button. Skipping when not connected at all keeps the
                prompt focused on the right action ("Connect Google
                in Integrations" already lives there, redundant link
                from settings would be noise). */}
            {googleConnected === true && calendarAuthorized === false && accessToken && (
                <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
                    <Button
                        size="sm"
                        variant="solid"
                        color="primary"
                        onClick={() =>
                            void redirectToOAuthConnect(
                                "google",
                                accessToken,
                                undefined,
                                () => undefined
                            )
                        }
                    >
                        {t.settings.autoSyncCalendar.grantButton}
                    </Button>
                </Stack>
            )}

            {enabled && googleConnected && calendarAuthorized && (
                <>
                    <Divider sx={{ my: 1.5 }} />
                    <Stack
                        alignItems="center"
                        direction="row"
                        justifyContent="space-between"
                        spacing={2}
                    >
                        <Typography
                            level="body-xs"
                            sx={{ color: backfillError ? "danger.500" : "text.tertiary" }}
                        >
                            {backfillError || backfillMessage || ""}
                        </Typography>
                        <Button
                            size="sm"
                            variant="outlined"
                            disabled={backfillRunning}
                            onClick={handleBackfill}
                        >
                            {backfillRunning
                                ? t.settings.autoSyncCalendar.backfillRunning
                                : t.settings.autoSyncCalendar.backfillButton}
                        </Button>
                    </Stack>
                </>
            )}
        </Sheet>
    );
};

type ShortcutGroup = {
    title: string;
    description: string;
    rows: Array<{ label: string; combo: string[] }>;
};

const KeyboardShortcutsSection = () => {
    const { t } = useTranslation();
    // Modifier display reflects what `useGlobalServiceShortcut` actually
    // listens to: Ctrl+Cmd on Mac, Ctrl+Alt elsewhere.
    const modifierKeys = useMemo(getServiceShortcutModifierKeys, []);
    const cmdLabel = isMac() ? "⌘" : "Alt";

    const groups: ShortcutGroup[] = [
        {
            title: t.settings.shortcuts.global.title,
            description: t.settings.shortcuts.global.description,
            rows: [
                {
                    label: t.settings.shortcuts.global.rows.spotlight,
                    combo: [isMac() ? "⌘" : "Ctrl", "K"],
                },
                {
                    label: t.settings.shortcuts.global.rows.tasksNew,
                    combo: [...modifierKeys, "T"],
                },
                {
                    label: t.settings.shortcuts.global.rows.notesNew,
                    combo: [...modifierKeys, "N"],
                },
                {
                    label: t.settings.shortcuts.global.rows.calendar,
                    combo: [...modifierKeys, "C"],
                },
                {
                    label: t.settings.shortcuts.global.rows.meetClipboard,
                    combo: [...modifierKeys, "M"],
                },
                {
                    label: t.settings.shortcuts.global.rows.openHistory,
                    combo: [...modifierKeys, "H"],
                },
                {
                    label: t.settings.shortcuts.global.rows.cycle,
                    combo: [
                        t.settings.shortcuts.global.cycleCombo.hold,
                        t.settings.shortcuts.global.cycleCombo.tap,
                        t.settings.shortcuts.global.cycleCombo.release,
                    ],
                },
            ],
        },
        {
            title: t.settings.shortcuts.chat.title,
            description: t.settings.shortcuts.chat.description,
            rows: [
                {
                    label: t.settings.shortcuts.chat.rows.switchTab,
                    combo: [cmdLabel, "Shift", "← / →"],
                },
                {
                    label: t.settings.shortcuts.chat.rows.moveSelection,
                    combo: [cmdLabel, "Shift", "↑ / ↓"],
                },
                {
                    label: t.settings.shortcuts.chat.rows.openThread,
                    combo: [cmdLabel, t.settings.shortcuts.chat.clickMessage],
                },
            ],
        },
    ];

    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <KeyboardRoundedIcon />
                <Typography level="title-md">{t.settings.shortcuts.heading}</Typography>
            </Stack>

            <Stack spacing={2}>
                {groups.map((group, gIdx) => (
                    <Box key={group.title}>
                        <Typography level="title-sm" sx={{ mt: gIdx === 0 ? 0.5 : 0 }}>
                            {group.title}
                        </Typography>
                        <Typography level="body-xs" sx={{ mb: 1 }}>
                            {group.description}
                        </Typography>
                        <Stack spacing={0.75}>
                            {group.rows.map((row, idx) => (
                                <Box key={row.label}>
                                    <Stack
                                        alignItems="center"
                                        direction="row"
                                        justifyContent="space-between"
                                        spacing={2}
                                    >
                                        <Typography level="body-sm">{row.label}</Typography>
                                        <Stack alignItems="center" direction="row" spacing={0.5}>
                                            {row.combo.map((key, i) => (
                                                <Stack
                                                    key={`${key}-${i}`}
                                                    alignItems="center"
                                                    direction="row"
                                                    spacing={0.5}
                                                >
                                                    <Kbd>{key}</Kbd>
                                                    {i < row.combo.length - 1 && (
                                                        <Typography
                                                            level="body-xs"
                                                            sx={{ color: "text.tertiary" }}
                                                        >
                                                            +
                                                        </Typography>
                                                    )}
                                                </Stack>
                                            ))}
                                        </Stack>
                                    </Stack>
                                    {idx < group.rows.length - 1 && <Divider sx={{ mt: 0.75 }} />}
                                </Box>
                            ))}
                        </Stack>
                    </Box>
                ))}
            </Stack>
        </Sheet>
    );
};

/**
 * Dedicated home for user-level settings. Sections from top to bottom:
 *
 *   1. Appearance       – theme mode (light / dark / system).
 *   2. Message layout   – bubble vs compact rendering of chat messages.
 *   3. Spotlight        – AI answers + web search toggles.
 *   4. Privacy          – analytics opt-out.
 *   5. Language         – locale switcher (English / 日本語).
 *   6. Notifications    – delegates to `NotificationSettingsPanel`.
 *   7. Keyboard shortcuts – read-only reference for the global service shortcuts.
 *
 * Notification state is read from `NotificationsContext` provided at the
 * App root, so the modal needs no notification-specific props.
 */
// Tab keys mirror the i18n keys under `settings.tabs.*` and are kept
// as a plain string union (rather than numeric indices) so reordering
// or inserting a new tab doesn't silently shift selection.
type SettingsTabKey =
    | "general"
    | "chat"
    | "tasks"
    | "spotlight"
    | "notifications"
    | "shortcuts"
    | "integrations";

/**
 * Settings → Integrations panel. Renders the same Connections UI
 * (Google + GitHub Connect/Disconnect, Grant Calendar access, test-
 * user notice) that the `/workspace/integrations` page surfaces, so
 * users can manage their providers without leaving Settings. The
 * `accessToken` gate keeps the panel quiet for pre-auth contexts
 * (e.g., if the modal were ever rendered before sign-in completes).
 */
const IntegrationsSection = () => {
    const { accessToken } = useAuth();
    if (!accessToken) return null;
    return <ConnectionsSection accessToken={accessToken} />;
};

export const SettingsModal = ({ open, onClose }: Props) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    // Tab selection is local component state — open the modal,
    // navigate around, close — there's no need to persist this across
    // sessions. Default to "general" because it holds the broadest
    // app-wide preferences (appearance, language, privacy).
    const [tab, setTab] = useState<SettingsTabKey>("general");
    return (
        <Modal open={open} onClose={onClose}>
            <ModalDialog
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                size="lg"
                sx={{
                    width: { xs: "92vw", sm: 550, md: 700 },
                    maxHeight: "85vh",
                    overflowY: "auto",
                    overflowX: "hidden",
                    borderRadius: "xl",
                    p: 2.5,
                }}
            >
                <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 1 }}>
                    <SettingsRoundedIcon />
                    <Typography level="title-lg">{t.settings.title}</Typography>
                    <Box sx={{ flex: 1 }} />
                    <IconButton variant="plain" onClick={onClose}>
                        <CloseRoundedIcon />
                    </IconButton>
                </Stack>
                <Divider sx={{ mb: 2 }} />
                <Tabs
                    orientation="vertical"
                    sx={{
                        // Sidebar tab list on the left, panel on the
                        // right. The Tabs component flexes children
                        // along its orientation, so a row layout drops
                        // out naturally once orientation flips.
                        bgcolor: "transparent",
                        gap: 2,
                    }}
                    value={tab}
                    onChange={(_event, value) => {
                        if (typeof value === "string") setTab(value as SettingsTabKey);
                    }}
                >
                    <TabList
                        sx={{
                            minWidth: 184,
                            flexShrink: 0,
                            gap: 0.25,
                            overflow: "visible",
                            scrollbarWidth: "none",
                        }}
                    >
                        <Tab value="general" sx={SIDEBAR_TAB_SX}>
                            <SettingsRoundedIcon sx={SIDEBAR_TAB_ICON_SX} />
                            {t.settings.tabs.general}
                        </Tab>
                        <Tab value="chat" sx={SIDEBAR_TAB_SX}>
                            <ChatBubbleOutlineRoundedIcon sx={SIDEBAR_TAB_ICON_SX} />
                            {t.settings.tabs.chat}
                        </Tab>
                        <Tab value="tasks" sx={SIDEBAR_TAB_SX}>
                            <PlaylistAddCheckRoundedIcon sx={SIDEBAR_TAB_ICON_SX} />
                            {t.settings.tabs.tasks}
                        </Tab>
                        <Tab value="spotlight" sx={SIDEBAR_TAB_SX}>
                            <AutoAwesomeRoundedIcon sx={SIDEBAR_TAB_ICON_SX} />
                            {t.settings.tabs.spotlight}
                        </Tab>
                        <Tab value="notifications" sx={SIDEBAR_TAB_SX}>
                            <NotificationsRoundedIcon sx={SIDEBAR_TAB_ICON_SX} />
                            {t.settings.tabs.notifications}
                        </Tab>
                        <Tab value="shortcuts" sx={SIDEBAR_TAB_SX}>
                            <KeyboardRoundedIcon sx={SIDEBAR_TAB_ICON_SX} />
                            {t.settings.tabs.shortcuts}
                        </Tab>
                        {/* Feature-flagged so disabled deploys don't
                            show an empty tab. */}
                        {OAUTH_INTEGRATIONS_ENABLED && (
                            <Tab value="integrations" sx={SIDEBAR_TAB_SX}>
                                <HubRoundedIcon sx={SIDEBAR_TAB_ICON_SX} />
                                {t.settings.tabs.integrations}
                            </Tab>
                        )}
                    </TabList>

                    <TabPanel value="general" sx={{ px: 0, py: 2 }}>
                        <Stack spacing={2}>
                            <AppearanceSection />
                            <LanguageSection />
                            <PrivacySection />
                        </Stack>
                    </TabPanel>
                    <TabPanel value="chat" sx={{ px: 0, py: 2 }}>
                        <Stack spacing={2}>
                            <MessageLayoutSection />
                            <DoubleClickTodoSection />
                        </Stack>
                    </TabPanel>
                    <TabPanel value="tasks" sx={{ px: 0, py: 2 }}>
                        <Stack spacing={2}>
                            {/* Sort settings now live in
                                `TaskTableColumnSettings` (task table /
                                board view config), since they're
                                view-level prefs rather than user-level
                                ones. The two integrations below stay
                                here because they affect cross-feature
                                behaviour. */}
                            <AutoCloseOnPrMergeSection />
                            <AutoSyncCalendarSection />
                        </Stack>
                    </TabPanel>
                    <TabPanel value="spotlight" sx={{ px: 0, py: 2 }}>
                        <Stack spacing={2}>
                            <SpotlightSection />
                        </Stack>
                    </TabPanel>
                    <TabPanel value="notifications" sx={{ px: 0, py: 2 }}>
                        <Stack spacing={2}>
                            <NotificationSettingsPanel />
                        </Stack>
                    </TabPanel>
                    <TabPanel value="shortcuts" sx={{ px: 0, py: 2 }}>
                        <Stack spacing={2}>
                            <KeyboardShortcutsSection />
                        </Stack>
                    </TabPanel>
                    {OAUTH_INTEGRATIONS_ENABLED && (
                        <TabPanel value="integrations" sx={{ px: 0, py: 2 }}>
                            <Stack spacing={2}>
                                <IntegrationsSection />
                            </Stack>
                        </TabPanel>
                    )}
                </Tabs>
            </ModalDialog>
        </Modal>
    );
};

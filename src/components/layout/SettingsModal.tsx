import { useMemo } from "react";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import KeyboardRoundedIcon from "@mui/icons-material/KeyboardRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import PrivacyTipRoundedIcon from "@mui/icons-material/PrivacyTipRounded";
import SettingsBrightnessRoundedIcon from "@mui/icons-material/SettingsBrightnessRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import {
    Box,
    Divider,
    IconButton,
    Modal,
    ModalDialog,
    Option,
    Select,
    Sheet,
    Stack,
    Switch,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useAnalyticsPreferences } from "../../hooks/common/useAnalyticsPreferences";
import { useSpotlightPreferences } from "../../hooks/common/useSpotlightPreferences";
import { ThemePreference, useThemePreference } from "../../hooks/common/useThemePreference";
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

const AppearanceSection = () => {
    const { preference, setPreference } = useThemePreference();
    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <PaletteRoundedIcon />
                <Typography level="title-md">Appearance</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                Choose how the app looks. "System" follows your OS theme and updates automatically
                when it changes.
            </Typography>

            <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">Theme</Typography>
                    <Typography level="body-xs">
                        Applies immediately and persists across sessions.
                    </Typography>
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
                            <Typography level="body-sm">Light</Typography>
                        </Stack>
                    </Option>
                    <Option value="dark">
                        <Stack alignItems="center" direction="row" spacing={1}>
                            <DarkModeRoundedIcon sx={{ fontSize: 18 }} />
                            <Typography level="body-sm">Dark</Typography>
                        </Stack>
                    </Option>
                    <Option value="system">
                        <Stack alignItems="center" direction="row" spacing={1}>
                            <SettingsBrightnessRoundedIcon sx={{ fontSize: 18 }} />
                            <Typography level="body-sm">System</Typography>
                        </Stack>
                    </Option>
                </Select>
            </Stack>
        </Sheet>
    );
};

const SpotlightSection = () => {
    const { aiAnswers, webSearch, setAiAnswers, setWebSearch } = useSpotlightPreferences();
    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <AutoAwesomeRoundedIcon />
                <Typography level="title-md">Spotlight</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                Spotlight always searches your chats, tasks, and notes. The toggles below gate the
                optional LLM-powered answers, which count against your daily ask quota.
            </Typography>

            <Stack
                alignItems="center"
                direction="row"
                justifyContent="space-between"
                spacing={2}
                sx={{ mb: 1.5 }}
            >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">AI answers</Typography>
                    <Typography level="body-xs">
                        Lets the "Ask" button send your query to the agent. When off, Spotlight
                        returns search results only.
                    </Typography>
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
                    <Typography level="title-sm">Web search</Typography>
                    <Typography level="body-xs">
                        Allow the agent to browse the web when answering. Requires AI answers to be
                        on.
                    </Typography>
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
    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <PrivacyTipRoundedIcon />
                <Typography level="title-md">Privacy & analytics</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                Helps us understand which features get used so we can focus on the right things.
            </Typography>

            <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">Share anonymous usage data</Typography>
                    <Typography level="body-xs">
                        Sends your user ID, team, and role plus the pages you visit. No message
                        content, no clicks tracked. Turn off to opt out completely.
                    </Typography>
                </Box>
                <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            </Stack>
        </Sheet>
    );
};

type ShortcutGroup = {
    title: string;
    description: string;
    rows: Array<{ label: string; combo: string[] }>;
};

const KeyboardShortcutsSection = () => {
    // Modifier display reflects what `useGlobalServiceShortcut` actually
    // listens to: Ctrl+Cmd on Mac, Ctrl+Alt elsewhere.
    const modifierKeys = useMemo(getServiceShortcutModifierKeys, []);
    const cmdLabel = isMac() ? "⌘" : "Alt";

    const groups: ShortcutGroup[] = [
        {
            title: "Global",
            description:
                "Available anywhere. The letter shortcuts now compose navigation with a creation action; the cycle gesture works like the macOS Cmd+Tab switcher.",
            rows: [
                {
                    label: "Open Spotlight search",
                    combo: [isMac() ? "⌘" : "Ctrl", "K"],
                },
                {
                    label: "Open Tasks and start a new task",
                    combo: [...modifierKeys, "T"],
                },
                {
                    label: "Open Notes and create a new My Note",
                    combo: [...modifierKeys, "N"],
                },
                {
                    label: "Cycle through services",
                    combo: ["Hold ⌘", "Tap Ctrl to cycle", "Release ⌘ to switch"],
                },
            ],
        },
        {
            title: "Chat",
            description:
                "Active while a chat surface is mounted. Editable text fields keep platform text-selection shortcuts.",
            rows: [
                {
                    label: "Switch chat tab",
                    combo: [cmdLabel, "Shift", "← / →"],
                },
                {
                    label: "Move selection in chat list",
                    combo: [cmdLabel, "Shift", "↑ / ↓"],
                },
                {
                    label: "Open thread of a message",
                    combo: [cmdLabel, "Click message"],
                },
            ],
        },
    ];

    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <KeyboardRoundedIcon />
                <Typography level="title-md">Keyboard shortcuts</Typography>
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
 *   2. Notifications    – delegates to `NotificationSettingsPanel`.
 *   3. Keyboard shortcuts – read-only reference for the global service shortcuts.
 *
 * Notification state is read from `NotificationsContext` provided at the
 * App root, so the modal needs no notification-specific props.
 */
export const SettingsModal = ({ open, onClose }: Props) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
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
                    <Typography level="title-lg">Settings</Typography>
                    <Box sx={{ flex: 1 }} />
                    <IconButton variant="plain" onClick={onClose}>
                        <CloseRoundedIcon />
                    </IconButton>
                </Stack>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={2}>
                    <AppearanceSection />
                    <SpotlightSection />
                    <PrivacySection />
                    <NotificationSettingsPanel />
                    <KeyboardShortcutsSection />
                </Stack>
            </ModalDialog>
        </Modal>
    );
};

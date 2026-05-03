import { useMemo } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import KeyboardRoundedIcon from "@mui/icons-material/KeyboardRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
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
    Typography,
} from "@mui/joy";

import { ThemePreference, useThemePreference } from "../../hooks/common/useThemePreference";
import { NotificationSettingsPanel } from "../../services/notifications/NotificationSettingsPanel";
import { getServiceShortcutModifierKeys } from "../../utils/platform";

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
        <Sheet variant="outlined" sx={{ p: 2, borderRadius: "lg" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <PaletteRoundedIcon />
                <Typography level="title-md">Appearance</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                Choose how the app looks. "System" follows your OS theme and updates automatically
                when it changes.
            </Typography>

            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">Theme</Typography>
                    <Typography level="body-xs">
                        Applies immediately and persists across sessions.
                    </Typography>
                </Box>
                <Select
                    size="sm"
                    value={preference}
                    onChange={(_e, value) => {
                        if (value) setPreference(value as ThemePreference);
                    }}
                    sx={{ minWidth: 140 }}
                >
                    <Option value="light">
                        <Stack direction="row" spacing={1} alignItems="center">
                            <LightModeRoundedIcon sx={{ fontSize: 18 }} />
                            <Typography level="body-sm">Light</Typography>
                        </Stack>
                    </Option>
                    <Option value="dark">
                        <Stack direction="row" spacing={1} alignItems="center">
                            <DarkModeRoundedIcon sx={{ fontSize: 18 }} />
                            <Typography level="body-sm">Dark</Typography>
                        </Stack>
                    </Option>
                    <Option value="system">
                        <Stack direction="row" spacing={1} alignItems="center">
                            <SettingsBrightnessRoundedIcon sx={{ fontSize: 18 }} />
                            <Typography level="body-sm">System</Typography>
                        </Stack>
                    </Option>
                </Select>
            </Stack>
        </Sheet>
    );
};

const KeyboardShortcutsSection = () => {
    // Modifier display reflects what `useGlobalServiceShortcut` actually
    // listens to: Ctrl+Cmd on Mac, Ctrl+Alt elsewhere.
    const modifierKeys = useMemo(getServiceShortcutModifierKeys, []);

    const rows: Array<{ label: string; combo: string[] }> = [
        { label: "Open Inbox", combo: [...modifierKeys, "I"] },
        { label: "Open Chats", combo: [...modifierKeys, "C"] },
        { label: "Open Tasks", combo: [...modifierKeys, "T"] },
        { label: "Open Notes", combo: [...modifierKeys, "N"] },
        {
            label: "Cycle through services",
            combo: ["Hold ⌘", "Tap Ctrl to cycle", "Release ⌘ to switch"],
        },
    ];

    return (
        <Sheet variant="outlined" sx={{ p: 2, borderRadius: "lg" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <KeyboardRoundedIcon />
                <Typography level="title-md">Keyboard shortcuts</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                Switch services without leaving the keyboard. Letter shortcuts jump directly;
                arrows cycle through services in order and wrap around the ends.
            </Typography>

            <Stack spacing={0.75}>
                {rows.map((row, idx) => (
                    <Box key={row.label}>
                        <Stack
                            direction="row"
                            spacing={2}
                            alignItems="center"
                            justifyContent="space-between"
                        >
                            <Typography level="body-sm">{row.label}</Typography>
                            <Stack direction="row" spacing={0.5} alignItems="center">
                                {row.combo.map((key, i) => (
                                    <Stack
                                        key={`${key}-${i}`}
                                        direction="row"
                                        spacing={0.5}
                                        alignItems="center"
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
                        {idx < rows.length - 1 && <Divider sx={{ mt: 0.75 }} />}
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
    return (
        <Modal open={open} onClose={onClose}>
            <ModalDialog
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
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
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
                    <NotificationSettingsPanel />
                    <KeyboardShortcutsSection />
                </Stack>
            </ModalDialog>
        </Modal>
    );
};

import NotificationsActiveRounded from "@mui/icons-material/NotificationsActiveRounded";
import NotificationsOffRounded from "@mui/icons-material/NotificationsOffRounded";
import {
    Box,
    Button,
    Chip,
    Divider,
    IconButton,
    Sheet,
    Stack,
    Switch,
    Typography,
} from "@mui/joy";

import { fmt, Messages, useTranslation } from "../../i18n";
import { useNotificationsContext } from "./NotificationsContext";
import { NotificationCategory } from "./types";

type CategoryLabel = {
    id: NotificationCategory;
    label: string;
    description: string;
};

const buildCategoryLabels = (t: Messages): CategoryLabel[] => {
    const cats = t.services.notifications.categories;
    const descs = t.services.notifications.settings.categoryDescriptions;
    return [
        { id: "chats", label: cats.chats, description: descs.chats },
        {
            id: "thread_replies",
            label: cats.threadReplies,
            description: descs.threadReplies,
        },
        { id: "mentions", label: cats.mentions, description: descs.mentions },
        {
            id: "task_comments",
            label: cats.taskComments,
            description: descs.taskComments,
        },
        { id: "inbox", label: cats.inbox, description: descs.inbox },
    ];
};

const labelForChatType = (chatType: number, t: Messages): string => {
    const labels = t.services.notifications.settingsChatType;
    switch (chatType) {
        case 1:
            return labels.direct;
        case 2:
            return labels.group;
        case 3:
            return labels.project;
        case 4:
            return labels.direct;
        default:
            return fmt(labels.fallback, { chatType });
    }
};

/**
 * Self-contained notification settings UI. Drops into any modal/page that
 * lives inside `<NotificationsProvider>`. Renders nothing if no provider is
 * mounted.
 */
export const NotificationSettingsPanel = () => {
    const ctx = useNotificationsContext();
    const { t } = useTranslation();
    if (!ctx) return null;

    const {
        preferences,
        permission,
        requestPermission,
        setMasterEnabled,
        setCategoryEnabled,
        unmute,
    } = ctx;

    const masterDisabled = !preferences.masterEnabled;
    const categoryLabels = buildCategoryLabels(t);
    const settingsMessages = t.services.notifications.settings;

    return (
        <Sheet variant="outlined" sx={{ p: 2, borderRadius: "lg" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                {preferences.masterEnabled ? (
                    <NotificationsActiveRounded />
                ) : (
                    <NotificationsOffRounded />
                )}
                <Typography level="title-md">{settingsMessages.heading}</Typography>
                <Box sx={{ flex: 1 }} />
                <Switch
                    checked={preferences.masterEnabled}
                    onChange={(e) => setMasterEnabled(e.target.checked)}
                />
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1 }}>
                {settingsMessages.description}
            </Typography>

            {/* Permission state */}
            <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mb: 1.5, flexWrap: "wrap" }}
            >
                <Typography level="body-sm">{settingsMessages.browserPermissionLabel}</Typography>
                <Chip
                    size="sm"
                    variant="soft"
                    color={
                        permission === "granted"
                            ? "success"
                            : permission === "denied"
                              ? "danger"
                              : permission === "unsupported"
                                ? "neutral"
                                : "warning"
                    }
                >
                    {permission}
                </Chip>
                {permission === "default" && (
                    <Button size="sm" onClick={requestPermission}>
                        {settingsMessages.allow}
                    </Button>
                )}
            </Stack>

            <Divider />

            {/* Category toggles */}
            <Stack spacing={1.25} sx={{ mt: 1.5, opacity: masterDisabled ? 0.5 : 1 }}>
                {categoryLabels.map((cat, idx) => {
                    const enabled = (() => {
                        switch (cat.id) {
                            case "chats":
                                return preferences.enableChats;
                            case "thread_replies":
                                return preferences.enableThreadReplies;
                            case "mentions":
                                return preferences.enableMentions;
                            case "task_comments":
                                return preferences.enableTaskComments;
                            case "inbox":
                                return preferences.enableInbox;
                        }
                    })();
                    return (
                        <Box key={cat.id}>
                            <Stack
                                direction="row"
                                spacing={2}
                                alignItems="center"
                                justifyContent="space-between"
                            >
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Typography level="title-sm">{cat.label}</Typography>
                                    <Typography level="body-xs">{cat.description}</Typography>
                                </Box>
                                <Switch
                                    checked={enabled}
                                    disabled={masterDisabled}
                                    onChange={(e) => setCategoryEnabled(cat.id, e.target.checked)}
                                />
                            </Stack>
                            {idx < categoryLabels.length - 1 && <Divider sx={{ mt: 1.25 }} />}
                        </Box>
                    );
                })}
            </Stack>

            {/* Muted chats */}
            <Divider sx={{ mt: 2 }} />
            <Typography level="title-sm" sx={{ mt: 1.5, mb: 0.5 }}>
                {fmt(settingsMessages.mutedChatsHeading, {
                    count: preferences.mutedChats.length,
                })}
            </Typography>
            {preferences.mutedChats.length === 0 ? (
                <Typography level="body-xs">{settingsMessages.noMutedChats}</Typography>
            ) : (
                <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                    {preferences.mutedChats.map((m) => {
                        // Prefer the persisted display name; fall back to
                        // the raw chat id for legacy entries (older mutes
                        // that pre-date the `chatName` field).
                        const displayName = m.chatName || m.chatId;
                        // const showRawId = !!m.chatName && m.chatName !== m.chatId;
                        const showRawId = false;
                        return (
                            <Stack
                                key={`${m.chatType}:${m.chatId}`}
                                direction="row"
                                spacing={1}
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{
                                    px: 1.25,
                                    py: 0.5,
                                    borderRadius: "md",
                                    bgcolor: "background.level1",
                                }}
                            >
                                <Stack
                                    direction="row"
                                    spacing={1}
                                    alignItems="center"
                                    sx={{ minWidth: 0, flex: 1 }}
                                >
                                    <Chip size="sm" variant="soft">
                                        {labelForChatType(m.chatType, t)}
                                    </Chip>
                                    <Stack sx={{ minWidth: 0 }}>
                                        <Typography
                                            level="body-sm"
                                            sx={{ fontWeight: 600 }}
                                            noWrap
                                            title={displayName}
                                        >
                                            {displayName}
                                        </Typography>
                                        {showRawId && (
                                            <Typography
                                                level="body-xs"
                                                sx={{
                                                    color: "neutral.plainColor",
                                                    opacity: 0.6,
                                                    fontFamily: "monospace",
                                                }}
                                                noWrap
                                                title={`Chat ID: ${m.chatId}`}
                                            >
                                                #{m.chatId}
                                            </Typography>
                                        )}
                                    </Stack>
                                </Stack>
                                <IconButton
                                    size="sm"
                                    variant="plain"
                                    onClick={() => unmute(m.chatType, m.chatId)}
                                    aria-label={fmt(settingsMessages.unmuteAriaLabel, {
                                        name: displayName,
                                    })}
                                >
                                    <NotificationsActiveRounded />
                                </IconButton>
                            </Stack>
                        );
                    })}
                </Stack>
            )}
        </Sheet>
    );
};

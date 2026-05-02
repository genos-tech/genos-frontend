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

import { useNotificationsContext } from "./NotificationsContext";
import { NotificationCategory } from "./types";

const CATEGORY_LABELS: Array<{
    id: NotificationCategory;
    label: string;
    description: string;
}> = [
    {
        id: "chats",
        label: "Chats",
        description: "Direct messages, group chats, and project chat messages.",
    },
    {
        id: "thread_replies",
        label: "Thread replies",
        description: "Replies posted under any message you can see.",
    },
    {
        id: "mentions",
        label: "Mentions",
        description: "When someone @-mentions you anywhere.",
    },
    {
        id: "task_comments",
        label: "Task comments",
        description: "New comments on tasks you participate in.",
    },
    {
        id: "inbox",
        label: "Inbox",
        description: "Join requests, approvals, and other inbox items.",
    },
];

const labelForChatType = (chatType: number): string => {
    switch (chatType) {
        case 1:
            return "DM";
        case 2:
            return "Group";
        case 3:
            return "Project";
        case 4:
            return "Group DM";
        default:
            return `Chat ${chatType}`;
    }
};

/**
 * Self-contained notification settings UI. Drops into any modal/page that
 * lives inside `<NotificationsProvider>`. Renders nothing if no provider is
 * mounted.
 */
export const NotificationSettingsPanel = () => {
    const ctx = useNotificationsContext();
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

    return (
        <Sheet variant="outlined" sx={{ p: 2, borderRadius: "lg" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                {preferences.masterEnabled ? (
                    <NotificationsActiveRounded />
                ) : (
                    <NotificationsOffRounded />
                )}
                <Typography level="title-md">Web notifications</Typography>
                <Box sx={{ flex: 1 }} />
                <Switch
                    checked={preferences.masterEnabled}
                    onChange={(e) => setMasterEnabled(e.target.checked)}
                />
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1 }}>
                Show desktop notifications when the tab is in the background, or an in-app toast
                when it's foreground but you're on a different screen.
            </Typography>

            {/* Permission state */}
            <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mb: 1.5, flexWrap: "wrap" }}
            >
                <Typography level="body-sm">Browser permission:</Typography>
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
                        Allow
                    </Button>
                )}
            </Stack>

            <Divider />

            {/* Category toggles */}
            <Stack spacing={1.25} sx={{ mt: 1.5, opacity: masterDisabled ? 0.5 : 1 }}>
                {CATEGORY_LABELS.map((cat, idx) => {
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
                            {idx < CATEGORY_LABELS.length - 1 && <Divider sx={{ mt: 1.25 }} />}
                        </Box>
                    );
                })}
            </Stack>

            {/* Muted chats */}
            <Divider sx={{ mt: 2 }} />
            <Typography level="title-sm" sx={{ mt: 1.5, mb: 0.5 }}>
                Muted chats ({preferences.mutedChats.length})
            </Typography>
            {preferences.mutedChats.length === 0 ? (
                <Typography level="body-xs">
                    No muted chats. Use the bell icon in any chat header to mute it.
                </Typography>
            ) : (
                <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                    {preferences.mutedChats.map((m) => (
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
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Chip size="sm" variant="soft">
                                    {labelForChatType(m.chatType)}
                                </Chip>
                                <Typography level="body-sm">{m.chatId}</Typography>
                            </Stack>
                            <IconButton
                                size="sm"
                                variant="plain"
                                onClick={() => unmute(m.chatType, m.chatId)}
                                aria-label="Unmute"
                            >
                                <NotificationsActiveRounded />
                            </IconButton>
                        </Stack>
                    ))}
                </Stack>
            )}
        </Sheet>
    );
};

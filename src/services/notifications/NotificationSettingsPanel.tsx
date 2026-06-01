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
import { CATEGORY_BY_KEY, CATEGORY_GROUPS, CoarseGroup, NotificationCategory } from "./categories";
import { useNotificationsContext } from "./NotificationsContext";
import { MutedTargetType } from "./types";

// Group heading label — reuse the coarse category labels as the umbrella.
const groupLabel = (group: CoarseGroup, t: Messages): string => {
    const cats = t.services.notifications.categories;
    switch (group) {
        case "chats":
            return cats.chats;
        case "thread_replies":
            return cats.threadReplies;
        case "mentions":
            return cats.mentions;
        case "task_comments":
            return cats.taskComments;
        case "inbox":
            return cats.inbox;
    }
};

// Per-category label/description resolved from the registry's i18n keys.
// Accept `string` (the registry's `key` field is typed `string`) and look
// up against loose records — the keys are guaranteed present in en, the
// typed `Messages` source.
const categoryLabel = (key: string, t: Messages): string => {
    const entry = CATEGORY_BY_KEY[key as NotificationCategory];
    const cats = t.services.notifications.categories as Record<string, string>;
    return (entry && cats[entry.labelKey]) || key;
};
const categoryDescription = (key: string, t: Messages): string => {
    const entry = CATEGORY_BY_KEY[key as NotificationCategory];
    const descs = t.services.notifications.settings.categoryDescriptions as Record<string, string>;
    return (entry && descs[entry.descriptionKey]) || "";
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

const labelForTargetType = (targetType: MutedTargetType, t: Messages): string => {
    const labels = t.services.notifications.settings.targetTypeLabels;
    return labels[targetType] ?? targetType;
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
        setGroupEnabled,
        setSubCategoryEnabled,
        unmute,
        unmuteTarget,
    } = ctx;

    const masterDisabled = !preferences.masterEnabled;
    const settingsMessages = t.services.notifications.settings;

    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
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
                alignItems="center"
                direction="row"
                spacing={1}
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

            {/* Category groups: each group is a master switch (drives the
                coarse boolean); the mentions group also exposes per-surface
                sub-toggles (driven by categorySettings). */}
            <Stack spacing={1.5} sx={{ mt: 1.5, opacity: masterDisabled ? 0.5 : 1 }}>
                {CATEGORY_GROUPS.map((g, idx) => {
                    const groupOn = preferences[g.field] as boolean;
                    // Sub-toggles to render under this group (single-sub
                    // groups hide their lone member — the group toggle is it).
                    const subEntries = g.entries.filter((e) => !e.hideSubToggle);
                    // For a single-sub group, surface that entry's description
                    // on the group row; for mentions, use the lead entry's
                    // generic description.
                    const headRowDesc = categoryDescription(g.entries[0].key, t);
                    return (
                        <Box key={g.group}>
                            <Stack
                                alignItems="center"
                                direction="row"
                                justifyContent="space-between"
                                spacing={2}
                            >
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Typography level="title-sm">
                                        {groupLabel(g.group, t)}
                                    </Typography>
                                    <Typography level="body-xs">{headRowDesc}</Typography>
                                </Box>
                                <Switch
                                    checked={groupOn}
                                    disabled={masterDisabled}
                                    onChange={(e) => setGroupEnabled(g.group, e.target.checked)}
                                />
                            </Stack>

                            {subEntries.length > 0 && (
                                <Stack spacing={1} sx={{ mt: 1, pl: 2 }}>
                                    {subEntries.map((entry) => {
                                        const subOn =
                                            preferences.categorySettings[entry.key] ??
                                            entry.defaultEnabled;
                                        return (
                                            <Stack
                                                key={entry.key}
                                                alignItems="center"
                                                direction="row"
                                                justifyContent="space-between"
                                                spacing={2}
                                            >
                                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                                    <Typography level="body-sm">
                                                        {categoryLabel(entry.key, t)}
                                                    </Typography>
                                                    <Typography level="body-xs">
                                                        {categoryDescription(entry.key, t)}
                                                    </Typography>
                                                </Box>
                                                <Switch
                                                    checked={subOn}
                                                    disabled={masterDisabled || !groupOn}
                                                    size="sm"
                                                    onChange={(e) =>
                                                        setSubCategoryEnabled(
                                                            entry.key as NotificationCategory,
                                                            e.target.checked
                                                        )
                                                    }
                                                />
                                            </Stack>
                                        );
                                    })}
                                </Stack>
                            )}

                            {idx < CATEGORY_GROUPS.length - 1 && <Divider sx={{ mt: 1.5 }} />}
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
                        const displayName = m.chatName || m.chatId;
                        return (
                            <Stack
                                key={`${m.chatType}:${m.chatId}`}
                                alignItems="center"
                                direction="row"
                                justifyContent="space-between"
                                spacing={1}
                                sx={{
                                    px: 1.25,
                                    py: 0.5,
                                    borderRadius: "md",
                                    bgcolor: "background.level1",
                                }}
                            >
                                <Stack
                                    alignItems="center"
                                    direction="row"
                                    spacing={1}
                                    sx={{ minWidth: 0, flex: 1 }}
                                >
                                    <Chip size="sm" variant="soft">
                                        {labelForChatType(m.chatType, t)}
                                    </Chip>
                                    <Stack sx={{ minWidth: 0 }}>
                                        <Typography
                                            level="body-sm"
                                            sx={{ fontWeight: 600 }}
                                            title={displayName}
                                            noWrap
                                        >
                                            {displayName}
                                        </Typography>
                                    </Stack>
                                </Stack>
                                <IconButton
                                    size="sm"
                                    variant="plain"
                                    aria-label={fmt(settingsMessages.unmuteAriaLabel, {
                                        name: displayName,
                                    })}
                                    onClick={() => unmute(m.chatType, m.chatId)}
                                >
                                    <NotificationsActiveRounded />
                                </IconButton>
                            </Stack>
                        );
                    })}
                </Stack>
            )}

            {/* Muted items (per-object: threads / tasks / notes) */}
            <Divider sx={{ mt: 2 }} />
            <Typography level="title-sm" sx={{ mt: 1.5, mb: 0.5 }}>
                {fmt(settingsMessages.mutedTargetsHeading, {
                    count: preferences.mutedTargets.length,
                })}
            </Typography>
            {preferences.mutedTargets.length === 0 ? (
                <Typography level="body-xs">{settingsMessages.noMutedTargets}</Typography>
            ) : (
                <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                    {preferences.mutedTargets.map((target) => {
                        const displayName = target.label || target.targetId;
                        return (
                            <Stack
                                key={`${target.targetType}:${target.targetId}`}
                                alignItems="center"
                                direction="row"
                                justifyContent="space-between"
                                spacing={1}
                                sx={{
                                    px: 1.25,
                                    py: 0.5,
                                    borderRadius: "md",
                                    bgcolor: "background.level1",
                                }}
                            >
                                <Stack
                                    alignItems="center"
                                    direction="row"
                                    spacing={1}
                                    sx={{ minWidth: 0, flex: 1, flexWrap: "wrap" }}
                                >
                                    <Chip size="sm" variant="soft">
                                        {labelForTargetType(target.targetType, t)}
                                    </Chip>
                                    <Typography
                                        level="body-sm"
                                        sx={{ fontWeight: 600, minWidth: 0 }}
                                        title={displayName}
                                        noWrap
                                    >
                                        {displayName}
                                    </Typography>
                                    {/* Optional category scope. Absent = all. */}
                                    {target.categories?.map((c) => (
                                        <Chip key={c} color="neutral" size="sm" variant="outlined">
                                            {categoryLabel(c, t)}
                                        </Chip>
                                    ))}
                                </Stack>
                                <IconButton
                                    size="sm"
                                    variant="plain"
                                    aria-label={fmt(settingsMessages.unmuteAriaLabel, {
                                        name: displayName,
                                    })}
                                    onClick={() =>
                                        unmuteTarget(target.targetType, target.targetId)
                                    }
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

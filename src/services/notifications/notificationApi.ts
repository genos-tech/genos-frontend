import { authApi } from "../api";
import { DEFAULT_NOTIFICATION_PREFERENCE, MutedTargetRef, NotificationPreference } from "./types";

// Wire format coming back from the Django serializer.
interface MutedTargetWire {
    target_type: string;
    target_id: string;
    chat_type?: number;
    categories?: string[];
    label?: string;
}

interface NotificationPreferenceWire {
    master_enabled: boolean;
    enable_chats: boolean;
    enable_thread_replies: boolean;
    enable_mentions: boolean;
    enable_task_comments: boolean;
    enable_inbox: boolean;
    category_settings?: Record<string, boolean>;
    muted_chats: Array<{ chat_type: number; chat_id: string; chat_name?: string }>;
    muted_targets?: MutedTargetWire[];
    ts_updated_at?: string;
}

const fromWire = (wire: NotificationPreferenceWire): NotificationPreference => ({
    masterEnabled: wire.master_enabled,
    enableChats: wire.enable_chats,
    enableThreadReplies: wire.enable_thread_replies,
    enableMentions: wire.enable_mentions,
    enableTaskComments: wire.enable_task_comments,
    enableInbox: wire.enable_inbox,
    categorySettings: wire.category_settings ?? {},
    mutedChats: (wire.muted_chats || []).map((m) => ({
        chatType: m.chat_type,
        chatId: m.chat_id,
        ...(m.chat_name ? { chatName: m.chat_name } : {}),
    })),
    mutedTargets: (wire.muted_targets || []).map((t) => ({
        targetType: t.target_type as MutedTargetRef["targetType"],
        targetId: t.target_id,
        ...(t.chat_type !== undefined ? { chatType: t.chat_type } : {}),
        ...(t.categories && t.categories.length
            ? { categories: t.categories as MutedTargetRef["categories"] }
            : {}),
        ...(t.label ? { label: t.label } : {}),
    })),
});

// PATCH-style: only fields that are provided are sent over the wire. The
// backend uses partial=True so unspecified fields keep their current value.
export const toWire = (
    patch: Partial<NotificationPreference>
): Partial<NotificationPreferenceWire> => {
    const wire: Partial<NotificationPreferenceWire> = {};
    if (patch.masterEnabled !== undefined) wire.master_enabled = patch.masterEnabled;
    if (patch.enableChats !== undefined) wire.enable_chats = patch.enableChats;
    if (patch.enableThreadReplies !== undefined)
        wire.enable_thread_replies = patch.enableThreadReplies;
    if (patch.enableMentions !== undefined) wire.enable_mentions = patch.enableMentions;
    if (patch.enableTaskComments !== undefined)
        wire.enable_task_comments = patch.enableTaskComments;
    if (patch.enableInbox !== undefined) wire.enable_inbox = patch.enableInbox;
    if (patch.categorySettings !== undefined) {
        // JSON field replace: always send the FULL map, never a single-key
        // delta (`partial=True` only protects top-level fields).
        wire.category_settings = { ...patch.categorySettings };
    }
    if (patch.mutedChats !== undefined) {
        wire.muted_chats = patch.mutedChats.map((m) => ({
            chat_type: m.chatType,
            chat_id: m.chatId,
            ...(m.chatName ? { chat_name: m.chatName } : {}),
        }));
    }
    if (patch.mutedTargets !== undefined) {
        wire.muted_targets = patch.mutedTargets.map((t) => ({
            target_type: t.targetType,
            target_id: t.targetId,
            ...(t.chatType !== undefined ? { chat_type: t.chatType } : {}),
            ...(t.categories && t.categories.length ? { categories: t.categories } : {}),
            ...(t.label ? { label: t.label } : {}),
        }));
    }
    return wire;
};

export const getNotificationPreferences = async (
    accessToken: string | null | undefined
): Promise<NotificationPreference> => {
    const api = authApi(accessToken);
    if (!api) return DEFAULT_NOTIFICATION_PREFERENCE;
    try {
        const res = await api.get<NotificationPreferenceWire>("/user/notification-preferences/");
        return fromWire(res.data);
    } catch (err) {
        console.warn("[notifications] getNotificationPreferences failed", err);
        return DEFAULT_NOTIFICATION_PREFERENCE;
    }
};

export const updateNotificationPreferences = async (
    accessToken: string | null | undefined,
    patch: Partial<NotificationPreference>
): Promise<NotificationPreference | null> => {
    const api = authApi(accessToken);
    if (!api) return null;
    try {
        const res = await api.put<NotificationPreferenceWire>(
            "/user/notification-preferences/",
            toWire(patch)
        );
        return fromWire(res.data);
    } catch (err) {
        console.warn("[notifications] updateNotificationPreferences failed", err);
        return null;
    }
};

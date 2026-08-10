import { Socket } from "socket.io-client";

import { addInboxItem } from "../../../features/admin/services/addInboxItem";
import { addUser } from "../../../features/admin/services/addUser";
import {
    v3MessageToLegacyChatPayload,
    v3MessageToLegacyThreadPayload,
} from "../../../features/chat/adapters/v3MessageToNotification";
import { inboxItemNamesAMissingChat } from "../../../features/inbox/utils/resolveInboxTarget";
import { emitTaskTouched } from "../../../features/tasks/services/taskEvents";
import { NotificationManager } from "../../../services/notifications/notificationManager";
import {
    buildActivityIntent,
    buildIntentFromMessage,
} from "../../../services/notifications/notificationRouter";
import { UserProps } from "../../../types/admin";
import { Message as V3Message } from "../../../types/channel";
import { ActivityMessageProps, MessageProps } from "../../../types/chat";
import { InboxItemProps } from "../../../types/common";
import { ChatManagementState } from "../../chats/useChatManagement";
import { dispatchSelfEcho } from "../selfEchoEvent";
import { TeamManagementState } from "../useTeamManagement";
import { handleActivityMessage } from "./activity-handlers";

export const setupWebSocketHandlers = (
    socket: Socket,
    myself: UserProps,
    accessToken: string | null,
    currentProject: any,
    currentPreviewTaskId: number,
    setIsTaskUpdatedBySomeone: (value: boolean) => void,
    setIsTaskCommentUpdated: (value: { isUpdate: boolean; scrollToBottom: boolean }) => void,
    funcSetInboxItems: () => void,
    useCM: ChatManagementState,
    useTEM: TeamManagementState,
    notificationManager?: NotificationManager
) => {
    socket.on("connect_error", (err) => {
        console.error("WS connection error", err.message);
    });

    socket.on("auth_error", (data) => {
        console.error("Authentication Error:", data.message);
    });

    // v3 activity → web notification bridge. `handleV3Activity` (the
    // socket router entry point for `activity.created` on the /v3
    // namespace) writes the activity to IDB and dispatches the
    // `v3:activity:created` window event with `detail.activity` set to
    // the legacy-shaped row. Re-use the existing `buildActivityIntent`
    // + `notificationManager.notify` path here so the web notification
    // is the same as the legacy one.
    if (notificationManager) {
        // v3 activity (mention / task-comment) → existing buildActivityIntent.
        const onV3Activity = (e: Event) => {
            try {
                const detail = (e as CustomEvent<{ activity?: ActivityMessageProps }>).detail;
                if (!detail?.activity) return;
                const intent = buildActivityIntent(detail.activity, myself, useTEM, useCM);
                if (intent) notificationManager.notify(intent);
            } catch (err) {
                console.warn("[notifications] v3 activity router error", err);
            }
        };
        // v3 chat message arrival → buildChatIntent / buildThreadIntent.
        // socketRouter dispatches `v3:message:created` for every live
        // `message.created` socket event. Thread replies and top-level
        // messages route through different builders to match the
        // legacy semantics (`chats` vs `thread_replies` categories).
        const onV3Message = (e: Event) => {
            try {
                const detail = (e as CustomEvent<{ message?: V3Message }>).detail;
                const m = detail?.message;
                if (!m) return;
                // Skip self-sends — the legacy intent builders also
                // skip these, but a self-skip here avoids the extra
                // snapshot lookups inside the adapter for a no-op call.
                if (m.sender && m.sender.userId === myself.userId) return;
                if (m.isThreadReply) {
                    const payload = v3MessageToLegacyThreadPayload(m, myself);
                    const intent = buildIntentFromMessage(payload, myself, useTEM, useCM);
                    if (intent) notificationManager.notify(intent);
                } else {
                    const payload = v3MessageToLegacyChatPayload(m, myself);
                    const intent = buildIntentFromMessage(payload, myself, useTEM, useCM);
                    if (intent) notificationManager.notify(intent);
                }
            } catch (err) {
                console.warn("[notifications] v3 chat router error", err);
            }
        };
        window.addEventListener("v3:activity:created", onV3Activity);
        window.addEventListener("v3:message:created", onV3Message);
        // Stash off-handles on the socket so cleanup can detach both.
        (socket as Socket & { _v3NotifOff?: () => void })._v3NotifOff = () => {
            window.removeEventListener("v3:activity:created", onV3Activity);
            window.removeEventListener("v3:message:created", onV3Message);
        };
    }

    socket.on("message", async (message) => {
        // Run the notification router alongside the existing data-sync
        // dispatch. Failures here must never break sync, hence the
        // try/catch.
        if (notificationManager) {
            try {
                const intent = buildIntentFromMessage(message, myself, useTEM, useCM);
                if (intent) notificationManager.notify(intent);
            } catch (err) {
                console.warn("[notifications] router error", err);
            }
        }

        if (message.wsType === "chat") {
            // v3 cutover: chat events now flow through the `/v3`
            // namespace via channelService — this legacy `/` namespace
            // dispatch is disabled to prevent bleed. The bleed bug
            // it caused: handleRegularMessage / handleThreadMessage
            // call `useCM.setAllChats((prev) => [legacyChat, ...prev])`
            // with `chatId: String(legacy_int)`. Those integer-keyed
            // AllChatProps would then live alongside v3 UUID-keyed
            // chats in the same list. Any subsequent
            // `channelService.send(chat.chatId, ...)` against one of
            // those legacy-keyed entries 404'd at
            // `/api/v3/channels/{int}/messages/` because the v3 URL
            // pattern is `<uuid:channel_id>`.
            //
            // Trade-off: legacy-only chats (no v3 Channel mirror row)
            // will no longer appear in the chat list. Resolution:
            // either run `backfill_v3_channels` (Track B) so each
            // legacy chat gets a v3 Channel UUID, or wipe legacy data
            // and start fresh via the v3 creation path.
            //
            // Notification routing above still runs — the
            // notificationManager.notify call doesn't mutate React
            // state and only surfaces toasts / push notifications.
            return;
        } else if (message.wsType === "task") {
            if (setIsTaskCommentUpdated) {
                setIsTaskCommentUpdated({ isUpdate: true, scrollToBottom: false });
            }

            // Scoped refresh signal: carries the task id so TaskPreview
            // only refetches comments/activities when the touched task
            // is the one it's showing. The global flag above stays for
            // its other consumers (chip bump reset in the edit editor);
            // the preview no longer keys off it.
            emitTaskTouched(Number(message.taskId), "comment");

            // Live-update the PM bubble's `taskCommentCount` chip. Without
            // this, the chip stays stale until the user refreshes the
            // page (the backend only computes the count on history
            // fetches). Two of the three write paths move the count:
            // POSTs grow it and DELETEs shrink it; PUTs are edits
            // (`isEdited: true`) and leave it alone.
            //
            // The same `wsType: "task"` event is broadcast back to the
            // sender too (Flask-SocketIO `send` includes self by
            // default), so the same handler updates both author and
            // observers — no separate optimistic path needed.
            //
            // New comments derive the total from `message.commentId`.
            // The backend assigns `comment_id = current_count + 1` on
            // POST (see `TaskCommentsView.post`), so `commentId` equals
            // the post-insert total. Using it with `Math.max` makes the
            // bump idempotent against socket replays and out-of-order
            // delivery (e.g. if the parent-message broadcast already set
            // the count to the new value).
            //
            // Deletes can't reuse that trick twice over: `commentId` is a
            // claimed sequence slot, not a total (deleting #5 of 5 would
            // "bump" the chip right back to 5), and a shrink can't be
            // expressed as a `Math.max` at all. So the delete broadcast
            // carries the server's authoritative post-delete count and we
            // SET it. Ordering: a delete arriving late can only be
            // corrected by the next channel resync, which is the same
            // exposure the POST path already carries.
            const taskId = message.taskId;
            const newTotal = Number(message.commentId);
            const deletedTotal = Number(message.taskCommentCount);
            const isCommentDeleted =
                message.isDeleted === true && Number.isFinite(deletedTotal) && deletedTotal >= 0;
            const isNewComment =
                message.isDeleted !== true &&
                message.isEdited !== true &&
                message.isReactionUpdated !== true &&
                Number.isFinite(newTotal) &&
                newTotal > 0;
            const resolveCount = (current: number | undefined): number =>
                isCommentDeleted ? deletedTotal : Math.max(current ?? 0, newTotal);
            if (taskId != null && (isNewComment || isCommentDeleted)) {
                const bumpMessages = (msgs: MessageProps[]): MessageProps[] => {
                    let mutated = false;
                    const next = msgs.map((m) => {
                        if (m.taskId !== taskId) return m;
                        const nextCount = resolveCount(m.taskCommentCount);
                        if (nextCount === m.taskCommentCount) return m;
                        mutated = true;
                        return { ...m, taskCommentCount: nextCount };
                    });
                    return mutated ? next : msgs;
                };

                if (useCM.currentMainChat) {
                    const next = bumpMessages(useCM.currentMainChat.messages);
                    if (next !== useCM.currentMainChat.messages) {
                        useCM.setCurrentMainChat({
                            ...useCM.currentMainChat,
                            messages: next,
                            notMove: true,
                        });
                    }
                }

                if (useCM.currentSubChat) {
                    const next = bumpMessages(useCM.currentSubChat.messages);
                    if (next !== useCM.currentSubChat.messages) {
                        useCM.setCurrentSubChat({
                            ...useCM.currentSubChat,
                            messages: next,
                            notMove: true,
                        });
                    }
                }

                // Also keep the chat-list summary's latest message in
                // sync — covers the case where the latest PM bubble in
                // the chat list happens to reference this task.
                useCM.setAllChats((prev) =>
                    prev.map((chat) => {
                        const latest = chat.latestMessage;
                        if (!latest || latest.taskId !== taskId) return chat;
                        const nextCount = resolveCount(latest.taskCommentCount);
                        if (nextCount === latest.taskCommentCount) return chat;
                        return {
                            ...chat,
                            latestMessage: { ...latest, taskCommentCount: nextCount },
                        };
                    })
                );
            }
        } else if (message.wsType === "activity") {
            await handleActivityMessage(message, myself, useCM);
        } else if (message.wsType === "userStatus") {
            const user: UserProps = message.user;
            await addUser(user);
            // A `userStatus` naming ME is a "self-echo": this beat came from one
            // of my OWN other devices (the server rebroadcasts every beat to the
            // team room I'm also in). It's the only live signal that I changed my
            // appear-offline / custom status / notification pause elsewhere.
            // `useSelfEchoReconcile` answers it by re-fetching the authoritative
            // server value — we pass the echoed fields only so it can detect a
            // divergence, never adopt them directly.
            if (user.userId && user.userId === myself.userId) {
                dispatchSelfEcho({
                    userId: user.userId,
                    isOfflineForced: user.isOfflineForced,
                    customStatus: user.customStatus,
                    isNotificationsPaused: user.isNotificationsPaused,
                });
            }
        } else if (message.wsType === "inbox") {
            const inboxItem: InboxItemProps = message.data;
            if (message.alreadyExist === false) {
                await addInboxItem(inboxItem);
                funcSetInboxItems();
                // An activity announcing "you were added to / approved to join
                // X" is proof we're now a member of X — but nothing pushes the
                // new channel to us. A project add goes through
                // `POST /project/join/` and the `_sync_pm_channel_member`
                // Django signal, which emits nothing to any socket, and
                // `allChats` otherwise only reloads on boot and on wake. So an
                // added user's chat list stays stale for the entire session:
                // the project chat never appears in their sidebar, and this
                // card's target chip has no row to resolve against.
                //
                // This card IS the notification the chat list never got. Fire
                // one refresh when it names a chat we don't hold. The
                // membership is already committed server-side — the notice is
                // only emitted after every `POST /project/join/` resolves — so
                // this can't race ahead of it.
                if (inboxItemNamesAMissingChat(inboxItem, useCM.allChats)) {
                    void useCM.funcSetAllChats();
                }
            }
        }
    });
};

export const cleanupWebSocketHandlers = (socket: Socket) => {
    socket.off("message");
    socket.off("connect");
    socket.off("disconnect");
    socket.off("connect_error");
    socket.off("auth_error");
    // Detach the v3 notification window listeners we attached in
    // setupWebSocketHandlers, if any.
    const off = (socket as Socket & { _v3NotifOff?: () => void })._v3NotifOff;
    if (off) {
        off();
        delete (socket as Socket & { _v3NotifOff?: () => void })._v3NotifOff;
    }
};

/*
 * PUNCH LIST (v3 chatId migration):
 * Legacy WS events carry numeric `chatId` on `NewMessageProps` /
 * `MessageProps`, but `ChatProps.chatId` is now `string`. Wherever the
 * two cross we wrap the legacy int side with `String(...)` so the
 * compiler is happy; at runtime the legacy `/` socket never carries
 * UUIDs, so these handlers will never match against v3 chats. The
 * whole file is slated for deletion when the v3 socket router (see
 * `socketRouter.ts`) replaces the legacy `/` namespace handlers.
 */
import { Socket } from "socket.io-client";

import { ChatService } from "../../../db/services/chat.service";
import { invalidateCachedFullTask } from "../../../db/services/task-full.service";
import { chatChannel } from "../../../db/workers/channels";
import { addChat } from "../../../features/chat/services/addChat";
import { addMessage } from "../../../features/chat/services/addMessage";
import { addThreadMessage } from "../../../features/chat/services/addThreadMessage";
import { loadSpecificThreadMessages } from "../../../features/chat/services/loadSpecificThreadMessages";
import { UserProps } from "../../../types/admin";
import {
    AllChatProps,
    MessageProps,
    NewMessageProps,
    NewThreadMessageProps,
    ThreadMessageProps,
    ThreadProps,
} from "../../../types/chat";
import { ProjectProps } from "../../../types/tasks";
import { emptyDmPartnerUser } from "../../../utils/defaultProps";
import { ChatManagementState } from "../../chats/useChatManagement";
import {
    makeDMUpdatedChat,
    makeGMUpdatedChat,
    makePMUpdatedChat,
    updateAllChat,
} from "../utils/chat-updaters";
import { analyzeMessageContext, MessageContext } from "../utils/message-context";

export const handleThreadMessage = async (
    newMessage: NewThreadMessageProps,
    myself: UserProps,
    accessToken: string | null,
    useCM: ChatManagementState
) => {
    const newThreadMessage: ThreadMessageProps = {
        chatId: newMessage.chatId,
        chatType: newMessage.chatType,
        content: newMessage.content,
        contentText: newMessage.contentText,
        messageId: newMessage.messageId,
        messageIdWithChatIdAndThreadId: `${newMessage.chatId}-${newMessage.threadId}-${newMessage.messageId}`,
        reactions: newMessage.reactions,
        sender: newMessage.sender,
        systemUserId: newMessage.systemUserId,
        taskId: newMessage.taskId,
        threadId: newMessage.threadId,
        tsSent: newMessage.tsSent,
        tsUpdated: newMessage.tsUpdated,
    };

    // PUNCH LIST: `analyzeMessageContext` types its first arg as
    // `NewMessageProps`, but the legacy thread-message path passes
    // `NewThreadMessageProps`. They share most fields used by the
    // analyzer (sender, chatType, isReactionUpdated, etc.) — cast at
    // the call site rather than widening the analyzer's signature
    // until the thread shape is reconciled in a follow-on session.
    const context = analyzeMessageContext(newMessage as unknown as NewMessageProps, myself);

    if (newMessage.isDeleted) {
        if (
            useCM.currentThreadChat &&
            newMessage.chatType === useCM.currentThreadChat.chatType &&
            newMessage.chatId === useCM.currentThreadChat.chatId &&
            newMessage.threadId === useCM.currentThreadChat.threadId
        ) {
            useCM.setCurrentThreadChat({
                ...useCM.currentThreadChat,
                messages: useCM.currentThreadChat.messages.filter(
                    (m) => m.messageId !== newMessage.messageId
                ),
                notMove: true,
            });
        }
        return;
    }

    if (newMessage.isReactionUpdated) {
        if (
            useCM.currentThreadChat &&
            newMessage.chatId === useCM.currentThreadChat.chatId &&
            newMessage.threadId === useCM.currentThreadChat.threadId
        ) {
            useCM.setCurrentThreadChat({
                ...useCM.currentThreadChat,
                messages: useCM.currentThreadChat.messages.map((m) =>
                    m.messageId === newThreadMessage.messageId ? newThreadMessage : m
                ),
                notMove: true,
            });
        }
        return;
    }

    if (newMessage.isEdited) {
        if (
            context.fromMe ||
            context.toMe ||
            newMessage.chatType === 2 ||
            newMessage.chatType === 3 ||
            newMessage.chatType === 4
        ) {
            await addThreadMessage(newThreadMessage, newMessage.chatType);
            if (
                useCM.currentThreadChat &&
                newMessage.chatId === useCM.currentThreadChat.chatId &&
                newMessage.threadId === useCM.currentThreadChat.threadId
            ) {
                const updatedMessages = await loadSpecificThreadMessages(
                    myself,
                    useCM.currentThreadChat.chatType,
                    useCM.currentThreadChat.chatId,
                    useCM.currentThreadChat.threadId,
                    accessToken
                );
                useCM.setCurrentThreadChat({
                    ...useCM.currentThreadChat,
                    messages: updatedMessages,
                    notMove: true,
                });
            }
        }
        return;
    }

    // Handle new thread message (from others)
    const isIncomingForMe =
        (!context.fromMe && context.toMe) ||
        (!context.fromMe &&
            (newMessage.chatType === 2 || newMessage.chatType === 3 || newMessage.chatType === 4));

    if (isIncomingForMe) {
        await addThreadMessage(newThreadMessage, newMessage.chatType);

        if (
            useCM.currentThreadChat &&
            newMessage.chatId === useCM.currentThreadChat.chatId &&
            newMessage.threadId === useCM.currentThreadChat.threadId
        ) {
            const hasMessage = useCM.currentThreadChat.messages.some(
                (m) => m.messageId === newThreadMessage.messageId
            );
            if (!hasMessage) {
                const updatedThreadChat: ThreadProps = {
                    chatId: newMessage.chatId,
                    chatName:
                        newMessage.chatType === 1
                            ? newMessage.sender.userName
                            : newMessage.chatName,
                    chatType: newMessage.chatType,
                    dmPartnerUser:
                        newMessage.chatType === 1
                            ? newMessage.sender
                            : useCM.currentThreadChat.dmPartnerUser,
                    messages: [...useCM.currentThreadChat.messages, newThreadMessage],
                    notMove: true,
                    systemUserId: newMessage.systemUserId,
                    taskId: newThreadMessage.taskId,
                    threadId: newThreadMessage.threadId,
                    TSLastMessage: newThreadMessage.tsSent,
                };
                useCM.setCurrentThreadChat(updatedThreadChat);
            }
        }
    }
};

export const handleRegularMessage = async (
    newMessage: NewMessageProps,
    myself: UserProps,
    currentProject: ProjectProps | null,
    currentPreviewTaskId: number,
    setIsTaskUpdatedBySomeone: (value: boolean) => void,
    useCM: ChatManagementState,
    socket: Socket
) => {
    // Keys sorted alphabetically (case-insensitive) per `sort-keys`.
    // Annotation comments:
    //   - `messageIdWithChatId`: PM is keyed by task (one bubble per
    //     task; a task update PUTs the same row). Normalize null /
    //     undefined `taskId` to -1 so the FE key matches the backend
    //     serializer in `pm_delta_views.py`; otherwise a socket-cached
    //     row at `{chatId}-null` would not collide with the delta-
    //     fetched row at `{chatId}--1` and the bubble would duplicate
    //     after the next reload.
    //   - `displayId`: human-readable task id ("<code>-<n>") off the
    //     wire. Without forwarding it, the chip on the PM task-card
    //     bubble (`BubbleUserName`) falls back to "#<taskId>" for every
    //     live-pushed PM message.
    //   - `taskCommentCount`: PM under-bar chip refreshes without a
    //     full page reload. Without this, `addMessage` writes IDB
    //     without the field and the subsequent `makePMUpdatedChat`
    //     rebuild reads a stale count, overriding the in-memory live-
    //     bump from the `wsType: "task"` handler — chip flickers e.g.
    //     6 → 7 → 6.
    const newChatMessage: MessageProps = {
        chatId: newMessage.chatId,
        chatType: newMessage.chatType,
        content: newMessage.content,
        contentText: newMessage.contentText,
        displayId: newMessage.displayId,
        messageId: newMessage.messageId,
        messageIdWithChatId:
            newMessage.chatType === 3
                ? `${newMessage.chatId}-${newMessage.taskId ?? -1}`
                : `${newMessage.chatId}-${newMessage.messageId}`,
        numReplies: newMessage.numReplies,
        reactions: newMessage.reactions,
        sender: newMessage.sender,
        systemUserId: newMessage.systemUserId,
        taskCommentCount: newMessage.taskCommentCount,
        taskId: newMessage.taskId,
        taskStatus: newMessage.taskStatus,
        tsSent: newMessage.tsSent,
        tsUpdated: newMessage.tsUpdated,
    };

    const context = analyzeMessageContext(newMessage, myself);

    if (newMessage.isDeleted) {
        await handleMessageDeletion(newMessage, useCM);
        return;
    }

    await addMessage(newChatMessage, newMessage.chatType);

    if (newMessage.chatType === 1) {
        await handleDMMessage(newMessage, newChatMessage, context, myself, useCM, socket);
    } else if (newMessage.chatType === 2) {
        await handleGMMessage(newMessage, newChatMessage, context, useCM, socket);
    } else if (newMessage.chatType === 3) {
        await handlePMMessage(
            newMessage,
            newChatMessage,
            context,
            currentProject,
            currentPreviewTaskId,
            setIsTaskUpdatedBySomeone,
            useCM
        );
    } else if (newMessage.chatType === 4) {
        await handleMDMMessage(newMessage, newChatMessage, context, useCM, socket);
    }
};

const handleMessageDeletion = async (newMessage: NewMessageProps, useCM: ChatManagementState) => {
    const chatService = new ChatService();

    // Delete message from indexedDB based on chat type
    if (newMessage.chatType === 1) {
        await chatService.deleteDMMessage(newMessage.chatId, newMessage.messageId);
    } else if (newMessage.chatType === 2) {
        await chatService.deleteGMMessage(newMessage.chatId, newMessage.messageId);
    } else if (newMessage.chatType === 3) {
        await chatService.deletePMMessage(
            newMessage.chatId,
            newMessage.messageId,
            newMessage.taskId || undefined
        );
    } else if (newMessage.chatType === 4) {
        await chatService.deleteMDMMessage(newMessage.chatId, newMessage.messageId);
    }

    // Update current chat if it matches
    if (
        useCM.currentMainChat &&
        newMessage.chatType === useCM.currentMainChat.chatType &&
        String(newMessage.chatId) === useCM.currentMainChat.chatId
    ) {
        useCM.setCurrentMainChat({
            ...useCM.currentMainChat,
            messages: useCM.currentMainChat.messages.filter(
                (m) => m.messageId !== newMessage.messageId
            ),
            notMove: true,
        });
    } else if (
        useCM.currentSubChat &&
        newMessage.chatType === useCM.currentSubChat.chatType &&
        String(newMessage.chatId) === useCM.currentSubChat.chatId
    ) {
        useCM.setCurrentSubChat({
            ...useCM.currentSubChat,
            messages: useCM.currentSubChat.messages.filter(
                (m) => m.messageId !== newMessage.messageId
            ),
            notMove: true,
        });
    }
};

const handleDMMessage = async (
    newMessage: NewMessageProps,
    newChatMessage: MessageProps,
    context: MessageContext,
    myself: UserProps,
    useCM: ChatManagementState,
    socket: Socket
) => {
    const updatedChat = await makeDMUpdatedChat(newMessage, myself);

    if (newMessage.isReactionUpdated) {
        if (context.fromMe || context.toMe) {
            updateMessageInCurrentChat(newChatMessage, useCM);
        }
        return;
    }

    if (newMessage.isEdited) {
        if (context.fromMe || context.toMe) {
            updateCurrentChat(updatedChat, useCM);
        }
    } else {
        if (!context.fromMe && context.toMe) {
            if (!newMessage.isReactionUpdated) {
                await updateAllChat(
                    updatedChat,
                    newChatMessage,
                    useCM.allChats,
                    useCM.funcSetAllChats
                );
            }
            updateCurrentChat(updatedChat, useCM);

            if (newMessage.messageId === 1 && updatedChat.dmPartnerUser) {
                socket.emit("join", {
                    chatType: 1,
                    dmPartnerUserId: updatedChat.dmPartnerUser.userId,
                    joiningCGId: updatedChat.chatId,
                    joiningCGName: updatedChat.chatName,
                });
            }
        } else if (context.fromMe && newMessage.messageId === 1) {
            const newDMChat = await makeDMUpdatedChat(
                {
                    ...newMessage,
                    lastReadMessageId: newMessage.lastReadMessageId + 1,
                },
                myself
            );

            if (!newMessage.isReactionUpdated) {
                await updateAllChat(
                    newDMChat,
                    newChatMessage,
                    useCM.allChats,
                    useCM.funcSetAllChats
                );
            }
            useCM.setCurrentMainChat(newDMChat);

            if (newDMChat.dmPartnerUser) {
                socket.emit("join", {
                    chatType: 1,
                    dmPartnerUserId: newDMChat.dmPartnerUser.userId,
                    joiningCGId: newDMChat.chatId,
                    joiningCGName: newDMChat.chatName,
                });
            }
        }
    }
};

const handleGMMessage = async (
    newMessage: NewMessageProps,
    newChatMessage: MessageProps,
    context: MessageContext,
    useCM: ChatManagementState,
    socket: Socket
) => {
    const updatedChat = await makeGMUpdatedChat(newMessage, useCM.allChats);

    if (newMessage.isReactionUpdated) {
        updateMessageInCurrentChat(newChatMessage, useCM);
        return;
    }

    if (newMessage.isEdited) {
        updateCurrentChat(updatedChat, useCM);
    } else if (!context.fromMe) {
        // Unknown GM = the creator just added the user via `gm_members_added`.
        // Mirror the MDM branch: emit "join" so the socket enters the
        // `gm-{id}` room (the room is reconstructed from `gm/ids/` only on
        // reconnect, so without this real-time messages would be missed
        // until the next refresh).
        const isNewGM = !useCM.allChats.some(
            (c) => c.chatId === String(newMessage.chatId) && c.chatType === 2
        );

        if (useCM.allChats.length > 0 && !newMessage.isReactionUpdated) {
            await updateAllChat(
                updatedChat,
                newChatMessage,
                useCM.allChats,
                useCM.funcSetAllChats
            );
        }
        updateCurrentChat(updatedChat, useCM);

        if (isNewGM && socket) {
            socket.emit("join", {
                chatType: 2,
                dmPartnerUser: emptyDmPartnerUser,
                joiningCGId: newMessage.chatId,
                joiningCGName: newMessage.chatName,
            });
        }
    }
};

const handleMDMMessage = async (
    newMessage: NewMessageProps,
    newChatMessage: MessageProps,
    context: MessageContext,
    useCM: ChatManagementState,
    socket: Socket
) => {
    if (newMessage.isEdited) {
        updateMDMMessageInCurrentChat(newMessage, newChatMessage, useCM);
    } else if (newMessage.isReactionUpdated) {
        updateMDMMessageInCurrentChat(newMessage, newChatMessage, useCM);
    } else if (context.fromMe) {
        await ensureMDMInAllChats(newMessage, newChatMessage, useCM);
        if (newMessage.messageId === 1) {
            updateMDMCurrentChatForInitialMessage(newMessage, newChatMessage, useCM);
        }
    } else {
        const isNewMDM = !useCM.allChats.some(
            (c) => c.chatId === String(newMessage.chatId) && c.chatType === 4
        );
        await ensureMDMInAllChats(newMessage, newChatMessage, useCM);
        appendMDMMessageToCurrentChat(newMessage, newChatMessage, useCM);

        if (isNewMDM && socket) {
            socket.emit("join", {
                chatType: 4,
                joiningCGId: newMessage.chatId,
                joiningCGName: newMessage.chatName,
            });
        }
    }
};

const ensureMDMInAllChats = async (
    newMessage: NewMessageProps,
    newChatMessage: MessageProps,
    useCM: ChatManagementState
) => {
    const defaultPartner = {
        avatarImgPath: "",
        customStatus: "",
        teamId: "",
        teamName: "",
        tsJoined: "",
        tsLastSeen: "",
        userEmail: "",
        userId: "",
        userName: "",
    };

    // Keys sorted alphabetically (case-insensitive) per the project's
    // `sort-keys` lint rule. Two inline notes carry forward:
    //   - `chatId: String(newMessage.chatId)` — see file-header
    //     punch-list note (v3 chatId boundary).
    //   - `lastReadMessageId: ... || ""` — empty string is the
    //     v3-flipped "no last-read" sentinel (replaces legacy `-1`).
    const buildAllChat = (existing?: AllChatProps): AllChatProps => ({
        chatId: String(newMessage.chatId),
        chatName: newMessage.chatName,
        chatType: 4,
        dmPartnerUser: existing?.dmPartnerUser || defaultPartner,
        isPinned: existing?.isPinned,
        lastReadMessageId: existing?.lastReadMessageId || "",
        latestMessage: newChatMessage,
        latestMessageText: newChatMessage.contentText,
        mdmMembers: existing?.mdmMembers,
        profileImagePath: existing?.profileImagePath,
        systemUserId: newMessage.systemUserId || existing?.systemUserId,
        tsLastAllReadActivity: existing?.tsLastAllReadActivity,
        TSLastMessage: newChatMessage.tsSent,
    });

    // Read the existing row from IDB rather than `useCM.allChats` — the
    // WS handler closure can be stale (the backend broadcasts MDM
    // messages twice: once to the mdm room and once to each member's
    // personal room, so this handler often fires in rapid succession
    // before React's state has re-rendered the dep-array re-subscribe).
    // IDB is the durable source of truth for fields the WS payload
    // doesn't carry — most importantly `mdmMembers`, which would
    // otherwise be silently dropped on the upsert and surface as the
    // generic People icon next time the chat list reloads from IDB.
    const existingFromIDB = (await chatChannel.request("popSpecificChat", {
        chatId: newMessage.chatId,
        chatType: 4,
    })) as AllChatProps | null;

    const chatForIDB = buildAllChat(existingFromIDB ?? undefined);
    await addChat(chatForIDB, 4);

    useCM.setAllChats((prev: AllChatProps[]) => {
        const existing = prev.find(
            (c) => c.chatId === String(newMessage.chatId) && c.chatType === 4
        );
        // Prefer the live React state when available, fall back to IDB.
        const updatedChat = buildAllChat(existing ?? existingFromIDB ?? undefined);
        if (existing) {
            return prev.map((c) =>
                c.chatId === String(newMessage.chatId) && c.chatType === 4 ? updatedChat : c
            );
        }
        return [updatedChat, ...prev];
    });
};

const updateMDMCurrentChatForInitialMessage = (
    newMessage: NewMessageProps,
    newChatMessage: MessageProps,
    useCM: ChatManagementState
) => {
    if (
        useCM.currentMainChat &&
        String(newMessage.chatId) === useCM.currentMainChat.chatId &&
        useCM.currentMainChat.chatType === 4
    ) {
        const hasMessage = useCM.currentMainChat.messages.some(
            (m) => m.messageId === newChatMessage.messageId
        );
        if (!hasMessage) {
            useCM.setCurrentMainChat({
                ...useCM.currentMainChat,
                latestMessage: newChatMessage,
                latestMessageText: newMessage.contentText,
                messages: [...useCM.currentMainChat.messages, newChatMessage],
                notMove: true,
                TSLastMessage: newMessage.tsSent,
            });
        }
    }
};

const appendMDMMessageToCurrentChat = (
    newMessage: NewMessageProps,
    newChatMessage: MessageProps,
    useCM: ChatManagementState
) => {
    if (
        useCM.currentMainChat &&
        String(newMessage.chatId) === useCM.currentMainChat.chatId &&
        useCM.currentMainChat.chatType === 4
    ) {
        const hasMessage = useCM.currentMainChat.messages.some(
            (m) => m.messageId === newChatMessage.messageId
        );
        if (!hasMessage) {
            useCM.setCurrentMainChat({
                ...useCM.currentMainChat,
                latestMessage: newChatMessage,
                latestMessageText: newMessage.contentText,
                messages: [...useCM.currentMainChat.messages, newChatMessage],
                notMove: true,
                TSLastMessage: newMessage.tsSent,
            });
        }
    } else if (
        useCM.currentSubChat &&
        String(newMessage.chatId) === useCM.currentSubChat.chatId &&
        useCM.currentSubChat.chatType === 4
    ) {
        const hasMessage = useCM.currentSubChat.messages.some(
            (m) => m.messageId === newChatMessage.messageId
        );
        if (!hasMessage) {
            useCM.setCurrentSubChat({
                ...useCM.currentSubChat,
                latestMessage: newChatMessage,
                latestMessageText: newMessage.contentText,
                messages: [...useCM.currentSubChat.messages, newChatMessage],
                notMove: true,
                TSLastMessage: newMessage.tsSent,
            });
        }
    }
};

const updateMDMMessageInCurrentChat = (
    newMessage: NewMessageProps,
    newChatMessage: MessageProps,
    useCM: ChatManagementState
) => {
    if (
        useCM.currentMainChat &&
        String(newMessage.chatId) === useCM.currentMainChat.chatId &&
        useCM.currentMainChat.chatType === 4
    ) {
        useCM.setCurrentMainChat({
            ...useCM.currentMainChat,
            messages: useCM.currentMainChat.messages.map((m) =>
                m.messageId === newChatMessage.messageId ? newChatMessage : m
            ),
            notMove: true,
        });
    } else if (
        useCM.currentSubChat &&
        String(newMessage.chatId) === useCM.currentSubChat.chatId &&
        useCM.currentSubChat.chatType === 4
    ) {
        useCM.setCurrentSubChat({
            ...useCM.currentSubChat,
            messages: useCM.currentSubChat.messages.map((m) =>
                m.messageId === newChatMessage.messageId ? newChatMessage : m
            ),
            notMove: true,
        });
    }
};

const handlePMMessage = async (
    newMessage: NewMessageProps,
    newChatMessage: MessageProps,
    context: MessageContext,
    currentProject: ProjectProps | null,
    currentPreviewTaskId: number,
    setIsTaskUpdatedBySomeone: (value: boolean) => void,
    useCM: ChatManagementState
) => {
    if (
        currentProject &&
        currentProject.projectId === newMessage.project?.projectId &&
        currentPreviewTaskId === newMessage.taskId
    ) {
        setIsTaskUpdatedBySomeone(true);
    }

    // Invalidate the per-task full-data cache whenever a project
    // message carries a taskId, regardless of whether the user is
    // currently previewing that task. Keeps the next `loadSpecificTask`
    // for this id correct after edits made by other clients.
    if (newMessage.taskId != null) {
        await invalidateCachedFullTask(newMessage.taskId);
    }

    const updatedChat = await makePMUpdatedChat(newMessage, useCM.allChats);

    if (newMessage.isReactionUpdated) {
        updateMessageInCurrentChat(newChatMessage, useCM);
        return;
    }

    if (newMessage.isEdited) {
        updateCurrentChat(updatedChat, useCM);
    } else if (!context.fromMe) {
        if (useCM.allChats.length > 0 && !newMessage.isReactionUpdated) {
            await updateAllChat(
                updatedChat,
                newChatMessage,
                useCM.allChats,
                useCM.funcSetAllChats
            );
        }
        updateCurrentChat(updatedChat, useCM);
    }
};

const updateMessageInCurrentChat = (newChatMessage: MessageProps, useCM: ChatManagementState) => {
    if (
        useCM.currentMainChat &&
        String(newChatMessage.chatId) === useCM.currentMainChat.chatId &&
        newChatMessage.chatType === useCM.currentMainChat.chatType
    ) {
        useCM.setCurrentMainChat({
            ...useCM.currentMainChat,
            messages: useCM.currentMainChat.messages.map((m) =>
                m.messageId === newChatMessage.messageId ? newChatMessage : m
            ),
            notMove: true,
        });
    } else if (
        useCM.currentSubChat &&
        String(newChatMessage.chatId) === useCM.currentSubChat.chatId &&
        newChatMessage.chatType === useCM.currentSubChat.chatType
    ) {
        useCM.setCurrentSubChat({
            ...useCM.currentSubChat,
            messages: useCM.currentSubChat.messages.map((m) =>
                m.messageId === newChatMessage.messageId ? newChatMessage : m
            ),
            notMove: true,
        });
    }
};

const updateCurrentChat = (updatedChat: AllChatProps, useCM: ChatManagementState) => {
    // PUNCH LIST (pre-existing latent gap surfaced by removing `any`):
    // `makeXxxUpdatedChat` returns `AllChatProps`, but `setCurrentMainChat`
    // expects `ChatProps` (which adds `messages: MessageProps[]`). The
    // legacy code dropped this through an `any`; the consumer reads
    // `currentMainChat.messages` as undefined, which the existing
    // bubble-list code tolerates because it iterates with `?? []`.
    // The set calls merge with the existing `currentMainChat` so the
    // `messages` array is preserved across the update.
    if (
        useCM.currentMainChat &&
        updatedChat.chatId === useCM.currentMainChat.chatId &&
        updatedChat.chatType === useCM.currentMainChat.chatType
    ) {
        useCM.setCurrentMainChat({ ...useCM.currentMainChat, ...updatedChat });
    } else if (
        useCM.currentSubChat &&
        updatedChat.chatId === useCM.currentSubChat.chatId &&
        updatedChat.chatType === useCM.currentSubChat.chatType
    ) {
        useCM.setCurrentSubChat({ ...useCM.currentSubChat, ...updatedChat });
    }
};

// Chat-channel handlers — runs inside the chat worker.
//
// Consolidates the behavior of the 17 single-purpose chat workers into one
// long-lived worker. Each handler corresponds to one request `type` from
// the ChatRequests contract.

import axios from "axios";

import { defaultDmPartner } from "../../../features/chat/services/constants";
import { loadDMChats } from "../../../features/chat/services/loadDMChats";
import { loadDMHistory } from "../../../features/chat/services/loadDMHistory";
import { loadDMMessagesDelta } from "../../../features/chat/services/loadDMMessagesDelta";
import { loadDMThreadMessagesDelta } from "../../../features/chat/services/loadDMThreadMessagesDelta";
import { loadGMChats } from "../../../features/chat/services/loadGMChats";
import { loadGMHistory } from "../../../features/chat/services/loadGMHistory";
import { loadGMMessagesDelta } from "../../../features/chat/services/loadGMMessagesDelta";
import { loadGMThreadMessagesDelta } from "../../../features/chat/services/loadGMThreadMessagesDelta";
import { loadMDMChats } from "../../../features/chat/services/loadMDMChats";
import { loadMDMHistory } from "../../../features/chat/services/loadMDMHistory";
import { loadMDMMessagesDelta } from "../../../features/chat/services/loadMDMMessagesDelta";
import { loadMDMThreadMessagesDelta } from "../../../features/chat/services/loadMDMThreadMessagesDelta";
import { loadPMChats } from "../../../features/chat/services/loadPMChats";
import { loadPMHistory } from "../../../features/chat/services/loadPMHistory";
import { loadPMMessagesDelta } from "../../../features/chat/services/loadPMMessagesDelta";
import { loadPMThreadMessagesDelta } from "../../../features/chat/services/loadPMThreadMessagesDelta";
import { authApi } from "../../../services/api";
import type { UserProps } from "../../../types/admin";
import {
    ActivityMessageProps,
    AllChatProps,
    ChatProps,
    FlaggedMessageProps,
    MessageProps,
} from "../../../types/chat";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { STORES } from "../../config";
import {
    ChatRepository,
    ChatRepositoryFactory,
    FlaggedRepository,
    MessageRepository,
    ThreadMessageRepository,
} from "../../repositories";
import { ActivityService, ChatService } from "../../services";
import type { ChatRequests } from "../contracts";
import type { HandlerMap } from "../poolWorker";
import { syncWithCheckpoint } from "../utils/syncWithCheckpoint";

const BATCH_SIZE = 1000;

const CHAT_STORE_BY_TYPE: Record<number, string> = {
    1: STORES.DM_CHATS,
    2: STORES.GM_CHATS,
    3: STORES.PM_CHATS,
    4: STORES.MDM_CHATS,
};

const MESSAGE_STORE_BY_TYPE: Record<number, string> = {
    1: STORES.DM_MESSAGES,
    2: STORES.GM_MESSAGES,
    3: STORES.PM_MESSAGES,
    4: STORES.MDM_MESSAGES,
};

const THREAD_STORE_BY_TYPE: Record<number, string> = {
    1: STORES.DM_THREAD_MESSAGES,
    2: STORES.GM_THREAD_MESSAGES,
    3: STORES.PM_THREAD_MESSAGES,
    4: STORES.MDM_THREAD_MESSAGES,
};

// Shared service instances — re-used across requests for the lifetime of the
// worker. The previous one-shot workers allocated these per call.
const chatService = new ChatService();
const flaggedRepo = new FlaggedRepository();

const sortByTSLastMessageDesc = (a: AllChatProps, b: AllChatProps): number =>
    new Date(b.TSLastMessage).getTime() - new Date(a.TSLastMessage).getTime();

const sortByMessageIdAsc = <T extends { messageId: number | string }>(a: T, b: T): number =>
    Number(a.messageId) - Number(b.messageId);

// Build the MDM "latestMessage" fallback when the backend payload doesn't
// include one — kept identical to the prior worker so behavior is unchanged.
const emptyUserProps: UserProps = {
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

const buildMDMChatRow = (mdmChat: ChatProps): AllChatProps => {
    const fallbackTs = mdmChat.TSLastMessage || getLocalCurrentTimestamp();
    const defaultLatestMessage: MessageProps = {
        chatId: mdmChat.chatId,
        chatType: 4,
        content: [],
        contentText: "",
        messageId: 0,
        messageIdWithChatId: `${mdmChat.chatId}-0`,
        numReplies: 0,
        sender: emptyUserProps,
        taskId: null,
        taskStatus: null,
        tsSent: fallbackTs,
        tsUpdated: fallbackTs,
    };
    return {
        chatId: mdmChat.chatId,
        chatName: mdmChat.chatName,
        chatType: 4,
        dmPartnerUser: defaultDmPartner,
        isPinned: mdmChat.isPinned,
        lastReadMessageId: mdmChat.lastReadMessageId ?? -1,
        latestMessage: mdmChat.latestMessage ?? defaultLatestMessage,
        latestMessageText: mdmChat.latestMessageText ?? "",
        mdmMembers: mdmChat.mdmMembers,
        tsLastAllReadActivity: mdmChat.tsLastAllReadActivity,
        TSLastMessage: fallbackTs,
    };
};

const writeDMHistory = async (history: {
    chat_history: ChatProps[];
    flagged_messages: FlaggedMessageProps[];
}): Promise<void> => {
    const dmChatRepo = ChatRepositoryFactory.createDMChatRepository();
    const dmMessageRepo = ChatRepositoryFactory.createDMMessageRepository();
    const dmThreadRepo = ChatRepositoryFactory.createDMThreadMessageRepository();
    await Promise.all([dmChatRepo.clear(), dmMessageRepo.clear(), dmThreadRepo.clear()]);
    if (!history) return;
    if (history.chat_history) {
        const rows: AllChatProps[] = history.chat_history.map((c) => ({
            chatId: c.chatId,
            chatName: c.chatName,
            chatType: 1,
            dmPartnerUser: c.dmPartnerUser,
            isPinned: c.isPinned,
            lastReadMessageId: c.lastReadMessageId,
            latestMessage: c.latestMessage,
            latestMessageText: c.latestMessageText,
            tsLastAllReadActivity: c.tsLastAllReadActivity,
            TSLastMessage: c.TSLastMessage,
        }));
        if (rows.length > 0) await dmChatRepo.batchInsert(rows);
        for (const c of history.chat_history) {
            for (let i = 0; i < c.messages.length; i += BATCH_SIZE) {
                await dmMessageRepo.batchInsertMessages(c.messages.slice(i, i + BATCH_SIZE));
            }
        }
    }
    if (history.flagged_messages?.length) await flaggedRepo.batchInsert(history.flagged_messages);
};

const writeGMHistory = async (history: {
    chat_history: ChatProps[];
    flagged_messages: FlaggedMessageProps[];
}): Promise<void> => {
    const gmChatRepo = ChatRepositoryFactory.createGMChatRepository();
    const gmMessageRepo = ChatRepositoryFactory.createGMMessageRepository();
    const gmThreadRepo = ChatRepositoryFactory.createGMThreadMessageRepository();
    await Promise.all([gmChatRepo.clear(), gmMessageRepo.clear(), gmThreadRepo.clear()]);
    const rows: AllChatProps[] = history.chat_history.map((c) => ({
        chatId: c.chatId,
        chatName: c.chatName,
        chatType: 2,
        dmPartnerUser: defaultDmPartner,
        isPinned: c.isPinned,
        isPrivate: c.isPrivate,
        lastReadMessageId: c.lastReadMessageId,
        latestMessage: c.latestMessage,
        latestMessageText: c.latestMessageText,
        profileImagePath: c.profileImagePath,
        tsLastAllReadActivity: c.tsLastAllReadActivity,
        TSLastMessage: c.TSLastMessage,
    }));
    if (rows.length > 0) await gmChatRepo.batchInsert(rows);
    for (const c of history.chat_history) {
        for (let i = 0; i < c.messages.length; i += BATCH_SIZE) {
            await chatService.batchInsertGMMessages(c.messages.slice(i, i + BATCH_SIZE));
        }
    }
    if (history.flagged_messages?.length) await flaggedRepo.batchInsert(history.flagged_messages);
};

const writePMHistory = async (history: {
    chat_history: ChatProps[];
    flagged_messages: FlaggedMessageProps[];
}): Promise<void> => {
    const pmChatRepo = ChatRepositoryFactory.createPMChatRepository();
    const pmMessageRepo = ChatRepositoryFactory.createPMMessageRepository();
    const pmThreadRepo = ChatRepositoryFactory.createPMThreadMessageRepository();
    await Promise.all([pmChatRepo.clear(), pmMessageRepo.clear(), pmThreadRepo.clear()]);
    const rows: AllChatProps[] = history.chat_history.map((c) => ({
        chatId: c.chatId,
        chatName: c.chatName,
        chatType: 3,
        dmPartnerUser: defaultDmPartner,
        isPinned: c.isPinned,
        lastReadMessageId: c.lastReadMessageId,
        latestMessage: c.latestMessage,
        latestMessageText: c.latestMessageText,
        profileImagePath: c.profileImagePath,
        project: c.project,
        systemUserId: c.systemUserId,
        tsLastAllReadActivity: c.tsLastAllReadActivity,
        TSLastMessage: c.TSLastMessage,
    }));
    if (rows.length > 0) await pmChatRepo.batchInsert(rows);
    for (const c of history.chat_history) {
        for (let i = 0; i < c.messages.length; i += BATCH_SIZE) {
            await chatService.batchInsertPMMessages(c.messages.slice(i, i + BATCH_SIZE));
        }
    }
    if (history.flagged_messages?.length) await flaggedRepo.batchInsert(history.flagged_messages);
};

const writeMDMHistory = async (history: {
    chat_history: ChatProps[];
    flagged_messages: FlaggedMessageProps[];
}): Promise<void> => {
    const mdmChatRepo = ChatRepositoryFactory.createMDMChatRepository();
    const mdmMessageRepo = ChatRepositoryFactory.createMDMMessageRepository();
    const mdmThreadRepo = ChatRepositoryFactory.createMDMThreadMessageRepository();
    await Promise.all([mdmChatRepo.clear(), mdmMessageRepo.clear(), mdmThreadRepo.clear()]);
    const rows = history.chat_history.map(buildMDMChatRow);
    if (rows.length > 0) await mdmChatRepo.batchInsert(rows);
    for (const c of history.chat_history) {
        const messages = c.messages || [];
        for (let i = 0; i < messages.length; i += BATCH_SIZE) {
            await chatService.batchInsertMDMMessages(messages.slice(i, i + BATCH_SIZE));
        }
    }
    if (history.flagged_messages?.length) await flaggedRepo.batchInsert(history.flagged_messages);
};

export const chatHandlers: HandlerMap<ChatRequests> = {
    addChat: async ({ chat, chatType }) => {
        const storeName = CHAT_STORE_BY_TYPE[chatType];
        if (!storeName) return;
        const repo = new ChatRepository(storeName);
        await repo.put(chat);
    },

    addFlaggedMessage: async ({ message }) => {
        await flaggedRepo.put(message);
    },

    addMessage: async ({ message, chatType }) => {
        const storeName = MESSAGE_STORE_BY_TYPE[chatType];
        if (!storeName) return;
        const repo = new MessageRepository(storeName);

        // For PM bubbles only, defend `taskCommentCount` from stale or
        // missing values. See the comment in addMessageWorker.ts for why.
        if (chatType === 3 && message.messageIdWithChatId) {
            const existing = await repo.get(message.messageIdWithChatId);
            const existingCount =
                existing.success && existing.data?.taskCommentCount !== undefined
                    ? existing.data.taskCommentCount
                    : undefined;
            const incomingCount = message.taskCommentCount;
            if (existingCount !== undefined && incomingCount !== undefined) {
                message.taskCommentCount = Math.max(existingCount, incomingCount);
            } else if (existingCount !== undefined && incomingCount === undefined) {
                message.taskCommentCount = existingCount;
            }
        }
        await repo.put(message);
    },

    addThreadMessage: async ({ threadMessage, chatType }) => {
        if (chatType === 1) await chatService.addDMThreadMessage(threadMessage);
        else if (chatType === 2) await chatService.addGMThreadMessage(threadMessage);
        else if (chatType === 3) await chatService.addPMThreadMessage(threadMessage);
        // MDM thread storage is not wired in the legacy worker; leave a no-op.
    },

    checkKnownChat: async ({ chatId, chatType }) => {
        if (chatType === 1) return chatService.isKnownDMChat(chatId);
        if (chatType === 2) return chatService.isKnownGMChat(chatId);
        if (chatType === 3) return chatService.isKnownPMChat(chatId);
        if (chatType === 4) return chatService.isKnownMDMChat(chatId);
        return false;
    },

    loadDMHistory: async ({ myself, accessToken }) => {
        const dmChatRepo = ChatRepositoryFactory.createDMChatRepository();
        const dmMessageRepo = ChatRepositoryFactory.createDMMessageRepository();
        const dmThreadRepo = ChatRepositoryFactory.createDMThreadMessageRepository();

        // 1) Chat list: always full-fetch (cheap, with derived fields the
        // delta path can't cleanly compute). Wipe + insert is fine.
        const chatsResp = await loadDMChats(
            myself.teamId,
            myself.teamName,
            myself.userId,
            accessToken
        );
        if (chatsResp) {
            await dmChatRepo.clear();
            if (chatsResp.chats?.length) {
                const rows: AllChatProps[] = chatsResp.chats.map((c) => ({
                    chatId: c.chatId,
                    chatName: c.chatName,
                    chatType: 1,
                    dmPartnerUser: c.dmPartnerUser,
                    isPinned: c.isPinned,
                    lastReadMessageId: c.lastReadMessageId,
                    latestMessage: c.latestMessage,
                    latestMessageText: c.latestMessageText,
                    tsLastAllReadActivity: c.tsLastAllReadActivity,
                    TSLastMessage: c.TSLastMessage,
                }));
                await dmChatRepo.batchInsert(rows);
            }
            if (chatsResp.flagged_messages?.length) {
                await flaggedRepo.batchInsert(chatsResp.flagged_messages);
            }
        }

        // 2) Messages: incremental sync with per-data-type checkpoint.
        await syncWithCheckpoint({
            key: "dm-messages",
            fetcher: async (since) => {
                const resp = await loadDMMessagesDelta(
                    myself.teamId,
                    myself.userId,
                    accessToken,
                    since
                );
                if (!resp) throw new Error("Failed to load DM messages delta");
                return {
                    serverTime: resp.serverTime,
                    data: resp.messages,
                    forceFull: resp.forceFull,
                };
            },
            applier: async (messages, hadCheckpoint) => {
                if (!hadCheckpoint) {
                    await dmMessageRepo.clear();
                }
                const toUpsert: MessageProps[] = [];
                for (const m of messages) {
                    if (m.isDeleted) {
                        if (m.messageIdWithChatId)
                            await dmMessageRepo.delete(m.messageIdWithChatId);
                    } else {
                        const { isDeleted: _ignored, ...rest } = m;
                        toUpsert.push(rest);
                    }
                }
                for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
                    await dmMessageRepo.batchInsertMessages(toUpsert.slice(i, i + BATCH_SIZE));
                }
            },
        });

        // 3) Thread messages: incremental sync with its own checkpoint.
        await syncWithCheckpoint({
            key: "dm-thread-messages",
            fetcher: async (since) => {
                const resp = await loadDMThreadMessagesDelta(
                    myself.teamId,
                    myself.userId,
                    accessToken,
                    since
                );
                if (!resp) throw new Error("Failed to load DM thread messages delta");
                return {
                    serverTime: resp.serverTime,
                    data: resp.thread_messages,
                    forceFull: resp.forceFull,
                };
            },
            applier: async (threadMessages, hadCheckpoint) => {
                if (!hadCheckpoint) {
                    await dmThreadRepo.clear();
                }
                const toUpsert = [];
                for (const tm of threadMessages) {
                    if (tm.isDeleted) {
                        if (tm.messageIdWithChatIdAndThreadId)
                            await dmThreadRepo.delete(tm.messageIdWithChatIdAndThreadId);
                    } else {
                        const { isDeleted: _ignored, ...rest } = tm;
                        toUpsert.push(rest);
                    }
                }
                for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
                    await dmThreadRepo.batchInsertThreadMessages(
                        toUpsert.slice(i, i + BATCH_SIZE)
                    );
                }
            },
        });
    },

    loadGMHistory: async ({ myself, accessToken }) => {
        const gmChatRepo = ChatRepositoryFactory.createGMChatRepository();
        const gmMessageRepo = ChatRepositoryFactory.createGMMessageRepository();
        const gmThreadRepo = ChatRepositoryFactory.createGMThreadMessageRepository();

        const chatsResp = await loadGMChats(
            myself.teamId,
            myself.teamName,
            myself.userId,
            accessToken
        );
        if (chatsResp) {
            await gmChatRepo.clear();
            if (chatsResp.chats?.length) {
                const rows: AllChatProps[] = chatsResp.chats.map((c) => ({
                    chatId: c.chatId,
                    chatName: c.chatName,
                    chatType: 2,
                    dmPartnerUser: defaultDmPartner,
                    isPinned: c.isPinned,
                    isPrivate: c.isPrivate,
                    lastReadMessageId: c.lastReadMessageId,
                    latestMessage: c.latestMessage,
                    latestMessageText: c.latestMessageText,
                    profileImagePath: c.profileImagePath,
                    tsLastAllReadActivity: c.tsLastAllReadActivity,
                    TSLastMessage: c.TSLastMessage,
                }));
                await gmChatRepo.batchInsert(rows);
            }
            if (chatsResp.flagged_messages?.length) {
                await flaggedRepo.batchInsert(chatsResp.flagged_messages);
            }
        }

        await syncWithCheckpoint({
            key: "gm-messages",
            fetcher: async (since) => {
                const resp = await loadGMMessagesDelta(
                    myself.teamId,
                    myself.userId,
                    accessToken,
                    since
                );
                if (!resp) throw new Error("Failed to load GM messages delta");
                return {
                    serverTime: resp.serverTime,
                    data: resp.messages,
                    forceFull: resp.forceFull,
                };
            },
            applier: async (messages, hadCheckpoint) => {
                if (!hadCheckpoint) {
                    await gmMessageRepo.clear();
                }
                const toUpsert: MessageProps[] = [];
                for (const m of messages) {
                    if (m.isDeleted) {
                        if (m.messageIdWithChatId)
                            await gmMessageRepo.delete(m.messageIdWithChatId);
                    } else {
                        const { isDeleted: _i, ...rest } = m;
                        toUpsert.push(rest);
                    }
                }
                for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
                    await gmMessageRepo.batchInsertMessages(toUpsert.slice(i, i + BATCH_SIZE));
                }
            },
        });

        await syncWithCheckpoint({
            key: "gm-thread-messages",
            fetcher: async (since) => {
                const resp = await loadGMThreadMessagesDelta(
                    myself.teamId,
                    myself.userId,
                    accessToken,
                    since
                );
                if (!resp) throw new Error("Failed to load GM thread messages delta");
                return {
                    serverTime: resp.serverTime,
                    data: resp.thread_messages,
                    forceFull: resp.forceFull,
                };
            },
            applier: async (threadMessages, hadCheckpoint) => {
                if (!hadCheckpoint) {
                    await gmThreadRepo.clear();
                }
                const toUpsert = [];
                for (const tm of threadMessages) {
                    if (tm.isDeleted) {
                        if (tm.messageIdWithChatIdAndThreadId)
                            await gmThreadRepo.delete(tm.messageIdWithChatIdAndThreadId);
                    } else {
                        const { isDeleted: _i, ...rest } = tm;
                        toUpsert.push(rest);
                    }
                }
                for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
                    await gmThreadRepo.batchInsertThreadMessages(
                        toUpsert.slice(i, i + BATCH_SIZE)
                    );
                }
            },
        });
    },

    loadMDMHistory: async ({ myself, accessToken }) => {
        try {
            const mdmChatRepo = ChatRepositoryFactory.createMDMChatRepository();
            const mdmMessageRepo = ChatRepositoryFactory.createMDMMessageRepository();
            const mdmThreadRepo = ChatRepositoryFactory.createMDMThreadMessageRepository();

            const chatsResp = await loadMDMChats(
                myself.teamId,
                myself.teamName,
                myself.userId,
                accessToken
            );
            if (chatsResp) {
                await mdmChatRepo.clear();
                if (chatsResp.chats?.length) {
                    // The new chats endpoint already populates latestMessage
                    // and TSLastMessage, so the buildMDMChatRow fallback
                    // (which existed only because the old /mdm/history/ payload
                    // sometimes omitted them) isn't needed here.
                    const rows: AllChatProps[] = chatsResp.chats.map((c) => ({
                        chatId: c.chatId,
                        chatName: c.chatName,
                        chatType: 4,
                        dmPartnerUser: defaultDmPartner,
                        isPinned: c.isPinned,
                        lastReadMessageId: c.lastReadMessageId ?? -1,
                        latestMessage: c.latestMessage,
                        latestMessageText: c.latestMessageText,
                        mdmMembers: c.mdmMembers,
                        tsLastAllReadActivity: c.tsLastAllReadActivity,
                        TSLastMessage: c.TSLastMessage,
                    }));
                    await mdmChatRepo.batchInsert(rows);
                }
                if (chatsResp.flagged_messages?.length) {
                    await flaggedRepo.batchInsert(chatsResp.flagged_messages);
                }
            }

            await syncWithCheckpoint({
                key: "mdm-messages",
                fetcher: async (since) => {
                    const resp = await loadMDMMessagesDelta(
                        myself.teamId,
                        myself.userId,
                        accessToken,
                        since
                    );
                    if (!resp) throw new Error("Failed to load MDM messages delta");
                    return {
                        serverTime: resp.serverTime,
                        data: resp.messages,
                        forceFull: resp.forceFull,
                    };
                },
                applier: async (messages, hadCheckpoint) => {
                    if (!hadCheckpoint) {
                        await mdmMessageRepo.clear();
                    }
                    const toUpsert: MessageProps[] = [];
                    for (const m of messages) {
                        if (m.isDeleted) {
                            if (m.messageIdWithChatId)
                                await mdmMessageRepo.delete(m.messageIdWithChatId);
                        } else {
                            const { isDeleted: _i, ...rest } = m;
                            toUpsert.push(rest);
                        }
                    }
                    for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
                        await mdmMessageRepo.batchInsertMessages(
                            toUpsert.slice(i, i + BATCH_SIZE)
                        );
                    }
                },
            });

            await syncWithCheckpoint({
                key: "mdm-thread-messages",
                fetcher: async (since) => {
                    const resp = await loadMDMThreadMessagesDelta(
                        myself.teamId,
                        myself.userId,
                        accessToken,
                        since
                    );
                    if (!resp) throw new Error("Failed to load MDM thread messages delta");
                    return {
                        serverTime: resp.serverTime,
                        data: resp.thread_messages,
                        forceFull: resp.forceFull,
                    };
                },
                applier: async (threadMessages, hadCheckpoint) => {
                    if (!hadCheckpoint) {
                        await mdmThreadRepo.clear();
                    }
                    const toUpsert = [];
                    for (const tm of threadMessages) {
                        if (tm.isDeleted) {
                            if (tm.messageIdWithChatIdAndThreadId)
                                await mdmThreadRepo.delete(tm.messageIdWithChatIdAndThreadId);
                        } else {
                            const { isDeleted: _i, ...rest } = tm;
                            toUpsert.push(rest);
                        }
                    }
                    for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
                        await mdmThreadRepo.batchInsertThreadMessages(
                            toUpsert.slice(i, i + BATCH_SIZE)
                        );
                    }
                },
            });
        } catch (error) {
            // Match prior worker: log and continue so callers still resolve.
            console.error("[chat:loadMDMHistory]", error);
        }
    },

    loadPMHistory: async ({ myself, accessToken }) => {
        const pmChatRepo = ChatRepositoryFactory.createPMChatRepository();
        const pmMessageRepo = ChatRepositoryFactory.createPMMessageRepository();
        const pmThreadRepo = ChatRepositoryFactory.createPMThreadMessageRepository();

        const chatsResp = await loadPMChats(
            myself.teamId,
            myself.teamName,
            myself.userId,
            accessToken
        );
        if (chatsResp) {
            await pmChatRepo.clear();
            if (chatsResp.chats?.length) {
                const rows: AllChatProps[] = chatsResp.chats.map((c) => ({
                    chatId: c.chatId,
                    chatName: c.chatName,
                    chatType: 3,
                    dmPartnerUser: defaultDmPartner,
                    isPinned: c.isPinned,
                    lastReadMessageId: c.lastReadMessageId,
                    latestMessage: c.latestMessage,
                    latestMessageText: c.latestMessageText,
                    profileImagePath: c.profileImagePath,
                    project: c.project,
                    systemUserId: c.systemUserId,
                    tsLastAllReadActivity: c.tsLastAllReadActivity,
                    TSLastMessage: c.TSLastMessage,
                }));
                await pmChatRepo.batchInsert(rows);
            }
            if (chatsResp.flagged_messages?.length) {
                await flaggedRepo.batchInsert(chatsResp.flagged_messages);
            }
        }

        await syncWithCheckpoint({
            key: "pm-messages",
            fetcher: async (since) => {
                const resp = await loadPMMessagesDelta(
                    myself.teamId,
                    myself.userId,
                    accessToken,
                    since
                );
                if (!resp) throw new Error("Failed to load PM messages delta");
                return {
                    serverTime: resp.serverTime,
                    data: resp.messages,
                    forceFull: resp.forceFull,
                };
            },
            applier: async (messages, hadCheckpoint) => {
                if (!hadCheckpoint) {
                    await pmMessageRepo.clear();
                }
                const toUpsert: MessageProps[] = [];
                for (const m of messages) {
                    if (m.isDeleted) {
                        if (m.messageIdWithChatId)
                            await pmMessageRepo.delete(m.messageIdWithChatId);
                    } else {
                        const { isDeleted: _i, ...rest } = m;
                        toUpsert.push(rest);
                    }
                }
                for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
                    await pmMessageRepo.batchInsertMessages(toUpsert.slice(i, i + BATCH_SIZE));
                }
            },
        });

        await syncWithCheckpoint({
            key: "pm-thread-messages",
            fetcher: async (since) => {
                const resp = await loadPMThreadMessagesDelta(
                    myself.teamId,
                    myself.userId,
                    accessToken,
                    since
                );
                if (!resp) throw new Error("Failed to load PM thread messages delta");
                return {
                    serverTime: resp.serverTime,
                    data: resp.thread_messages,
                    forceFull: resp.forceFull,
                };
            },
            applier: async (threadMessages, hadCheckpoint) => {
                if (!hadCheckpoint) {
                    await pmThreadRepo.clear();
                }
                const toUpsert = [];
                for (const tm of threadMessages) {
                    if (tm.isDeleted) {
                        if (tm.messageIdWithChatIdAndThreadId)
                            await pmThreadRepo.delete(tm.messageIdWithChatIdAndThreadId);
                    } else {
                        const { isDeleted: _i, ...rest } = tm;
                        toUpsert.push(rest);
                    }
                }
                for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
                    await pmThreadRepo.batchInsertThreadMessages(
                        toUpsert.slice(i, i + BATCH_SIZE)
                    );
                }
            },
        });
    },

    markAllChatActivityAsRead: async ({
        accessToken,
        myself,
        chatType,
        chatId,
        activityMessages,
    }) => {
        try {
            const api = authApi(accessToken);
            if (!api) {
                return { error: "Unauthorized. Auth token is not found." };
            }
            await api.put("/chat/activity/read/all/", {
                chat_id: chatId,
                chat_type: chatType,
                team_id: myself.teamId,
                user_id: myself.userId,
            });
            const affected: ActivityMessageProps[] = [];
            const updated: ActivityMessageProps[] = activityMessages.map((a) => {
                if (a.chatType === chatType && a.chatId === chatId && a.isRead === false) {
                    const next = { ...a, isRead: true };
                    affected.push(next);
                    return next;
                }
                return a;
            });
            if (affected.length > 0) {
                const activityService = new ActivityService();
                await activityService.batchInsertActivityMessages(affected);
            }
            return updated;
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                console.error(
                    "[chat:markAllChatActivityAsRead] API error",
                    error.response?.status,
                    error.response?.data
                );
            } else {
                console.error("[chat:markAllChatActivityAsRead] Unexpected error", error);
            }
            return { error: String(error) };
        }
    },

    popAllChats: async () => {
        const [dm, gm, mdm, pm] = await Promise.all([
            chatService.getDMChats(),
            chatService.getGMChats(),
            chatService.getMDMChats(),
            chatService.getPMChats(),
        ]);
        return [...dm, ...gm, ...mdm, ...pm].sort(sortByTSLastMessageDesc);
    },

    popFlaggedMessages: async () => {
        const result = await flaggedRepo.getAll();
        const flagged: FlaggedMessageProps[] = result.success && result.data ? result.data : [];
        return [...flagged].sort(
            (a, b) => new Date(b.tsSent).getTime() - new Date(a.tsSent).getTime()
        );
    },

    popLatestChat: async ({ chatType }) => {
        if (chatType === 1) return chatService.getLatestDMChat();
        if (chatType === 2) return chatService.getLatestGMChat();
        if (chatType === 3) return chatService.getLatestPMChat();
        return null;
    },

    popSpecificChat: async ({ chatId, chatType }) => {
        const storeName = CHAT_STORE_BY_TYPE[chatType];
        if (!storeName || !chatId) return null;
        const repo = new ChatRepository(storeName);
        return repo.getChat(chatId);
    },

    popSpecificMessages: async ({ chatId, chatType }) => {
        const storeName = MESSAGE_STORE_BY_TYPE[chatType];
        if (!storeName || !chatId) return [];
        const repo = new MessageRepository(storeName);
        const messages = await repo.getMessagesByChatId(chatType, chatId);
        return [...messages].sort(sortByMessageIdAsc);
    },

    popSpecificThreadMessages: async ({ chatId, threadId, chatType }) => {
        const storeName = THREAD_STORE_BY_TYPE[chatType];
        if (!storeName || !chatId || !threadId) return [];
        const repo = new ThreadMessageRepository(storeName);
        const messages = await repo.getThreadMessages(chatType, chatId, threadId);
        return [...messages].sort(sortByMessageIdAsc);
    },

    updateReadStatus: async ({
        accessToken,
        myself,
        chatType,
        chatId,
        isThread,
        threadId,
        lastReadMessageId,
    }) => {
        try {
            const api = authApi(accessToken);
            if (!api) {
                console.error("Unauthorized. Auth toke is not found.");
                return;
            }
            await api.put("/chat/read/", {
                chat_id: chatId,
                chat_type: chatType,
                is_thread: isThread,
                last_read_message_id: lastReadMessageId,
                team_id: myself.teamId,
                thread_id: threadId,
                user_id: myself.userId,
            });
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                console.error(
                    "[chat:updateReadStatus] API error",
                    error.response?.status,
                    error.response?.data
                );
            } else {
                console.error("[chat:updateReadStatus] Unexpected error", error);
            }
        }
    },
};

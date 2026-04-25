import { defaultDmPartner } from "../../features/chat/services/constants";
import { loadMDMHistory } from "../../features/chat/services/loadMDMHistory";
import { UserProps } from "../../types/admin";
import { ChatProps, FlaggedMessageProps, MessageProps } from "../../types/chat";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";
import { ChatRepositoryFactory, FlaggedRepository } from "../repositories";
import { ChatService } from "../services";

const BATCH_SIZE = 1000;

self.onmessage = async (event) => {
    try {
        const myself: UserProps = event.data.myself;
        const accessToken: string = event.data.accessToken;

        const mdmChatRepo = ChatRepositoryFactory.createMDMChatRepository();
        const mdmMessageRepo = ChatRepositoryFactory.createMDMMessageRepository();
        const mdmThreadRepo = ChatRepositoryFactory.createMDMThreadMessageRepository();
        const flaggedRepo = new FlaggedRepository();

        await mdmChatRepo.clear();
        await mdmMessageRepo.clear();
        await mdmThreadRepo.clear();

        const mdmHistory: {
            chat_history: ChatProps[];
            flagged_messages: FlaggedMessageProps[];
        } = await loadMDMHistory(myself.teamId, myself.teamName, myself.userId, accessToken);

        console.log("[loadMDMHistoryWorker] MDM history loaded:", mdmHistory.chat_history.length, "chats");

        for (let i = 0; i < mdmHistory.chat_history.length; i += 1) {
            const mdmChat: ChatProps = mdmHistory.chat_history[i];

            const fallbackTs = mdmChat.TSLastMessage || getLocalCurrentTimestamp();
            const defaultLatestMessage: MessageProps = {
                chatType: 4,
                messageIdWithChatId: `${mdmChat.chatId}-0`,
                chatId: mdmChat.chatId,
                messageId: 0,
                content: [],
                contentText: "",
                sender: { userId: "", userName: "", avatarImgPath: "", tsLastSeen: "", tsJoined: "", customStatus: "" } as any,
                tsSent: fallbackTs,
                tsUpdated: fallbackTs,
                numReplies: 0,
                taskId: null,
                taskStatus: null,
            };

            await mdmChatRepo.put({
                chatId: mdmChat.chatId,
                chatName: mdmChat.chatName,
                lastReadMessageId: mdmChat.lastReadMessageId ?? -1,
                chatType: 4,
                dmPartnerUser: defaultDmPartner,
                latestMessage: mdmChat.latestMessage ?? defaultLatestMessage,
                latestMessageText: mdmChat.latestMessageText ?? "",
                TSLastMessage: fallbackTs,
                isPinned: mdmChat.isPinned,
                tsLastAllReadActivity: mdmChat.tsLastAllReadActivity,
                mdmMembers: (mdmChat as any).mdmMembers,
            });

            const messages = mdmChat.messages || [];
            for (let j = 0; j < messages.length; j += BATCH_SIZE) {
                const miniBatch: MessageProps[] = messages.slice(j, j + BATCH_SIZE);
                await new ChatService().batchInsertMDMMessages(miniBatch);
            }
        }

        if (mdmHistory.flagged_messages) {
            for (let i = 0; i < mdmHistory.flagged_messages.length; i += 1) {
                const flaggedMessage: FlaggedMessageProps = mdmHistory.flagged_messages[i];
                await flaggedRepo.put(flaggedMessage);
            }
        }

        self.postMessage("done");
    } catch (error) {
        console.error("[loadMDMHistoryWorker] Error:", error);
        self.postMessage("done");
    }

    self.close();
};

export {};

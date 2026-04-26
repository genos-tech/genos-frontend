import { Socket } from "socket.io-client";

import { authApi } from "../../../services/api";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { UserProps } from "../../../types/admin";
import { AllChatProps } from "../../../types/chat";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { addChat } from "./addChat";
import { createMDMChat } from "./createMDMChat";
import { popSpecificMessages } from "./popSpecificMessages";
import { defaultDmPartner } from "./constants";

const memberAddedMessage = (addedMembers: string[]) => {
    const memberNames = addedMembers.join(", ");
    return `Added ${memberNames} to the conversation`;
};

const createMemberAddedMessage = (addedMembers: string[]) => [
    {
        type: "paragraph",
        children: [{ text: memberAddedMessage(addedMembers) }],
    },
];

/**
 * Add members to an existing MDM chat
 */
export const addMembersToMDM = async (
    accessToken: string | null,
    mdmId: number,
    memberIds: string[]
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            console.error("Failed to get API instance");
            return false;
        }
        
        for (const memberId of memberIds) {
            await api.post("/mdm/join/", {
                mdm_id: mdmId,
                attendee_id: memberId,
            });
        }
        return true;
    } catch (error) {
        console.error("Failed to add members to MDM:", error);
        return false;
    }
};

/**
 * Convert a DM to MDM by creating a new MDM with all members
 * This creates a new conversation (doesn't migrate messages)
 */
export const convertDMToMDM = async (
    accessToken: string,
    myself: UserProps,
    dmPartnerId: string,
    newMemberIds: string[],
    useCM: ChatManagementState,
    socket: Socket | null,
    setErrorMessage: (msg: string) => void,
    setOpen: (open: boolean) => void
): Promise<{ chatId: number; chatName: string } | null> => {
    try {
        // Create MDM with dm partner + new members
        const allMemberIds = [dmPartnerId, ...newMemberIds];
        
        const data = await createMDMChat(
            accessToken,
            myself,
            allMemberIds
        );

        if (data && (data.chatId || data.mdm_id)) {
            const chatId = data.chatId || data.mdm_id;
            const chatName = data.chatName;

            // Send initial message via socket if available
            if (socket) {
                const allMemberNames = newMemberIds.map(id => {
                    const member = useCM.allChats.find(c => c.dmPartnerUser?.userId === id);
                    return member?.dmPartnerUser?.userName || id;
                });
                
                socket.emit("message", {
                    methodType: "POST",
                    message: createMemberAddedMessage(allMemberNames),
                    destCGName: chatName,
                    destCGId: chatId,
                    destCGType: 4, // MDM
                    sender: myself,
                    tsSent: getLocalCurrentTimestamp(),
                });
            }

            // Add the new MDM chat to local storage
            const newChat: AllChatProps = {
                chatId: chatId,
                chatType: 4, // MDM
                chatName: chatName,
                dmPartnerUser: defaultDmPartner,
                lastReadMessageId: 1,
                latestMessage: {
                    chatType: 4,
                    chatId: chatId,
                    messageId: 1,
                    content: createMemberAddedMessage([]),
                    contentText: "Started this conversation",
                    sender: myself,
                    numReplies: 0,
                    reactions: [],
                    taskId: null,
                    taskStatus: null,
                    isFlagged: false,
                    tsSent: getLocalCurrentTimestamp(),
                    tsUpdated: getLocalCurrentTimestamp(),
                },
                latestMessageText: "Started this conversation",
                TSLastMessage: getLocalCurrentTimestamp(),
                isPrivate: false,
                isPinned: false,
            };

            await addChat(newChat, 4);
            
            // Refresh the chat list
            await useCM.funcSetAllChats();
            
            // Navigate to the new MDM chat
            const messages = await popSpecificMessages(chatId, 4);
            if (messages && messages.length > 0) {
                useCM.setCurrentMainChat({
                    ...newChat,
                    messages: messages,
                });
            }
            
            useCM.setIsMainChatVisible(true);
            setOpen(false);
            
            return { chatId, chatName };
        }

        setErrorMessage("Failed to create multi-user DM.");
        return null;
    } catch (error) {
        console.error("Failed to convert DM to MDM:", error);
        setErrorMessage("Failed to add members. Please try again.");
        return null;
    }
};

/**
 * Add members to existing chat - handles both DM (converts to MDM) and MDM (adds members)
 */
export const addMembersToChat = async (
    accessToken: string,
    myself: UserProps,
    chat: AllChatProps,
    newMemberIds: string[],
    useCM: ChatManagementState,
    socket: Socket | null,
    setErrorMessage: (msg: string) => void,
    setOpen: (open: boolean) => void
): Promise<boolean> => {
    if (chat.chatType === 1) {
        // DM - convert to MDM
        const result = await convertDMToMDM(
            accessToken,
            myself,
            chat.dmPartnerUser.userId,
            newMemberIds,
            useCM,
            socket,
            setErrorMessage,
            setOpen
        );
        return result !== null;
    } else if (chat.chatType === 4) {
        // MDM - add members directly
        const success = await addMembersToMDM(accessToken, chat.chatId, newMemberIds);
        
        if (success) {
            // Refresh the chat list
            await useCM.funcSetAllChats();
            setOpen(false);
            return true;
        } else {
            setErrorMessage("Failed to add members. Please try again.");
            return false;
        }
    }
    
    return false;
};

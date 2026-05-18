import { Socket } from "socket.io-client";

import { authApi } from "../../../services/api";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { getMessages } from "../../../i18n";
import { UserProps } from "../../../types/admin";
import { AllChatProps, MDMMemberProps, MessageProps } from "../../../types/chat";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { addChat } from "./addChat";
import { createMDMChat } from "./createMDMChat";
import { loadMDMHistory } from "./loadMDMHistory";
import { popSpecificMessages } from "./popSpecificMessages";
import { defaultDmPartner } from "./constants";

/**
 * Add members to an existing MDM chat.
 * Returns the join message data for each newly added member so the caller
 * can update local state and broadcast via socket.
 */
export const addMembersToMDM = async (
    accessToken: string | null,
    mdmId: number,
    memberIds: string[],
    myself: UserProps,
    socket: Socket | null
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            console.error("Failed to get API instance");
            return false;
        }

        for (const memberId of memberIds) {
            const res = await api.post("/mdm/join/", {
                mdm_id: mdmId,
                attendee_id: memberId,
                team_id: myself.teamId,
                team_name: myself.teamName,
            });

            const joinMessage = res.data?.join_message;
            if (joinMessage && socket) {
                socket.emit("mdm_member_joined", {
                    mdmId: mdmId,
                    joinMessage: joinMessage,
                });
            }
        }
        return true;
    } catch (error) {
        console.error("Failed to add members to MDM:", error);
        return false;
    }
};

/**
 * Convert a DM to MDM by creating a new MDM with all members.
 * If an MDM with the exact same members already exists, navigates to it instead.
 */
export const convertDMToMDM = async (
    accessToken: string,
    myself: UserProps,
    dmPartnerId: string,
    newMemberIds: string[],
    useCM: ChatManagementState,
    socket: Socket | null,
    setErrorMessage: (msg: string) => void,
    setOpen: (open: boolean) => void,
    selectedMembers?: UserProps[]
): Promise<{ chatId: number; chatName: string } | null> => {
    try {
        const allMemberIds = [dmPartnerId, ...newMemberIds];

        const data = await createMDMChat(accessToken, myself, allMemberIds);

        if (!data) {
            setErrorMessage("Failed to create multi-user DM.");
            return null;
        }

        if (data.mdm_exists) {
            const mdmId = data.mdm_id;
            const existingChat = useCM.allChats.find(
                (c) => c.chatType === 4 && c.chatId === mdmId
            );

            if (existingChat) {
                const messages = await popSpecificMessages(mdmId, 4);
                useCM.setCurrentMainChat({
                    ...existingChat,
                    messages: messages || [],
                });
            } else {
                const historyData = await loadMDMHistory(
                    myself.teamId, myself.teamName, myself.userId, accessToken, mdmId
                );
                const mdmChat = historyData?.chat_history?.[0];
                if (mdmChat) {
                    const sortedMessages = (mdmChat.messages || []).sort(
                        (a: MessageProps, b: MessageProps) => a.messageId - b.messageId
                    );
                    const chatForState: AllChatProps = {
                        chatId: mdmChat.chatId,
                        chatName: mdmChat.chatName,
                        chatType: 4,
                        dmPartnerUser: defaultDmPartner,
                        lastReadMessageId: mdmChat.lastReadMessageId ?? -1,
                        latestMessage: mdmChat.latestMessage,
                        latestMessageText: mdmChat.latestMessageText ?? "",
                        TSLastMessage: mdmChat.TSLastMessage ?? getLocalCurrentTimestamp(),
                        mdmMembers: mdmChat.mdmMembers,
                    };
                    await addChat(chatForState, 4);
                    useCM.setAllChats((prev: AllChatProps[]) => {
                        const exists = prev.some((c) => c.chatId === mdmId && c.chatType === 4);
                        if (exists) return prev;
                        return [chatForState, ...prev];
                    });
                    useCM.setCurrentMainChat({ ...chatForState, messages: sortedMessages });
                }
            }

            useCM.setCurrentChatPaneType(1);
            useCM.setIsMainChatVisible(true);
            setOpen(false);
            return { chatId: mdmId, chatName: existingChat?.chatName || `MDM-${mdmId}` };
        }

        const chatId = data.chatId || data.mdm_id;
        const chatName = data.chatName;
        const startedConversation = getMessages().chat.system.startedConversation;

        if (socket) {
            socket.emit(
                "join",
                {
                    joiningCGId: chatId,
                    joiningCGName: chatName,
                    chatType: 4,
                    dmPartnerUser: defaultDmPartner,
                },
                () => {
                    socket.emit("message", {
                        methodType: "POST",
                        message: [
                            {
                                type: "paragraph",
                                content: [{ type: "text", text: startedConversation, styles: {} }],
                            },
                            { type: "paragraph", content: [{ type: "text", text: "", styles: {} }] },
                        ],
                        destCGName: chatName,
                        destCGId: chatId,
                        chatType: 4,
                        dmPartnerUserId: null,
                        taskId: null,
                        taskStatus: null,
                        systemUserId: null,
                        messageIdForPut: null,
                    });
                }
            );
        }

        const ts = getLocalCurrentTimestamp();
        const allMembers: MDMMemberProps[] = [
            {
                userId: myself.userId,
                userName: myself.userName,
                userEmail: myself.userEmail,
                avatarImgPath: myself.avatarImgPath,
                teamId: myself.teamId,
                teamName: myself.teamName,
            },
            ...(selectedMembers || []).map((m) => ({
                userId: m.userId,
                userName: m.userName,
                userEmail: m.userEmail,
                avatarImgPath: m.avatarImgPath,
                teamId: m.teamId,
                teamName: m.teamName,
            })),
        ];

        const initialMessage: MessageProps = {
            chatType: 4,
            messageIdWithChatId: `${chatId}-1`,
            chatId: chatId,
            messageId: 1,
            content: [
                {
                    type: "paragraph",
                    content: [{ type: "text", text: startedConversation, styles: {} }],
                },
            ],
            contentText: startedConversation,
            sender: myself,
            numReplies: 0,
            taskId: null,
            taskStatus: null,
            tsSent: ts,
            tsUpdated: ts,
        };

        const newChat: AllChatProps = {
            chatId: chatId,
            chatType: 4,
            chatName: chatName,
            dmPartnerUser: defaultDmPartner,
            lastReadMessageId: 1,
            latestMessage: initialMessage,
            latestMessageText: startedConversation,
            TSLastMessage: ts,
            mdmMembers: allMembers,
        };

        await addChat(newChat, 4);
        useCM.setCurrentMainChat({ ...newChat, messages: [initialMessage] });
        useCM.setAllChats((prev: AllChatProps[]) => {
            const exists = prev.some((c) => c.chatId === chatId && c.chatType === 4);
            if (exists) return prev;
            return [newChat, ...prev];
        });
        useCM.setCurrentChatPaneType(1);
        useCM.setIsMainChatVisible(true);
        setOpen(false);

        return { chatId, chatName };
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
    setOpen: (open: boolean) => void,
    selectedMembers?: UserProps[]
): Promise<boolean> => {
    if (chat.chatType === 1) {
        const dmPartner = chat.dmPartnerUser;
        const allSelectedMembers = selectedMembers
            ? [dmPartner as unknown as UserProps, ...selectedMembers]
            : undefined;
        const result = await convertDMToMDM(
            accessToken,
            myself,
            dmPartner.userId,
            newMemberIds,
            useCM,
            socket,
            setErrorMessage,
            setOpen,
            allSelectedMembers
        );
        return result !== null;
    } else if (chat.chatType === 4) {
        const success = await addMembersToMDM(
            accessToken, chat.chatId, newMemberIds, myself, socket
        );

        if (success) {
            const newMemberEntries: MDMMemberProps[] = (selectedMembers || []).map((m) => ({
                userId: m.userId,
                userName: m.userName,
                userEmail: m.userEmail,
                avatarImgPath: m.avatarImgPath,
                teamId: m.teamId,
                teamName: m.teamName,
            }));
            const updatedMembers = [
                ...(chat.mdmMembers || []),
                ...newMemberEntries.filter(
                    (nm) => !(chat.mdmMembers || []).some((em) => em.userId === nm.userId)
                ),
            ];

            const updatedChat: AllChatProps = { ...chat, mdmMembers: updatedMembers };
            await addChat(updatedChat, 4);

            useCM.setAllChats((prev: AllChatProps[]) =>
                prev.map((c) =>
                    c.chatId === chat.chatId && c.chatType === 4
                        ? { ...c, mdmMembers: updatedMembers }
                        : c
                )
            );

            if (
                useCM.currentMainChat &&
                useCM.currentMainChat.chatId === chat.chatId &&
                useCM.currentMainChat.chatType === 4
            ) {
                useCM.setCurrentMainChat({
                    ...useCM.currentMainChat,
                    mdmMembers: updatedMembers,
                });
            }

            setOpen(false);
            return true;
        } else {
            setErrorMessage("Failed to add members. Please try again.");
            return false;
        }
    }

    return false;
};

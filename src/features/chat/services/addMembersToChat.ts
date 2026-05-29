import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { getMessages } from "../../../i18n";
import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { AllChatProps, MDMMemberProps, MessageProps } from "../../../types/chat";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { isLegacyNumericId } from "../../../utils/legacyId";
import { addChat } from "./addChat";
import { defaultDmPartner } from "./constants";
import { createMDMChat } from "./createMDMChat";
import { loadMDMHistory } from "./loadMDMHistory";
import { popSpecificMessages } from "./popSpecificMessages";

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
    // PUNCH LIST (v3 chatId migration): `/mdm/join/` binds `mdm_id` to
    // an integer field. Short-circuit when the id is a v3 UUID —
    // member-add for v3 channels goes through `channelService` in
    // Track D.
    if (!isLegacyNumericId(mdmId)) {
        console.warn("[addMembersToMDM] skipped: v3 UUID chatId, members not added");
        return false;
    }
    try {
        const api = authApi(accessToken);
        if (!api) {
            console.error("Failed to get API instance");
            return false;
        }

        for (const memberId of memberIds) {
            const res = await api.post("/mdm/join/", {
                attendee_id: memberId,
                mdm_id: mdmId,
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
                    myself.teamId,
                    myself.teamName,
                    myself.userId,
                    accessToken,
                    mdmId
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
                        mdmMembers: mdmChat.mdmMembers,
                        TSLastMessage: mdmChat.TSLastMessage ?? getLocalCurrentTimestamp(),
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
                    chatType: 4,
                    dmPartnerUser: defaultDmPartner,
                    joiningCGId: chatId,
                    joiningCGName: chatName,
                },
                () => {
                    socket.emit("message", {
                        chatType: 4,
                        destCGId: chatId,
                        destCGName: chatName,
                        dmPartnerUserId: null,
                        message: [
                            {
                                content: [{ styles: {}, text: startedConversation, type: "text" }],
                                type: "paragraph",
                            },
                            {
                                content: [{ styles: {}, text: "", type: "text" }],
                                type: "paragraph",
                            },
                        ],
                        messageIdForPut: null,
                        methodType: "POST",
                        systemUserId: null,
                        taskId: null,
                        taskStatus: null,
                    });
                }
            );
        }

        const ts = getLocalCurrentTimestamp();
        const allMembers: MDMMemberProps[] = [
            {
                avatarImgPath: myself.avatarImgPath,
                teamId: myself.teamId,
                teamName: myself.teamName,
                userEmail: myself.userEmail,
                userId: myself.userId,
                userName: myself.userName,
            },
            ...(selectedMembers || []).map((m) => ({
                avatarImgPath: m.avatarImgPath,
                teamId: m.teamId,
                teamName: m.teamName,
                userEmail: m.userEmail,
                userId: m.userId,
                userName: m.userName,
            })),
        ];

        const initialMessage: MessageProps = {
            chatId: chatId,
            chatType: 4,
            // Two-block shape (text paragraph + trailing empty paragraph)
            // matches what the socket emit above sends and what the other
            // system messages produce (see `getCreateMDMMessage` /
            // `getCreateGroupMessage` / `getJoinedMessage`). `BnChatPreview`
            // calls `content.slice(0, -1)` on the rendered content, so a
            // single-block array becomes empty and BlockNote throws.
            content: [
                {
                    content: [{ styles: {}, text: startedConversation, type: "text" }],
                    type: "paragraph",
                },
                { content: [{ styles: {}, text: "", type: "text" }], type: "paragraph" },
            ],
            contentText: startedConversation,
            messageId: 1,
            messageIdWithChatId: `${chatId}-1`,
            numReplies: 0,
            sender: myself,
            taskId: null,
            taskStatus: null,
            tsSent: ts,
            tsUpdated: ts,
        };

        // PUNCH LIST (v3 chatId migration): `AllChatProps.chatId` and
        // `lastReadMessageId` are `string` post-flip. The newly created
        // MDM id from `data.chatId || data.mdm_id` is typed `any` here
        // (untyped backend response), so it slides through; only the
        // numeric `1` sentinel needs stringification.
        // Keys sorted alphabetically per `sort-keys` (case-insensitive).
        const newChat: AllChatProps = {
            chatId: chatId,
            chatName: chatName,
            chatType: 4,
            dmPartnerUser: defaultDmPartner,
            lastReadMessageId: "1",
            latestMessage: initialMessage,
            latestMessageText: startedConversation,
            mdmMembers: allMembers,
            TSLastMessage: ts,
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
        // PUNCH LIST (v3 chatId migration): `chat.chatId` is `string`
        // post-flip; `addMembersToMDM` still takes `mdmId: number`
        // because it hits the legacy `/mdm/join/` endpoint. Cast once
        // at the boundary.
        const success = await addMembersToMDM(
            accessToken,
            chat.chatId as unknown as number,
            newMemberIds,
            myself,
            socket
        );

        if (success) {
            const newMemberEntries: MDMMemberProps[] = (selectedMembers || []).map((m) => ({
                avatarImgPath: m.avatarImgPath,
                teamId: m.teamId,
                teamName: m.teamName,
                userEmail: m.userEmail,
                userId: m.userId,
                userName: m.userName,
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

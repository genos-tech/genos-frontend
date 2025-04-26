import { useState, useEffect } from 'react';
import { Autocomplete, Box } from '@mui/joy';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CircularProgress from '@mui/joy/CircularProgress';
import { Socket } from 'socket.io-client';

import { loadSearchList } from '../services/loadChatSearchList';
import { checkKnownChat } from "../services/checkKnownChat";
import { addChat } from '../services/addChat';
import { addMessage } from '../services/addMessage';
import { popSpecificMessages } from '../services/popSpecificMessages';
import { getCurrentTimestamp } from '../../../components/utils/dateUtils';
import { useAuth } from "../../../context/AuthContext";
import { UserProps } from '../../../types/admin';
import {
    SearchListProps,
    MessageProps,
    AllChatProps,
    ChatProps
} from "../../../types/chat";

const joinedMessage = [
    { type: "paragraph", content: [{ type: "text", text: "Joined", styles: {} }] },
    { type: "paragraph", content: [{ type: "text", text: "", styles: {} }] }
]

type ChatSearchProps = {
    myself: UserProps;
    socket: Socket | null;
    openSearchBox: boolean;
    setOpenSearchBox: (value: boolean) => void;
    setCurrentMainChat: (value: ChatProps) => void;
    allChats: AllChatProps[];
    setAllChats: (value: AllChatProps[]) => void;
}

export const ChatSearch = (props: ChatSearchProps) => {
    const {
        myself,
        socket,
        openSearchBox,
        setOpenSearchBox,
        setCurrentMainChat,
        allChats,
        setAllChats
    } = props
    const { accessToken } = useAuth();
    const [options, setOptions] = useState<SearchListProps[]>([]);
    const loading = openSearchBox && options.length === 0;

    const defineNewChat = (
        chatId: number,
        chatName: string,
        isDm: boolean,
        dmPartnerUserId: string | null,
        messages: MessageProps[]
    ) => {
        const newChat: ChatProps = {
            chatId: chatId,
            chatName: chatName,
            isDm: isDm,
            dmPartnerUserId: isDm ? dmPartnerUserId : null,
            unread: false,
            messages: messages,
            latestMessage: messages[messages.length - 1],
            latestMessageText: messages[messages.length - 1].contentText,
            TSLastMessage: messages[messages.length - 1].tsSent,
        };
        return newChat
    }

    const moveToDMChat = async (
        chatId: number,
        chatName: string,
        dmPartnerUserId: string,
        setCurrentMainChat: (chat: ChatProps) => void
    ) => {
        if (chatId === -1 && socket !== null) {
            socket.emit("join", {
                joiningCGId: -1, // dm_id or gm_id
                joiningCGName: chatName, // dm_name or gm_name
                isDm: true,
                dmPartnerUserId: dmPartnerUserId,
            })
        }

        const fetchedMessages: MessageProps[] = await popSpecificMessages(chatId, true)
        if (fetchedMessages) {
            setCurrentMainChat(defineNewChat(chatId, chatName, true, dmPartnerUserId, fetchedMessages))
        } else {
            console.error("Failed to fetch thread DM fetchedMessages:", fetchedMessages)
        }
    };

    const moveToGMChat = async (
        chatId: number,
        chatName: string,
        setCurrentMainChat: (chat: ChatProps) => void
    ) => {
        const fetchedMessages: MessageProps[] = await popSpecificMessages(chatId, false)
        if (fetchedMessages) {
            setCurrentMainChat(defineNewChat(chatId, chatName, false, null, fetchedMessages))
        } else {
            console.error("Failed to fetch thread GM fetchedMessages:", fetchedMessages)
        }
    };


    const moveToSelectedChat = async (chatId: number, chatName: string, isDm: boolean, dmPartnerUserId: string) => {
        try {
            const isKnownChat: boolean = await checkKnownChat(chatId, isDm);
            setOpenSearchBox(false);

            if (!isKnownChat && socket !== null) {
                socket.emit("message", {
                    message: joinedMessage,
                    destCGName: chatName,
                    destCGId: chatId,
                    isDm: isDm,
                    dmPartnerUserId: isDm ? dmPartnerUserId : null,
                }, async (ack: any) => {
                    const message: MessageProps = {
                        messageIdWithChatId: `${chatId}-1`,
                        chatId: chatId,
                        messageId: 1,
                        content: joinedMessage,
                        contentText: "joined",
                        sender: myself,
                        tsSent: getCurrentTimestamp(),
                        numReplies: 0
                    }
                    const chat: AllChatProps = {
                        chatId: chatId,
                        chatName: chatName,
                        isDm: isDm,
                        dmPartnerUserId: isDm ? dmPartnerUserId : null,
                        unread: true,
                        latestMessage: message,
                        latestMessageText: "joined",
                        TSLastMessage: getCurrentTimestamp(),
                    }

                    await addChat(chat, chat.isDm)
                    await addMessage(message, chat.isDm)

                    setCurrentMainChat({ ...chat, messages: [message] })
                    setAllChats([...allChats, chat]);
                });
            } else {
                if (isDm) {
                    moveToDMChat(chatId, chatName, dmPartnerUserId, setCurrentMainChat)
                } else {
                    moveToGMChat(chatId, chatName, setCurrentMainChat)
                }
            }

        } catch (error) {
            console.error("Worker error:", error);
        }
    };

    const onChangeHandler = async (value: any) => {
        if (value !== null && socket !== null) {
            var isDm: boolean = true
            if (value.type === "Group") {
                isDm = false;
            }

            socket.emit("join", {
                joiningCGId: value.id, // dm_id or gm_id
                joiningCGName: value.name, // dm_name or gm_name
                isDm: isDm,
                dmPartnerUserId: value.dmPartnerUserId,
            }, (ack: any) => {
                if (Number(value.id) !== -1)
                    moveToSelectedChat(
                        value.id,
                        value.name,
                        (value.type === "Group") ? Boolean(false) : Boolean(true),
                        value.dmPartnerUserId
                    )
            }
            );
        }
    }

    useEffect(() => {
        let active = true;

        if (!loading) {
            return undefined;
        }

        (async () => {
            const loadedUsers: SearchListProps[] = await loadSearchList(myself, accessToken);

            if (active) {
                setOptions([...loadedUsers]);
            }
        })();

        return () => {
            active = false;
        };
    }, [loading]);

    useEffect(() => {
        if (!open) {
            setOptions([]);
        }
    }, [openSearchBox]);

    return (
        <Box sx={{ px: 2, pb: 1.5, mt: 2 }}>
            <Autocomplete
                placeholder={"Search"}
                open={openSearchBox}
                onOpen={() => {
                    setOpenSearchBox(true);
                }}
                onClose={() => {
                    setOpenSearchBox(false);
                }}
                isOptionEqualToValue={(option, value) => option.name === value.name}
                getOptionLabel={(option) => option.type === 'People' ? `${option.name} | ${option.email}` : option.name}
                options={options}
                loading={loading}
                endDecorator={
                    loading ? (
                        <CircularProgress size="sm" sx={{ bgcolor: 'background.surface' }} />
                    ) : null
                }
                onChange={(event, value) => onChangeHandler(value)}
                size="sm"
                startDecorator={<SearchRoundedIcon />}
                aria-label="Search"
                groupBy={(option) => option.type}
            />
        </Box>
    )
}
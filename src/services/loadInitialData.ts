import { useEffect, useState } from "react";

import { defaultDmPartner } from "../features/chat/services/constants";
import LoadDMHistoryWorker from "../workers/loadDMHistoryWorker.ts?worker";
import LoadGMHistoryWorker from "../workers/loadGMHistoryWorker.ts?worker";
import LoadTeamTaskWorker from "../workers/loadTeamTaskWorker.ts?worker";
import PopLatestChatWorker from "../workers/popLatestChatWorker.ts?worker";
import PopSpecificChatWorker from "../workers/popSpecificChatWorker.ts?worker";
import PopSpecificMessagesWorker from "../workers/popSpecificMessagesWorker.ts?worker";
import { UserProps } from "../types/admin";
import { ChatProps, MessageProps } from "../types/chat";

export const loadInitialData = (
    myself: UserProps,
    accessToken: string | null,
    setIsLoading: (state: boolean) => void,
    setCurrentMainChat: (value: ChatProps) => void
) => {
    const [isDMHistoryLoaded, setIsDMHistoryLoaded] = useState<boolean | null>(false);
    const [isGMHistoryLoaded, setIsGMHistoryLoaded] = useState<boolean | null>(false);
    const [isTeamTasksLoaded, setIsTeamTasksLoaded] = useState<boolean | null>(false);
    const [latestDmChatId, setLatestDmChatId] = useState<number | null>(null);
    const [isInitialChatLoaded, setIsInitialChatLoaded] = useState<boolean | null>(false);
    const [InitialChatMessages, setInitialChatMessages] = useState<MessageProps[]>();

    // Load DM history
    useEffect(() => {
        if (accessToken && myself.userId !== "" && myself.userName !== "") {
            const loadDMHistoryWorker = new LoadDMHistoryWorker();
            loadDMHistoryWorker.postMessage({ myself: myself, accessToken: accessToken });
            loadDMHistoryWorker.onmessage = (event) => {
                if (event.data === "done") {
                    setIsDMHistoryLoaded(true);
                } else {
                    console.error("Filed initial DM history data loading");
                    console.error("event.data:", event.data);
                }
            };
            return () => {
                loadDMHistoryWorker.terminate();
            };
        }
    }, [myself, accessToken]);

    // Load GM history
    useEffect(() => {
        if (accessToken && myself.userId !== "" && myself.userName !== "") {
            const loadGMHistoryWorker = new LoadGMHistoryWorker();
            loadGMHistoryWorker.postMessage({ myself: myself, accessToken: accessToken });
            loadGMHistoryWorker.onmessage = (event) => {
                if (event.data === "done") {
                    setIsGMHistoryLoaded(true);
                } else {
                    console.error("Filed initial GM history data loading");
                    console.error("event.data:", event.data);
                }
            };
            return () => {
                loadGMHistoryWorker.terminate();
            };
        }
    }, [myself, accessToken]);

    // Load Team tasks
    useEffect(() => {
        if (accessToken && myself.userId !== "" && myself.userName !== "") {
            const loadTeamTaskWorker = new LoadTeamTaskWorker();
            loadTeamTaskWorker.postMessage({ myself: myself, accessToken: accessToken });
            loadTeamTaskWorker.onmessage = (event) => {
                if (event.data === "done") {
                    setIsTeamTasksLoaded(true);
                } else {
                    console.error("Filed initial team task loading");
                }
            };
            return () => {
                loadTeamTaskWorker.terminate();
            };
        }
    }, [myself, accessToken]);

    // Fetch the latest DM Chat Id
    useEffect(() => {
        if (isDMHistoryLoaded) {
            const popLatestDMChatWorker = new PopLatestChatWorker();
            popLatestDMChatWorker.postMessage({ isDm: true });
            popLatestDMChatWorker.onmessage = (event) => {
                const latestDmChat: any = event.data;
                if (latestDmChat === null) {
                    setLatestDmChatId(-1);
                } else {
                    setLatestDmChatId(latestDmChat.chatId);
                }
            };
            return () => {
                popLatestDMChatWorker.terminate();
            };
        }
    }, [isDMHistoryLoaded]);

    // Fetch initial DM chat messages info after the DM history is loaded
    useEffect(() => {
        if (latestDmChatId !== null) {
            if (latestDmChatId === -1) {
                setInitialChatMessages([]);
            } else {
                const popSpecificMessagesWorker = new PopSpecificMessagesWorker();
                popSpecificMessagesWorker.postMessage({ chatId: latestDmChatId, isDm: true });
                popSpecificMessagesWorker.onmessage = (event) => {
                    const fetchedMessages: MessageProps[] = event.data;
                    if (fetchedMessages !== undefined) {
                        setInitialChatMessages(fetchedMessages);
                    } else {
                        setInitialChatMessages([]);
                        console.error("Failed due to fetchedMessages:", fetchedMessages);
                    }
                };
                return () => {
                    popSpecificMessagesWorker.terminate();
                };
            }
        }
    }, [latestDmChatId]);

    // Fetch initial DM chat info after the initial DM chat messages are loaded
    useEffect(() => {
        if (InitialChatMessages !== undefined) {
            if (InitialChatMessages.length > 0) {
                const popSpecificChatWorker = new PopSpecificChatWorker();
                popSpecificChatWorker.postMessage({ chatId: latestDmChatId, isDm: true });
                popSpecificChatWorker.onmessage = (event) => {
                    const fetchedChat: any = event.data;
                    if (fetchedChat !== undefined && fetchedChat !== null) {
                        const currentMainChat: ChatProps = {
                            chatId: fetchedChat.chatId,
                            chatName: fetchedChat.chatName,
                            isDm: true,
                            dmPartnerUser: fetchedChat.dmPartnerUser,
                            unread: InitialChatMessages.length === 1 ? true : false,
                            messages: InitialChatMessages,
                            latestMessage: InitialChatMessages[InitialChatMessages.length - 1],
                            latestMessageText:
                                InitialChatMessages[InitialChatMessages.length - 1].contentText,
                            TSLastMessage: fetchedChat.TSLastMessage,
                        };
                        setCurrentMainChat(currentMainChat);
                        setIsInitialChatLoaded(true);
                    } else {
                        console.error("Failed due to fetchedChat is;", fetchedChat);
                    }
                };
                return () => {
                    popSpecificChatWorker.terminate();
                };
            } else {
                const currentMainChat: ChatProps = {
                    chatId: -1,
                    chatName: "Origin",
                    isDm: true,
                    dmPartnerUser: defaultDmPartner,
                    latestMessageText: "",
                    TSLastMessage: "",
                    unread: true,
                    messages: [],
                };
                setCurrentMainChat(currentMainChat);
                setIsInitialChatLoaded(true);
            }
        }
    }, [InitialChatMessages]);

    // Set "isLoading" true after initialization is completed
    useEffect(() => {
        if (isDMHistoryLoaded && isGMHistoryLoaded && isTeamTasksLoaded && isInitialChatLoaded) {
            setIsLoading(false);
        }
    }, [isDMHistoryLoaded, isGMHistoryLoaded, isTeamTasksLoaded, isInitialChatLoaded]);
};

import { useEffect, useState } from "react";
import LoadDMHistoryWorker from "../../workers/loadDMHistoryWorker.ts?worker";
import LoadGMHistoryWorker from "../../workers/loadGMHistoryWorker.ts?worker";
import GetLatestDMChatWorker from "../../workers/getLatestDMChatWorker.ts?worker";
import FetchSpecificDMChatWorker from "../../workers/fetchSpecificDMChatWorker.ts?worker";
import FetchSpecificDMMessagesWorker from "../../workers/fetchSpecificDMMessagesWorker.ts?worker";
import {
    UserProps,
    ChatProps,
    MessageProps,
} from "../../types";

export function InitialLoad(
    myself: UserProps,
    accessToken: string | null,
    setIsLoading: (state: boolean) => void,
    setCurrentMainChat: (value: ChatProps) => void,
) {
    const [isDMHistoryLoaded, setIsDMHistoryLoaded] = useState(false);
    const [isGMHistoryLoaded, setIsGMHistoryLoaded] = useState(false);
    const [isLatestDmChatLoaded, setIsLatestDmChatLoaded] = useState(false);
    const [latestDmChatId, setLatestDmChatId] = useState(-1);
    const [isInitialChatLoaded, setIsInitialChatLoaded] = useState(false);
    const [InitialChatMessages, setInitialChatMessages] = useState<MessageProps[]>();

    // Load DM history
    useEffect(() => {
        if (accessToken) {
            console.log("Initial DM history data loading...");
            const loadDMHistoryWorker = new LoadDMHistoryWorker();
            loadDMHistoryWorker.postMessage({ myself: myself, accessToken: accessToken });
            loadDMHistoryWorker.onmessage = (event) => {
                if (event.data === "done") {
                    console.log("Initial DM history data loading completed");
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
        if (accessToken) {
            console.log("Initial GM history data loading...");
            const loadGMHistoryWorker = new LoadGMHistoryWorker();
            loadGMHistoryWorker.postMessage({ myself: myself, accessToken: accessToken });
            loadGMHistoryWorker.onmessage = (event) => {
                if (event.data === "done") {
                    console.log("Initial GM history data loading completed");
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

    // Fetch the latest DM Chat Id
    useEffect(() => {
        if (isDMHistoryLoaded) {
            const getLatestDMChatWorker = new GetLatestDMChatWorker();
            getLatestDMChatWorker.postMessage({});
            getLatestDMChatWorker.onmessage = (event) => {
                const latestDmChat: any = event.data;
                setLatestDmChatId(latestDmChat.chatId)
                setIsLatestDmChatLoaded(true)
            };
            return () => {
                getLatestDMChatWorker.terminate();
            };
        }
    }, [isDMHistoryLoaded])

    // Fetch initial DM chat messages info after the DM history is loaded
    useEffect(() => {
        if (latestDmChatId !== -1) {
            const fetchSpecificDMMessagesWorker = new FetchSpecificDMMessagesWorker();
            fetchSpecificDMMessagesWorker.postMessage({ chatId: latestDmChatId });
            fetchSpecificDMMessagesWorker.onmessage = (event) => {
                const fetchedMessages: MessageProps[] = event.data;
                if (fetchedMessages !== undefined) {
                    setInitialChatMessages(fetchedMessages)
                } else {
                    console.error("Failed due to fetchedMessages:", fetchedMessages)
                }
            };
            return () => {
                fetchSpecificDMMessagesWorker.terminate();
            };
        }
    }, [latestDmChatId])

    // Fetch initial DM chat info after the initial DM chat messages are loaded
    useEffect(() => {
        if (InitialChatMessages !== undefined) {
            const fetchSpecificDMChatWorker = new FetchSpecificDMChatWorker();
            fetchSpecificDMChatWorker.postMessage({ chatId: latestDmChatId });
            fetchSpecificDMChatWorker.onmessage = (event) => {
                const fetchedChat: any = event.data;
                if (fetchedChat !== undefined && fetchedChat !== null) {
                    const currentMainChat: ChatProps = {
                        chatId: fetchedChat.chatId,
                        chatName: fetchedChat.chatName,
                        chatEmail: fetchedChat.chatEmail,
                        isDm: true,
                        unread: (InitialChatMessages.length === 1) ? true : false,
                        messages: InitialChatMessages,
                        latestMessage: InitialChatMessages[InitialChatMessages.length - 1],
                        TSLastMessage: fetchedChat.TSLastMessage,
                    }
                    setCurrentMainChat(currentMainChat)
                    setIsInitialChatLoaded(true)
                } else {
                    console.error("Failed due to fetchedChat is;", fetchedChat)
                }
            };
            return () => {
                fetchSpecificDMChatWorker.terminate();
            };
        }
    }, [InitialChatMessages])

    // Set "isLoading" true after initialization is completed
    useEffect(() => {
        if (isDMHistoryLoaded && isGMHistoryLoaded && isInitialChatLoaded) {
            setIsLoading(false);
        }
    }, [isDMHistoryLoaded, isGMHistoryLoaded, isInitialChatLoaded]);
}

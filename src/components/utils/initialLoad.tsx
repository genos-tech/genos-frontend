import { useEffect, useState } from "react";
import LoadDMHistoryWorker from "../../workers/loadDMHistoryWorker.ts?worker";
import LoadGMHistoryWorker from "../../workers/loadGMHistoryWorker.ts?worker";
import FetchSpecificDMChatWorker from "../../workers/fetchSpecificDMChatWorker.ts?worker";
import FetchSpecificDMMessagesWorker from "../../workers/fetchSpecificDMMessagesWorker.ts?worker";
import {
    UserProps,
    ChatProps,
    MessageProps,
} from "../../types";

export function InitialLoad(
    myself: UserProps,
    setIsLoading: (state: boolean) => void,
    setCurrentMainChat: (value: ChatProps) => void,
) {
    const [isDMHistoryLoaded, setIsDMHistoryLoaded] = useState(false);
    const [isGMHistoryLoaded, setIsGMHistoryLoaded] = useState(false);
    const [isInitialChatLoaded, setIsInitialChatLoaded] = useState(false);
    const [InitialChatMessages, setInitialChatMessages] = useState<MessageProps[]>();

    // Load DM history
    useEffect(() => {
        console.log("Initial DM history data loading...");
        const loadDMHistoryWorker = new LoadDMHistoryWorker();
        loadDMHistoryWorker.postMessage(myself);
        loadDMHistoryWorker.onmessage = (event) => {
            if (event.data === "done") {
                console.log("Initial DM history data loading completed");
                setIsDMHistoryLoaded(true);
            }
        };
        return () => {
            loadDMHistoryWorker.terminate();
        };
    }, [myself]);

    // Load GM history
    useEffect(() => {
        console.log("Initial GM history data loading...");
        const loadGMHistoryWorker = new LoadGMHistoryWorker();
        loadGMHistoryWorker.postMessage(myself);
        loadGMHistoryWorker.onmessage = (event) => {
            if (event.data === "done") {
                console.log("Initial GM history data loading completed");
                setIsGMHistoryLoaded(true);
            }
        };
        return () => {
            loadGMHistoryWorker.terminate();
        };
    }, [myself]);

    // Fetch initial DM chat messages info after the DM history is loaded
    useEffect(() => {
        if (isDMHistoryLoaded) {
            console.log("Fetch initial chat messages")
            const fetchSpecificDMMessagesWorker = new FetchSpecificDMMessagesWorker();
            fetchSpecificDMMessagesWorker.postMessage({ chatEmail: myself.userEmail });
            fetchSpecificDMMessagesWorker.onmessage = (event) => {
                const fetchedMessages: MessageProps[] = event.data;
                if (fetchedMessages !== undefined) {
                    setInitialChatMessages(fetchedMessages)
                }
            };
            return () => {
                fetchSpecificDMMessagesWorker.terminate();
            };
        }
    }, [isDMHistoryLoaded])

    // Fetch initial DM chat info after the initial DM chat messages are loaded
    useEffect(() => {
        if (InitialChatMessages !== undefined) {
            console.log("Fetch initial chat messages")
            const fetchSpecificDMChatWorker = new FetchSpecificDMChatWorker();
            fetchSpecificDMChatWorker.postMessage({ chatEmail: myself.userEmail });
            fetchSpecificDMChatWorker.onmessage = (event) => {
                const fetchedChat: any = event.data;
                if (fetchedChat !== undefined) {
                    const currentMainChat: ChatProps = {
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

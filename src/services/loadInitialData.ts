import { useEffect, useState } from "react";

import { defaultDmPartner } from "../features/chat/services/constants";
import LoadActivityHistoryWorker from "../workers/loadActivityHistoryWorker.ts?worker";
import LoadDMHistoryWorker from "../workers/loadDMHistoryWorker.ts?worker";
import LoadGMHistoryWorker from "../workers/loadGMHistoryWorker.ts?worker";
import LoadPMHistoryWorker from "../workers/loadPMHistoryWorker.ts?worker";
import LoadTeamMemberWorker from "../workers/loadTeamMembersWorker.ts?worker";
import LoadTeamTaskWorker from "../workers/loadTeamTasksWorker.ts?worker";
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
    const [isActivityHistoryLoaded, setIsActivityHistoryLoaded] = useState<boolean | null>(false);
    const [isDMHistoryLoaded, setIsDMHistoryLoaded] = useState<boolean | null>(false);
    const [isGMHistoryLoaded, setIsGMHistoryLoaded] = useState<boolean | null>(false);
    const [isPMHistoryLoaded, setIsPMHistoryLoaded] = useState<boolean | null>(false);
    const [isTeamMembersLoaded, setIsTeamMembersLoaded] = useState<boolean | null>(false);
    const [isTeamTasksLoaded, setIsTeamTasksLoaded] = useState<boolean | null>(false);
    const [latestDmChatId, setLatestDmChatId] = useState<number | null>(null);
    const [isInitialChatLoaded, setIsInitialChatLoaded] = useState<boolean | null>(false);
    const [InitialChatMessages, setInitialChatMessages] = useState<MessageProps[]>();

    // Load Activity history
    useEffect(() => {
        if (accessToken && myself.userId !== "" && myself.userName !== "") {
            const loadActivityHistoryWorker = new LoadActivityHistoryWorker();
            loadActivityHistoryWorker.postMessage({ myself: myself, accessToken: accessToken });
            loadActivityHistoryWorker.onmessage = (event) => {
                if (event.data === "done") {
                    setIsActivityHistoryLoaded(true);
                } else {
                    console.error("Failed initial Activity history data loading");
                    console.error("event.data:", event.data);
                }
            };
            return () => {
                loadActivityHistoryWorker.terminate();
            };
        }
    }, [myself, accessToken]);

    // Load DM history
    useEffect(() => {
        if (accessToken && myself.userId !== "" && myself.userName !== "") {
            const loadDMHistoryWorker = new LoadDMHistoryWorker();
            loadDMHistoryWorker.postMessage({ myself: myself, accessToken: accessToken });
            loadDMHistoryWorker.onmessage = (event) => {
                if (event.data === "done") {
                    setIsDMHistoryLoaded(true);
                } else {
                    console.error("Failed initial DM history data loading");
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
                    console.error("Failed initial GM history data loading");
                    console.error("event.data:", event.data);
                }
            };
            return () => {
                loadGMHistoryWorker.terminate();
            };
        }
    }, [myself, accessToken]);

    // Load PM history
    useEffect(() => {
        if (accessToken && myself.userId !== "" && myself.userName !== "") {
            const loadPMHistoryWorker = new LoadPMHistoryWorker();
            loadPMHistoryWorker.postMessage({ myself: myself, accessToken: accessToken });
            loadPMHistoryWorker.onmessage = (event) => {
                if (event.data === "done") {
                    setIsPMHistoryLoaded(true);
                } else {
                    console.error("Failed initial PM history data loading");
                    console.error("event.data:", event.data);
                }
            };
            return () => {
                loadPMHistoryWorker.terminate();
            };
        }
    }, [myself, accessToken]);

    // Load Team Users
    useEffect(() => {
        if (accessToken && myself.userId !== "" && myself.userName !== "") {
            const loadTeamMembersWorker = new LoadTeamMemberWorker();
            loadTeamMembersWorker.postMessage({ myself: myself, accessToken: accessToken });
            loadTeamMembersWorker.onmessage = (event) => {
                if (event.data === "done") {
                    setIsTeamMembersLoaded(true);
                } else {
                    console.error("Failed initial team member loading");
                }
            };
            return () => {
                loadTeamMembersWorker.terminate();
            };
        }
    }, [myself, accessToken]);

    // Load Team tasks
    useEffect(() => {
        if (accessToken && myself.userId !== "" && myself.userName !== "") {
            const loadTeamTasksWorker = new LoadTeamTaskWorker();
            loadTeamTasksWorker.postMessage({ myself: myself, accessToken: accessToken });
            loadTeamTasksWorker.onmessage = (event) => {
                if (event.data === "done") {
                    setIsTeamTasksLoaded(true);
                } else {
                    console.error("Failed initial team task loading");
                }
            };
            return () => {
                loadTeamTasksWorker.terminate();
            };
        }
    }, [myself, accessToken]);

    // Fetch the latest DM Chat Id
    useEffect(() => {
        if (isDMHistoryLoaded) {
            const popLatestDMChatWorker = new PopLatestChatWorker();
            popLatestDMChatWorker.postMessage({ chatType: 1 });
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
                popSpecificMessagesWorker.postMessage({
                    chatId: latestDmChatId,
                    isDm: true,
                    chatType: 1,
                });
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
                popSpecificChatWorker.postMessage({
                    chatId: latestDmChatId,
                    chatType: 1,
                });
                popSpecificChatWorker.onmessage = (event) => {
                    const fetchedChat: any = event.data;
                    if (fetchedChat !== undefined && fetchedChat !== null) {
                        const currentMainChat: ChatProps = {
                            chatId: fetchedChat.chatId,
                            chatName: fetchedChat.chatName,
                            isDm: true,
                            chatType: 1,
                            dmPartnerUser: fetchedChat.dmPartnerUser,
                            unread: InitialChatMessages.length === 1 ? true : false,
                            messages: InitialChatMessages,
                            latestMessage: InitialChatMessages[InitialChatMessages.length - 1],
                            latestMessageText:
                                InitialChatMessages[InitialChatMessages.length - 1].contentText,
                            TSLastMessage: fetchedChat.TSLastMessage,
                            project: fetchedChat.project,
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
                    chatType: 1,
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
        if (
            isActivityHistoryLoaded &&
            isDMHistoryLoaded &&
            isGMHistoryLoaded &&
            isPMHistoryLoaded &&
            isTeamTasksLoaded &&
            isTeamMembersLoaded &&
            isInitialChatLoaded
        ) {
            setIsLoading(false);
        }
    }, [
        isActivityHistoryLoaded,
        isDMHistoryLoaded,
        isGMHistoryLoaded,
        isPMHistoryLoaded,
        isTeamTasksLoaded,
        isTeamMembersLoaded,
        isInitialChatLoaded,
    ]);
};

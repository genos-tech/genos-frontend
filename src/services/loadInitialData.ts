import { useEffect, useState } from "react";

import LoadActivityHistoryWorker from "../db/workers/loadActivityHistoryWorker.ts?worker";
import LoadDMHistoryWorker from "../db/workers/loadDMHistoryWorker.ts?worker";
import LoadGMHistoryWorker from "../db/workers/loadGMHistoryWorker.ts?worker";
import LoadInboxWorker from "../db/workers/loadInboxWorker.ts?worker";
import LoadPMHistoryWorker from "../db/workers/loadPMHistoryWorker.ts?worker";
import LoadProjectTasksWorker from "../db/workers/loadProjectTasksWorker.ts?worker";
import LoadTeamMemberWorker from "../db/workers/loadTeamMembersWorker.ts?worker";
import PopSpecificChatWorker from "../db/workers/popSpecificChatWorker.ts?worker";
import PopSpecificMessagesWorker from "../db/workers/popSpecificMessagesWorker.ts?worker";
import { defaultChat } from "../features/chat/utils/defaults";
import { UserProps } from "../types/admin";
import { ChatProps, MessageProps } from "../types/chat";

export const loadInitialData = (
    myself: UserProps,
    accessToken: string | null,
    setIsLoading: (state: boolean) => void,
    setCurrentMainChat: (value: ChatProps) => void
) => {
    const [isInboxLoaded, setIsInboxLoaded] = useState<boolean | null>(false);
    const [isActivityHistoryLoaded, setIsActivityHistoryLoaded] = useState<boolean | null>(false);
    const [isDMHistoryLoaded, setIsDMHistoryLoaded] = useState<boolean | null>(false);
    const [isGMHistoryLoaded, setIsGMHistoryLoaded] = useState<boolean | null>(false);
    const [isPMHistoryLoaded, setIsPMHistoryLoaded] = useState<boolean | null>(false);
    const [isTeamMembersLoaded, setIsTeamMembersLoaded] = useState<boolean | null>(false);
    const [isInitialChatLoaded, setIsInitialChatLoaded] = useState<boolean | null>(false);
    const [isProjectTasksLoaded, setIsProjectTasksLoaded] = useState<boolean | null>(false);

    // Load Inbox
    useEffect(() => {
        if (accessToken && myself.userId !== "" && myself.userName !== "") {
            const loadInboxWorker = new LoadInboxWorker();
            loadInboxWorker.postMessage({ myself: myself, accessToken: accessToken });
            loadInboxWorker.onmessage = (event) => {
                if (event.data === "done") {
                    setIsInboxLoaded(true);
                } else {
                    console.error("Failed initial inbox data loading");
                    console.error("event.data:", event.data);
                }
            };
            return () => {
                loadInboxWorker.terminate();
            };
        }
    }, [myself, accessToken]);

    // Load Activity history
    useEffect(() => {
        if (accessToken && myself.userId !== "" && myself.userName !== "") {
            const loadActivityHistoryWorker = new LoadActivityHistoryWorker();
            loadActivityHistoryWorker.postMessage({
                myself: myself,
                accessToken: accessToken,
            });
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
            loadDMHistoryWorker.postMessage({
                myself: myself,
                accessToken: accessToken,
            });
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
            loadGMHistoryWorker.postMessage({
                myself: myself,
                accessToken: accessToken,
            });
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
            loadPMHistoryWorker.postMessage({
                myself: myself,
                accessToken: accessToken,
            });
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
            loadTeamMembersWorker.postMessage({
                myself: myself,
                accessToken: accessToken,
            });
            loadTeamMembersWorker.onmessage = (event) => {
                if (event.data) {
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

    // Load Project Tasks
    useEffect(() => {
        const lastProjectId = localStorage.getItem("lastProjectId");
        if (accessToken && myself.userId !== "" && myself.userName !== "" && lastProjectId) {
            const loadProjectTasksWorker = new LoadProjectTasksWorker();
            loadProjectTasksWorker.postMessage({
                myself: myself,
                projectId: Number(lastProjectId),
                accessToken: accessToken,
            });
            loadProjectTasksWorker.onmessage = (event) => {
                if (event.data === "done") {
                    setIsProjectTasksLoaded(true);
                }
            };
            return () => {
                loadProjectTasksWorker.terminate();
            };
        } else {
            console.log("No project tasks to load");
            setIsProjectTasksLoaded(true);
        }
    }, [myself, accessToken]);

    // Fetch initial DM chat info after the initial DM chat messages are loaded
    useEffect(() => {
        if (isDMHistoryLoaded && isGMHistoryLoaded && isPMHistoryLoaded) {
            // Get the last chat type
            const tmpLastChatType = localStorage.getItem("lastChatType");
            const lastChatType =
                tmpLastChatType && tmpLastChatType !== "" ? Number(tmpLastChatType) : -1;

            if (lastChatType !== -1) {
                // Get the last chat id
                let lastChatId: number | null = null;
                if (lastChatType === 1) {
                    const tmpLastChatId = localStorage.getItem("lastDMChatId");
                    lastChatId =
                        tmpLastChatId && tmpLastChatId !== "" ? Number(tmpLastChatId) : null;
                }
                if (lastChatType === 2) {
                    const tmpLastChatId = localStorage.getItem("lastGMChatId");
                    lastChatId =
                        tmpLastChatId && tmpLastChatId !== "" ? Number(tmpLastChatId) : null;
                }
                if (lastChatType === 3) {
                    const tmpLastChatId = localStorage.getItem("lastPMChatId");
                    lastChatId =
                        tmpLastChatId && tmpLastChatId !== "" ? Number(tmpLastChatId) : null;
                }
                if (lastChatType === 4) {
                    const tmpLastChatId = localStorage.getItem("lastPinnedChatId");
                    lastChatId =
                        tmpLastChatId && tmpLastChatId !== "" ? Number(tmpLastChatId) : null;
                }

                if (lastChatId !== null) {
                    // Fetch the last chat info
                    const popSpecificChatWorker = new PopSpecificChatWorker();
                    popSpecificChatWorker.postMessage({
                        chatId: lastChatId,
                        chatType: lastChatType,
                    });
                    popSpecificChatWorker.onmessage = (event) => {
                        const fetchedChat: any = event.data;
                        if (
                            fetchedChat.length !== 0 &&
                            fetchedChat !== undefined &&
                            fetchedChat !== null
                        ) {
                            // Fetch the last chat messages info
                            const popSpecificMessagesWorker = new PopSpecificMessagesWorker();
                            popSpecificMessagesWorker.postMessage({
                                chatId: lastChatId,
                                chatType: lastChatType,
                            });
                            popSpecificMessagesWorker.onmessage = (event) => {
                                const fetchedMessages: MessageProps[] = event.data;
                                if (fetchedMessages !== undefined) {
                                    const currentMainChat: ChatProps = {
                                        chatId: fetchedChat.chatId,
                                        chatName: fetchedChat.chatName,
                                        chatType: lastChatType,
                                        dmPartnerUser: fetchedChat.dmPartnerUser,
                                        lastReadMessageId: fetchedChat.lastReadMessageId,
                                        messages: fetchedMessages,
                                        latestMessage: fetchedMessages[fetchedMessages.length - 1],
                                        latestMessageText:
                                            fetchedMessages[fetchedMessages.length - 1]
                                                .contentText,
                                        TSLastMessage: fetchedChat.TSLastMessage,
                                        project: fetchedChat.project,
                                        isPrivate: fetchedChat.isPrivate,
                                        profileImagePath: fetchedChat.profileImagePath,
                                    };
                                    setCurrentMainChat(currentMainChat);
                                    setIsInitialChatLoaded(true);
                                } else {
                                    console.error(
                                        "Failed due to fetchedMessages:",
                                        fetchedMessages
                                    );
                                }
                            };

                            return () => {
                                popSpecificChatWorker.terminate();
                                popSpecificMessagesWorker.terminate();
                            };
                        } else {
                            console.warn(
                                "Failed due to fetchedChat is null or undefined;",
                                fetchedChat
                            );
                            setCurrentMainChat(defaultChat);
                            setIsInitialChatLoaded(true);
                            return () => {
                                popSpecificChatWorker.terminate();
                            };
                        }
                    };
                } else {
                    console.warn(
                        "Failed due to lastChatId is null or undefined, using default chat"
                    );
                    setCurrentMainChat(defaultChat);
                    setIsInitialChatLoaded(true);
                }
            }
        } else {
            console.warn("lastChatType is not set");
            setIsInitialChatLoaded(true);
        }
    }, [isDMHistoryLoaded, isGMHistoryLoaded, isPMHistoryLoaded]);

    // Set "isLoading" true after initialization is completed
    useEffect(() => {
        if (
            isInboxLoaded &&
            isActivityHistoryLoaded &&
            isDMHistoryLoaded &&
            isGMHistoryLoaded &&
            isPMHistoryLoaded &&
            isTeamMembersLoaded &&
            isInitialChatLoaded &&
            isProjectTasksLoaded
        ) {
            setIsLoading(false);
        }
    }, [
        isInboxLoaded,
        isActivityHistoryLoaded,
        isDMHistoryLoaded,
        isGMHistoryLoaded,
        isPMHistoryLoaded,
        isTeamMembersLoaded,
        isInitialChatLoaded,
        isProjectTasksLoaded,
    ]);
};

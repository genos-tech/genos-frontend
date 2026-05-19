import { useEffect, useState } from "react";

import {
    activityChannel,
    chatChannel,
    inboxChannel,
    tasksChannel,
    usersChannel,
} from "../db/workers/channels";
import { defaultChat } from "../features/chat/utils/defaults";
import { UserProps } from "../types/admin";
import { ChatProps } from "../types/chat";

// Hydrates the local IDB cache from the backend on app boot. Each section
// runs in its own effect so the corresponding load isn't blocked by an
// unrelated category. Channels share a single persistent worker per
// category — see /db/workers/pool.ts — so this no longer spawns N+1
// workers per page load.
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
    const [isMDMHistoryLoaded, setIsMDMHistoryLoaded] = useState<boolean | null>(false);
    const [isPMHistoryLoaded, setIsPMHistoryLoaded] = useState<boolean | null>(false);
    const [isTeamMembersLoaded, setIsTeamMembersLoaded] = useState<boolean | null>(false);
    const [isInitialChatLoaded, setIsInitialChatLoaded] = useState<boolean | null>(false);
    const [isProjectTasksLoaded, setIsProjectTasksLoaded] = useState<boolean | null>(false);

    const isReady = (token: string | null, user: UserProps): token is string =>
        Boolean(token) && user.userId !== "" && user.userName !== "";

    // The post-channel idiom: each effect grabs a `cancelled` flag so the
    // `.then` callback no-ops if the component unmounted mid-flight (the
    // channel itself stays alive). This replaces the old `worker.terminate`
    // cleanup, which used to make the next call pay worker-startup cost.
    useEffect(() => {
        if (!isReady(accessToken, myself)) return;
        let cancelled = false;
        inboxChannel
            .request("loadInbox", { myself, accessToken })
            .then(() => !cancelled && setIsInboxLoaded(true))
            .catch((err) => {
                if (!cancelled) console.error("Failed initial inbox data loading", err);
            });
        return () => {
            cancelled = true;
        };
    }, [myself, accessToken]);

    useEffect(() => {
        if (!isReady(accessToken, myself)) return;
        let cancelled = false;
        activityChannel
            .request("loadActivityHistory", { myself, accessToken })
            .then(() => !cancelled && setIsActivityHistoryLoaded(true))
            .catch((err) => {
                if (!cancelled) console.error("Failed initial activity history loading", err);
            });
        return () => {
            cancelled = true;
        };
    }, [myself, accessToken]);

    useEffect(() => {
        if (!isReady(accessToken, myself)) return;
        let cancelled = false;
        chatChannel
            .request("loadDMHistory", { myself, accessToken })
            .then(() => !cancelled && setIsDMHistoryLoaded(true))
            .catch((err) => {
                if (!cancelled) console.error("Failed initial DM history loading", err);
            });
        return () => {
            cancelled = true;
        };
    }, [myself, accessToken]);

    useEffect(() => {
        if (!isReady(accessToken, myself)) return;
        let cancelled = false;
        chatChannel
            .request("loadGMHistory", { myself, accessToken })
            .then(() => !cancelled && setIsGMHistoryLoaded(true))
            .catch((err) => {
                if (!cancelled) console.error("Failed initial GM history loading", err);
            });
        return () => {
            cancelled = true;
        };
    }, [myself, accessToken]);

    useEffect(() => {
        if (!isReady(accessToken, myself)) return;
        let cancelled = false;
        chatChannel
            .request("loadMDMHistory", { myself, accessToken })
            .then(() => !cancelled && setIsMDMHistoryLoaded(true))
            .catch((err) => {
                if (!cancelled) console.error("Failed initial MDM history loading", err);
            });
        return () => {
            cancelled = true;
        };
    }, [myself, accessToken]);

    useEffect(() => {
        if (!isReady(accessToken, myself)) return;
        let cancelled = false;
        chatChannel
            .request("loadPMHistory", { myself, accessToken })
            .then(() => !cancelled && setIsPMHistoryLoaded(true))
            .catch((err) => {
                if (!cancelled) console.error("Failed initial PM history loading", err);
            });
        return () => {
            cancelled = true;
        };
    }, [myself, accessToken]);

    useEffect(() => {
        if (!isReady(accessToken, myself)) return;
        let cancelled = false;
        usersChannel
            .request("loadTeamMembers", { myself, accessToken })
            .then((members) => {
                if (cancelled) return;
                if (members) setIsTeamMembersLoaded(true);
                else console.error("Failed initial team member loading");
            })
            .catch((err) => {
                if (!cancelled) console.error("Failed initial team member loading", err);
            });
        return () => {
            cancelled = true;
        };
    }, [myself, accessToken]);

    useEffect(() => {
        const lastProjectId = localStorage.getItem("lastProjectId");
        if (!isReady(accessToken, myself) || !lastProjectId) {
            setIsProjectTasksLoaded(true);
            return;
        }
        let cancelled = false;
        tasksChannel
            .request("loadProjectTasks", {
                myself,
                projectId: Number(lastProjectId),
                accessToken,
            })
            .then(() => !cancelled && setIsProjectTasksLoaded(true))
            .catch((err) => {
                if (!cancelled) {
                    console.error("Failed initial project tasks loading", err);
                    setIsProjectTasksLoaded(true);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [myself, accessToken]);

    // After all four chat-history caches are populated, resume the user's
    // last open chat (chat type + chat id from localStorage). The two
    // channel calls below are sequential because we need the chat row
    // before we can fetch its messages.
    useEffect(() => {
        if (!(isDMHistoryLoaded && isGMHistoryLoaded && isMDMHistoryLoaded && isPMHistoryLoaded)) {
            return;
        }
        let cancelled = false;
        const tmpLastChatType = localStorage.getItem("lastChatType");
        const lastChatType =
            tmpLastChatType && tmpLastChatType !== "" ? Number(tmpLastChatType) : -1;
        if (lastChatType === -1) {
            console.warn("lastChatType is not set");
            setIsInitialChatLoaded(true);
            return;
        }

        const chatIdKeyByType: Record<number, string> = {
            1: "lastDMChatId",
            2: "lastGMChatId",
            3: "lastPMChatId",
            4: "lastMDMChatId",
        };
        const storageKey = chatIdKeyByType[lastChatType];
        const storedId = storageKey ? localStorage.getItem(storageKey) : null;
        const lastChatId = storedId && storedId !== "" ? Number(storedId) : null;
        if (lastChatId === null) {
            console.warn("Failed due to lastChatId is null or undefined, using default chat");
            setCurrentMainChat(defaultChat);
            setIsInitialChatLoaded(true);
            return;
        }

        (async () => {
            try {
                const fetchedChat = await chatChannel.request("popSpecificChat", {
                    chatId: lastChatId,
                    chatType: lastChatType,
                });
                if (cancelled) return;
                if (!fetchedChat) {
                    console.warn("Failed due to fetchedChat is null or undefined", fetchedChat);
                    setCurrentMainChat(defaultChat);
                    setIsInitialChatLoaded(true);
                    return;
                }
                const fetchedMessages = await chatChannel.request("popSpecificMessages", {
                    chatId: lastChatId,
                    chatType: lastChatType,
                });
                if (cancelled) return;
                if (!fetchedMessages) {
                    console.error("Failed due to fetchedMessages:", fetchedMessages);
                    setCurrentMainChat(defaultChat);
                    setIsInitialChatLoaded(true);
                    return;
                }
                const lastMsg =
                    fetchedMessages.length > 0
                        ? fetchedMessages[fetchedMessages.length - 1]
                        : fetchedChat.latestMessage;
                const currentMainChat: ChatProps = {
                    chatId: fetchedChat.chatId,
                    chatName: fetchedChat.chatName,
                    chatType: lastChatType,
                    dmPartnerUser: fetchedChat.dmPartnerUser,
                    lastReadMessageId: fetchedChat.lastReadMessageId,
                    messages: fetchedMessages,
                    latestMessage: lastMsg,
                    latestMessageText: lastMsg?.contentText ?? "",
                    TSLastMessage: fetchedChat.TSLastMessage,
                    project: fetchedChat.project,
                    isPrivate: fetchedChat.isPrivate,
                    profileImagePath: fetchedChat.profileImagePath,
                };
                setCurrentMainChat(currentMainChat);
                setIsInitialChatLoaded(true);
            } catch (err) {
                if (!cancelled) {
                    console.error("Failed initial chat hydrate", err);
                    setCurrentMainChat(defaultChat);
                    setIsInitialChatLoaded(true);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isDMHistoryLoaded, isGMHistoryLoaded, isMDMHistoryLoaded, isPMHistoryLoaded]);

    // Set "isLoading" true after initialization is completed
    useEffect(() => {
        if (
            isInboxLoaded &&
            isActivityHistoryLoaded &&
            isDMHistoryLoaded &&
            isGMHistoryLoaded &&
            isMDMHistoryLoaded &&
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
        isMDMHistoryLoaded,
        isPMHistoryLoaded,
        isTeamMembersLoaded,
        isInitialChatLoaded,
        isProjectTasksLoaded,
    ]);
};

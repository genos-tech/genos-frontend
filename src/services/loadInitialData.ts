import { useEffect, useState } from "react";

import { activityChannel, inboxChannel, tasksChannel, usersChannel } from "../db/workers/channels";
import { readV3CachedMessages } from "../features/chat/services/loadV3SpecificMessages";
import { defaultChat } from "../features/chat/utils/defaults";
import { taskTypes } from "../features/tasks/types/TaskTableTypes";
import { UserProps } from "../types/admin";
import { ChatProps } from "../types/chat";
import { isV3Uuid } from "../utils/legacyId";
import { channelService } from "./channel/channelService";
import { isTeamHydrated, markTeamHydrated } from "./hydrationState";

// Hard ceiling on the boot spinner. Cache reads resolve in milliseconds, so
// this only ever fires as a safety net on a cold start whose first network
// refresh is hung — better an empty shell that fills in when the background
// refresh lands (App owns it) than an indefinite spinner.
const BOOT_SPINNER_CEILING_MS = 8_000;

// Cache-first boot gate. Renders the workspace shell from IndexedDB as soon
// as the local cache is readable, instead of blocking on the network:
//
//   • WARM cache (returning user, same team): each `is*Loaded` flag flips off
//     a fast IDB read (`pop*` / the v3 channel snapshot), so the shell appears
//     in ~the time it takes auth to settle. The network hydration runs in the
//     background from `App` (`refreshAllData`), which survives this component's
//     unmount and re-pulls fresh data into React state when it lands.
//   • COLD cache (first login, or just after a team switch wiped IDB): the
//     `pop*` reads return empty immediately, so we'd flash an empty shell. To
//     avoid that, the final gate additionally waits for `firstRefreshDone`
//     (App's first background refresh completing) before revealing the shell.
//
// `firstRefreshDone` is owned by `App` and passed down so the two stay in one
// place; the per-team hydrated marker (`hydrationState`) distinguishes
// "empty because new/cleared" from "empty but genuinely has no rows".
//
// Mirrors the pattern chat already used: `channelService` flips `hydrated`
// off its IDB read alone and refreshes over the wire in the background.
export const loadInitialData = (
    myself: UserProps,
    accessToken: string | null,
    setIsLoading: (state: boolean) => void,
    setCurrentMainChat: (value: ChatProps) => void,
    firstRefreshDone: boolean
) => {
    const [isInboxLoaded, setIsInboxLoaded] = useState<boolean | null>(false);
    const [isActivityHistoryLoaded, setIsActivityHistoryLoaded] = useState<boolean | null>(false);
    // True once `channelService` has finished hydrating chat history from IDB.
    // Subscribed to below.
    const [isChannelsHydrated, setIsChannelsHydrated] = useState<boolean>(false);
    const [isTeamMembersLoaded, setIsTeamMembersLoaded] = useState<boolean | null>(false);
    const [isInitialChatLoaded, setIsInitialChatLoaded] = useState<boolean | null>(false);
    const [isProjectTasksLoaded, setIsProjectTasksLoaded] = useState<boolean | null>(false);

    const isReady = (token: string | null, user: UserProps): token is string =>
        Boolean(token) && user.userId !== "" && user.userName !== "";

    // The post-channel idiom: each effect grabs a `cancelled` flag so the
    // `.then` callback no-ops if the component unmounted mid-flight (the
    // channel itself stays alive).
    //
    // Each category now gates on its IDB-read handler (`pop*`) rather than the
    // network loader — the read confirms the store is available and returns
    // whatever is cached (empty on a cold start). The network refresh is
    // driven separately by `App` so it isn't on the first-paint path.
    useEffect(() => {
        if (!isReady(accessToken, myself)) return;
        let cancelled = false;
        inboxChannel
            .request("popInboxItems", {})
            .then(() => !cancelled && setIsInboxLoaded(true))
            .catch((err) => {
                if (!cancelled) {
                    console.error("Failed initial inbox cache read", err);
                    setIsInboxLoaded(true);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [myself, accessToken]);

    useEffect(() => {
        if (!isReady(accessToken, myself)) return;
        let cancelled = false;
        activityChannel
            .request("popActivityMessages", { myself })
            .then(() => !cancelled && setIsActivityHistoryLoaded(true))
            .catch((err) => {
                if (!cancelled) {
                    console.error("Failed initial activity cache read", err);
                    setIsActivityHistoryLoaded(true);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [myself, accessToken]);

    // Chat history is hydrated by `channelService` (subscribed in
    // `useChannelServiceBootstrap`). Subscribe to its `hydrated` flag so the
    // gate waits for the v3 store's IDB hydration (not the network refresh).
    useEffect(() => {
        const apply = () => {
            if (channelService.getSnapshot().hydrated) setIsChannelsHydrated(true);
        };
        apply();
        const unsubscribe = channelService.subscribe(apply);
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (!isReady(accessToken, myself)) return;
        let cancelled = false;
        usersChannel
            .request("popTeamMembers", { myself })
            .then(() => !cancelled && setIsTeamMembersLoaded(true))
            .catch((err) => {
                if (!cancelled) {
                    console.error("Failed initial team member cache read", err);
                    setIsTeamMembersLoaded(true);
                }
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
            .request("popSpecificProjectTasks", {
                projectId: Number(lastProjectId),
                targetStatuses: taskTypes.all.statuses,
            })
            .then(() => !cancelled && setIsProjectTasksLoaded(true))
            .catch((err) => {
                if (!cancelled) {
                    console.error("Failed initial project tasks cache read", err);
                    setIsProjectTasksLoaded(true);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [myself, accessToken]);

    // After v3 channels have hydrated, resume the user's last open chat (chat
    // type + chat id from localStorage) from the IN-MEMORY SNAPSHOT — no
    // network wait. `readV3CachedMessages` returns whatever the boot-time IDB
    // hydration already loaded; a background `syncChannel` revalidates and the
    // `useChatManagement` subscription patches fresh messages into the open
    // chat once it lands (so we must NOT await it here).
    useEffect(() => {
        if (!isChannelsHydrated) return;
        const tmpLastChatType = localStorage.getItem("lastChatType");
        const lastChatType =
            tmpLastChatType && tmpLastChatType !== "" ? Number(tmpLastChatType) : -1;
        if (lastChatType === -1) {
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

        // v3 migration guard. Legacy sessions wrote integer chatIds here (e.g.
        // "3"). Skip the restore when the stored id isn't a v3 UUID, AND clear
        // the key so subsequent reloads don't keep hitting the same trap.
        if (storedId && !isV3Uuid(storedId)) {
            if (storageKey) localStorage.removeItem(storageKey);
            setCurrentMainChat(defaultChat);
            setIsInitialChatLoaded(true);
            return;
        }

        const lastChatId = storedId && storedId !== "" ? storedId : null;
        if (lastChatId === null) {
            setCurrentMainChat(defaultChat);
            setIsInitialChatLoaded(true);
            return;
        }

        try {
            const snapshot = channelService.getSnapshot();
            const channel = snapshot.channels.get(lastChatId);
            if (!channel) {
                // The user's last-opened channel isn't in the v3 store yet
                // (REST refresh in flight, or membership changed). Land on
                // default — they can reopen from the v3 sidebar once it renders.
                setCurrentMainChat(defaultChat);
                setIsInitialChatLoaded(true);
                return;
            }

            // Synchronous cache read — no `await`, so the gate flips
            // immediately. Revalidate in the background; live updates flow
            // through the `useChatManagement` subscription, not this one-shot.
            const legacyMessages = readV3CachedMessages(lastChatId, lastChatType);
            void channelService.syncChannel(lastChatId);

            const lastMsg =
                legacyMessages.length > 0 ? legacyMessages[legacyMessages.length - 1] : null;
            const dmPartner = snapshot.membersByChannel
                .get(channel.id)
                ?.find((m) => m.userId !== myself.userId);
            const currentMainChat: ChatProps = {
                chatId: channel.id,
                chatName: channel.title,
                chatType: lastChatType,
                dmPartnerUser: {
                    userId: dmPartner?.userId ?? "",
                    userName: "",
                    userEmail: "",
                    teamId: "",
                    teamName: "",
                    avatarImgPath: "",
                    tsLastSeen: "",
                    tsJoined: dmPartner?.tsJoined ?? "",
                },
                lastReadMessageId: lastMsg?.messageId != null ? String(lastMsg.messageId) : "",
                messages: legacyMessages,
                latestMessage: lastMsg ?? defaultChat.latestMessage,
                latestMessageText: lastMsg?.contentText ?? "",
                TSLastMessage: lastMsg?.tsSent ?? channel.tsUpdated ?? "",
                isPrivate: channel.isPrivate,
                profileImagePath: channel.profileImageUrl || undefined,
            };
            setCurrentMainChat(currentMainChat);
            setIsInitialChatLoaded(true);
        } catch (err) {
            console.error("Failed initial chat hydrate", err);
            setCurrentMainChat(defaultChat);
            setIsInitialChatLoaded(true);
        }
    }, [isChannelsHydrated]);

    // Reveal the shell once the local cache is readable. On a WARM cache
    // (`isTeamHydrated`) that's as soon as the six cache flags resolve; on a
    // COLD cache we additionally wait for App's first background refresh
    // (`firstRefreshDone`) so the first paint isn't an empty shell. Once a cold
    // start reveals, mark the team hydrated so the next boot is warm.
    useEffect(() => {
        const cacheReady =
            isInboxLoaded &&
            isActivityHistoryLoaded &&
            isChannelsHydrated &&
            isTeamMembersLoaded &&
            isInitialChatLoaded &&
            isProjectTasksLoaded;
        if (!cacheReady) return;
        const warm = isTeamHydrated(myself.teamId);
        if (warm || firstRefreshDone) {
            setIsLoading(false);
            if (!warm) markTeamHydrated(myself.teamId);
        }
    }, [
        isInboxLoaded,
        isActivityHistoryLoaded,
        isChannelsHydrated,
        isTeamMembersLoaded,
        isInitialChatLoaded,
        isProjectTasksLoaded,
        firstRefreshDone,
        myself.teamId,
    ]);

    // Safety cap: never hold the spinner longer than the ceiling. Does NOT
    // mark the team hydrated (the cache may not have refreshed), so a boot that
    // only cleared via this fallback stays cold next time. The timer is cleared
    // on unmount, i.e. as soon as the normal gate reveals the shell.
    useEffect(() => {
        const t = window.setTimeout(() => setIsLoading(false), BOOT_SPINNER_CEILING_MS);
        return () => window.clearTimeout(t);
    }, []);
};

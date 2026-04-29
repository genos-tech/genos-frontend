import { useEffect, useRef } from "react";

import { useAuth } from "../../context/AuthContext";
import { initDB } from "../../db/config/schema";
import { DatabaseUtils } from "../../db/utils/database";
import PopTeamUsersWorker from "../../db/workers/popTeamUsersWorker.ts?worker";
import { useMyself } from "./useAuth";
import { useTeamManagement } from "./useTeamManagement";
import { useUIStateManagement } from "./useUIStateManagement";

export const useAppInitialization = () => {
    const { accessToken } = useAuth();
    const { myself, setMyself } = useMyself(accessToken);
    const useUISM = useUIStateManagement();
    const useTEM = useTeamManagement(myself, accessToken);

    // Track the team we last initialized for so we can detect a real switch
    // (vs. the initial mount where currentTeamId starts as "").
    const lastInitializedTeamIdRef = useRef<string>("");

    // Initialize database
    useEffect(() => {
        initDB();
    }, []);

    // Initialize current team and setup worker
    useEffect(() => {
        useTEM.initCurrentTeam();
        if (myself.teamId !== useTEM.currentTeamId) {
            const previousTeamId = lastInitializedTeamIdRef.current;
            const isTeamSwitch = previousTeamId !== "" && previousTeamId !== myself.teamId;

            if (isTeamSwitch) {
                // The user switched teams. Wipe all team-scoped IndexedDB stores
                // BEFORE flipping isLoading on, so InitialLoad's workers re-fetch
                // fresh data into an empty cache. Without this, stale chats/projects/
                // notes/tasks from the previous team leak into the new team.
                (async () => {
                    await DatabaseUtils.clearTeamScopedStores();
                    useTEM.setCurrentTeamId(myself.teamId);
                    useUISM.setIsLoading(true);
                    lastInitializedTeamIdRef.current = myself.teamId;
                })();
            } else {
                useTEM.setCurrentTeamId(myself.teamId);
                useUISM.setIsLoading(true);
                lastInitializedTeamIdRef.current = myself.teamId;
            }
        }

        if (myself.userId !== "") {
            const popTeamUsersWorker = new PopTeamUsersWorker();

            // Only for the initialization
            popTeamUsersWorker.postMessage({ myself });
            popTeamUsersWorker.onmessage = (event) => {
                const data = event.data;
                if (data.error) {
                    console.error("Worker failed:", data.error);
                } else {
                    useTEM.setTeamMemberProfiles(data);
                }
            };

            // Run every minute
            const interval = setInterval(() => {
                popTeamUsersWorker.postMessage({ myself });
                popTeamUsersWorker.onmessage = (event) => {
                    const data = event.data;
                    if (data.error) {
                        console.error("Worker failed:", data.error);
                    } else {
                        useTEM.setTeamMemberProfiles(data);
                    }
                };
            }, 60_000);

            return () => {
                popTeamUsersWorker.terminate();
                clearInterval(interval);
            };
        }
    }, [myself]);

    return {
        accessToken,
        myself,
        setMyself,
        useUISM,
        useTEM,
    };
};

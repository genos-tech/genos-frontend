import { useEffect, useRef } from "react";

import { useAuth } from "../../context/AuthContext";
import { initDB } from "../../db/config/schema";
import { DatabaseUtils } from "../../db/utils/database";
import { clearTeamHydrated } from "../../services/hydrationState";
import { useMyself } from "./useAuth";
import { useMentionGroups } from "./useMentionGroups";
import { useTeamManagement } from "./useTeamManagement";
import { useUIStateManagement } from "./useUIStateManagement";

export const useAppInitialization = () => {
    const { accessToken } = useAuth();
    const { myself, setMyself } = useMyself(accessToken);
    const useUISM = useUIStateManagement();
    const useTEM = useTeamManagement(myself, accessToken);
    // Single instance of the mention-group cache for the whole app —
    // surfaced via `MentionGroupsProvider` in App.tsx so every editor's
    // `@` suggestion menu reads from the same fetched list instead of
    // each editor instance hitting `/mention-group/` on its own.
    const useMGM = useMentionGroups(myself, accessToken);

    // Track the team we last initialized for so we can detect a real switch
    // (vs. the initial mount where currentTeamId starts as "").
    const lastInitializedTeamIdRef = useRef<string>("");

    // Initialize database
    useEffect(() => {
        initDB();
    }, []);

    // Initialize current team and (on team switch) wipe team-scoped state.
    //
    // The `popTeamUsersWorker` interval that hydrates `teamMemberProfiles`
    // lives in `useTeamManagement` itself; running a second copy here
    // doubled the per-minute reference flips on the same map and added
    // no signal. Removed.
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
                    // The new team's IDB is now empty — drop the hydrated
                    // marker so `loadInitialData` treats it as a cold start
                    // (waits for the first refresh) instead of flashing an
                    // empty shell from the wiped cache.
                    clearTeamHydrated();
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
    }, [myself]);

    return {
        accessToken,
        myself,
        setMyself,
        useUISM,
        useTEM,
        useMGM,
    };
};

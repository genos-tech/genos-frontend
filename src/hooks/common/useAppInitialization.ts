import { useEffect } from "react";

import { useAuth } from "../../context/AuthContext";
import { initDB } from "../../db/config/schema";
import PopTeamUsersWorker from "../../workers/popTeamUsersWorker.ts?worker";
import { useMyself } from "./useAuth";
import { useTeamManagement } from "./useTeamManagement";
import { useUIStateManagement } from "./useUIStateManagement";

export const useAppInitialization = () => {
    const { accessToken } = useAuth();
    const { myself, setMyself } = useMyself(accessToken);
    const useUISM = useUIStateManagement();
    const useTEM = useTeamManagement(myself, accessToken);

    // Initialize database
    useEffect(() => {
        initDB();
    }, []);

    // Initialize current team and setup worker
    useEffect(() => {
        useTEM.initCurrentTeam();
        if (myself.teamId !== useTEM.currentTeamId) {
            useTEM.setCurrentTeamId(myself.teamId);
            useUISM.setIsLoading(true);
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

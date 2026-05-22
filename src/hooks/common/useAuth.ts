import { useEffect, useState } from "react";

import { UserProps } from "../../types/admin";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";

// localStorage keys that `fetchUserData` reads into `myself`. The
// cross-tab `storage` listener only re-pulls when one of these (or
// `null`, meaning a full `localStorage.clear()`) changed — every other
// write is noise (PostHog, draft caches, history bucket, etc.).
const WATCHED_STORAGE_KEYS = new Set<string>([
    "teamId",
    "teamName",
    "userId",
    "userName",
    "userEmail",
    "tsJoined",
    "isOfflineForced",
    "role",
    "baseCountry",
    "customStatus",
    "avatarImgPath",
]);

export const useMyself = (accessToken: string | null) => {
    const [myself, setMyself] = useState<UserProps>({
        teamId: "",
        teamName: "",
        userId: "",
        userName: "",
        userEmail: "",
        tsLastSeen: "",
        tsJoined: "",
        customStatus: "",
        avatarImgPath: "",
    });

    useEffect(() => {
        const fetchUserData = () => {
            const newMyself: UserProps = {
                teamId: localStorage.getItem("teamId") || "",
                teamName: localStorage.getItem("teamName") || "",
                userId: localStorage.getItem("userId") || "",
                userName: localStorage.getItem("userName") || "",
                userEmail: localStorage.getItem("userEmail") || "",
                tsLastSeen: getLocalCurrentTimestamp(),
                tsJoined: localStorage.getItem("tsJoined") || "",
                isOfflineForced: localStorage.getItem("isOfflineForced") || "false",
                role: localStorage.getItem("role") || "",
                baseCountry: localStorage.getItem("baseCountry") || "",
                customStatus: localStorage.getItem("customStatus") || "",
                avatarImgPath: localStorage.getItem("avatarImgPath") || "",
            };

            setMyself(newMyself);
        };

        // Add a small delay to ensure localStorage is updated
        setTimeout(fetchUserData, 50);

        // Listen for cross-document storage updates. Filter by key —
        // PostHog (and likely other third-party libs) re-writes its own
        // localStorage entries from a separate document context, which
        // fires `storage` events here. Re-pulling `myself` on those
        // events generated a new `tsLastSeen` every time and forced
        // every consumer of `myself` to churn — `useWebSocket`
        // reconnected on every fire. Only react to keys this hook
        // actually reads. `evt.key === null` covers `localStorage.clear()`,
        // which wipes our keys too.
        const onStorage = (evt: StorageEvent) => {
            if (evt.key !== null && !WATCHED_STORAGE_KEYS.has(evt.key)) return;
            fetchUserData();
        };
        window.addEventListener("storage", onStorage);

        return () => {
            window.removeEventListener("storage", onStorage);
        };
    }, [accessToken]);

    return { myself, setMyself };
};

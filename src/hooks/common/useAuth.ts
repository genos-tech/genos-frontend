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
        const fetchUserData = (trigger: string, evt?: StorageEvent) => {
            // DIAG: log what triggered the fetch so we can find whoever
            // is firing storage events at 7-9s intervals in PROD.
            console.log("[AUTH-DIAG] fetchUserData", {
                trigger,
                storageEventKey: evt?.key ?? null,
                storageEventNewValue: evt?.newValue ?? null,
                storageEventOldValue: evt?.oldValue ?? null,
                storageEventUrl: evt?.url ?? null,
                storageEventStorageArea:
                    evt?.storageArea === window.localStorage
                        ? "localStorage"
                        : evt?.storageArea === window.sessionStorage
                          ? "sessionStorage"
                          : "other",
            });
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
        setTimeout(() => fetchUserData("setTimeout"), 50);

        // Listen for storage updates in case another tab updates it.
        // Filter by key: PostHog (and likely other third-party libs)
        // re-writes its own localStorage entries from a separate document
        // context, which fires `storage` events here. Re-pulling `myself`
        // on those events created a new `tsLastSeen` every time and made
        // every consumer that depends on `myself` (notably `useWebSocket`,
        // which reconnects on dep change) churn. We only care about the
        // keys actually read in `fetchUserData`; everything else is noise.
        // `evt.key === null` covers `localStorage.clear()` — treat that as
        // a real change since it wipes our keys too.
        const onStorage = (evt: StorageEvent) => {
            if (evt.key !== null && !WATCHED_STORAGE_KEYS.has(evt.key)) return;
            fetchUserData("storage-event", evt);
        };
        window.addEventListener("storage", onStorage);

        return () => {
            window.removeEventListener("storage", onStorage);
        };
    }, [accessToken]);

    return { myself, setMyself };
};

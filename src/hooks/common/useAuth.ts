import { useEffect, useState } from "react";

import { UserProps } from "../../types/admin";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";

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

        // Listen for storage updates in case another tab updates it
        const onStorage = (evt: StorageEvent) => fetchUserData("storage-event", evt);
        window.addEventListener("storage", onStorage);

        return () => {
            window.removeEventListener("storage", onStorage);
        };
    }, [accessToken]);

    return { myself, setMyself };
};

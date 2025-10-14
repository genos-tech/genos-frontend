import { useState, useEffect } from "react";
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

        // Listen for storage updates in case another tab updates it
        window.addEventListener("storage", fetchUserData);

        return () => {
            window.removeEventListener("storage", fetchUserData);
        };
    }, [accessToken]);

    return { myself, setMyself };
};

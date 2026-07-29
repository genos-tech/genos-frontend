import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { analytics } from "../../services/analytics";
import { clearAllEditorDrafts } from "../../utils/editorDraftStorage";

const base_url = import.meta.env.VITE_API_BASE_URL;

// `userId` is intentionally NOT cleared: it survives logout as a
// "last signed-in user" marker so the next sign-in can detect a user
// change and decide whether to wipe IndexedDB.
const KEYS_TO_CLEAR = [
    "isSigningIn",
    "userEmail",
    "userName",
    "avatarImgPath",
    "teamId",
    "tsJoined",
    "isOfflineForced",
    "role",
    "baseCountry",
    "customStatus",
    "teamName",
    "lastOpenMyNoteId",
    "lastOpenNoteType",
    "lastChatType",
    "lastDMChatId",
    "lastGMChatId",
    "lastPMChatId",
    "lastPinnedChatId",
    "lastPinnedChatType",
    "lastProjectId",
    "lastOpenChatNoteId",
    "lastOpenTaskNoteId",
    "currentMainChatId",
    "isDemoUser",
];

/**
 * Sign-out, shared by the desktop sidebar and the mobile account sheet.
 *
 * Extracted so the two entry points can't drift: this clears local
 * session state (storage keys, per-team history buckets, editor drafts,
 * analytics identity) and a divergent copy would leave a signed-out
 * device holding another user's data.
 */
export const useSignOut = () => {
    const { setAccessToken } = useAuth();
    const navigate = useNavigate();

    return async (): Promise<void> => {
        try {
            const response = await fetch(`${base_url}/user/signout/`, {
                method: "POST",
                credentials: "include",
            });

            if (!response.ok) {
                console.error("Logout failed");
                return;
            }

            KEYS_TO_CLEAR.forEach((key) => localStorage.setItem(key, ""));
            localStorage.setItem("isOfflineForced", "false");
            // Wipe per-team history buckets ("genos.history.v1.<teamId>").
            // The user may belong to several teams; logout should clear
            // every team's history on this device, not just the active one.
            try {
                const historyKeys: string[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith("genos.history.v1.")) historyKeys.push(k);
                }
                historyKeys.forEach((k) => localStorage.removeItem(k));
            } catch {
                // ignore — storage may be unavailable in some embedded contexts
            }
            clearAllEditorDrafts();
            analytics.reset();

            setAccessToken(null);
            navigate("/");
        } catch (error) {
            console.error("Error logging out:", error);
        }
    };
};

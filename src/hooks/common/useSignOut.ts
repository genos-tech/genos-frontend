import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { DatabaseUtils } from "../../db/utils/database";
import { analytics } from "../../services/analytics";
import { clearPrivateProfile } from "../../services/privateProfileStore";
import { clearAllEditorDrafts } from "../../utils/editorDraftStorage";

const base_url = import.meta.env.VITE_API_BASE_URL;

// `userId` is intentionally NOT cleared: it survives logout as a
// "last signed-in user" marker (SignInForm still uses it to spot a user
// change). The email, phone, country, location and bio were never here to
// clear: they're memory only (`privateProfileStore`, MIP-619).
//
// IndexedDB is wiped below (MIP-809). It used to be left for the next
// sign-in to clear, and only when a DIFFERENT person signed in, which left
// the whole team cache on a signed-out device: the roster with its emails,
// inbox, tasks, messages, to-dos and note text. The price is that the next
// sign-in on this browser loads cold, even for the same person.
const KEYS_TO_CLEAR = [
    "isSigningIn",
    "userName",
    "avatarImgPath",
    "teamId",
    "tsJoined",
    "isOfflineForced",
    "role",
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
            clearPrivateProfile();
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
            // After the server has confirmed the sign-out, and never allowed to
            // fail it: a wipe that cannot finish must not strand someone signed
            // in on a screen that says they are not. `wipeLocalCache` does not
            // throw; the catch is for a failure to even load it.
            try {
                await DatabaseUtils.wipeLocalCache();
            } catch (error) {
                console.error("Could not clear the local cache on sign-out:", error);
            }

            setAccessToken(null);
            navigate("/");
        } catch (error) {
            console.error("Error logging out:", error);
        }
    };
};

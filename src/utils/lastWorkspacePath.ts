/** Persist the last authenticated workspace URL so a logged-in visit
 *  to `/` (or `/signin`) can restore where the user left off instead
 *  of dumping them on /jointeam.
 *
 *  Only paths under `/workspace` are stored — auth/marketing routes
 *  must never become a "last page".
 */

const STORAGE_KEY = "genos-last-workspace-path";
const DEFAULT_WORKSPACE_PATH = "/workspace/genos";

export const getDefaultWorkspacePath = (): string => DEFAULT_WORKSPACE_PATH;

export const saveLastWorkspacePath = (path: string): void => {
    if (!path.startsWith("/workspace")) return;
    try {
        localStorage.setItem(STORAGE_KEY, path);
    } catch {
        // Quota / private mode — ignore; redirect just falls back.
    }
};

export const getLastWorkspacePath = (): string | null => {
    try {
        const path = localStorage.getItem(STORAGE_KEY);
        if (path && path.startsWith("/workspace")) return path;
    } catch {
        // ignore
    }
    return null;
};

/** Destination for a signed-in user hitting a guest-only route.
 *  Prefer the last workspace URL; fall back to Genos home. Users
 *  without a team still go to /jointeam — they can't open workspace. */
export const resolveLoggedInLandingPath = (): string => {
    const teamId = localStorage.getItem("teamId");
    if (!teamId) return "/jointeam";
    return getLastWorkspacePath() ?? DEFAULT_WORKSPACE_PATH;
};

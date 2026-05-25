import {
    activityChannel,
    chatChannel,
    inboxChannel,
    tasksChannel,
    usersChannel,
} from "../db/workers/channels";
import { UserProps } from "../types/admin";

// Re-runs the same set of API→IndexedDB loaders that `loadInitialData`
// performs at boot, then signals the in-React hooks to repull from IDB
// into state. Used by `useWakeRefresh` so a user returning from a long
// idle (closed laptop overnight, network drop) sees fresh data instead
// of whatever was in IDB before the offline stretch.
//
// The two-step (IDB refresh THEN React re-pull) is necessary because
// the hooks read IDB only on their own mount effect; just updating IDB
// doesn't repaint the UI.

interface RefreshAllDataArgs {
    myself: UserProps;
    accessToken: string | null;
    currentProjectId: number | null;
    // In-hook re-pullers, exposed by the existing management hooks. We
    // accept them as args rather than importing the hooks here because
    // each hook owns its own React state that only that instance can
    // update.
    onIDBRefreshed: () => Promise<void> | void;
}

// Channel requests can hang on a bad network; cap each one so a single
// stuck call doesn't block the others (Promise.allSettled below limits
// the blast radius, but a timeout also frees up the worker channel).
const REQUEST_TIMEOUT_MS = 20_000;

const withTimeout = <T>(p: Promise<T>, label: string): Promise<T> => {
    return new Promise((resolve, reject) => {
        const t = window.setTimeout(() => {
            reject(new Error(`[refreshAllData] ${label} timed out`));
        }, REQUEST_TIMEOUT_MS);
        p.then(
            (v) => {
                window.clearTimeout(t);
                resolve(v);
            },
            (e) => {
                window.clearTimeout(t);
                reject(e);
            }
        );
    });
};

export const refreshAllData = async ({
    myself,
    accessToken,
    currentProjectId,
    onIDBRefreshed,
}: RefreshAllDataArgs): Promise<void> => {
    if (!accessToken || !myself.userId) {
        // Auth not ready yet — nothing to refresh. The normal boot flow
        // will pick this up once auth resolves.
        return;
    }

    const tasks: Array<Promise<unknown>> = [
        withTimeout(inboxChannel.request("loadInbox", { myself, accessToken }), "loadInbox"),
        withTimeout(
            activityChannel.request("loadActivityHistory", { myself, accessToken }),
            "loadActivityHistory"
        ),
        withTimeout(
            chatChannel.request("loadDMHistory", { myself, accessToken }),
            "loadDMHistory"
        ),
        withTimeout(
            chatChannel.request("loadGMHistory", { myself, accessToken }),
            "loadGMHistory"
        ),
        withTimeout(
            chatChannel.request("loadMDMHistory", { myself, accessToken }),
            "loadMDMHistory"
        ),
        withTimeout(
            chatChannel.request("loadPMHistory", { myself, accessToken }),
            "loadPMHistory"
        ),
        withTimeout(
            usersChannel.request("loadTeamMembers", { myself, accessToken }),
            "loadTeamMembers"
        ),
    ];
    if (currentProjectId != null && currentProjectId > 0) {
        tasks.push(
            withTimeout(
                tasksChannel.request("loadProjectTasks", {
                    myself,
                    projectId: currentProjectId,
                    accessToken,
                }),
                "loadProjectTasks"
            )
        );
    }

    // `allSettled` so one failed channel doesn't block the rest. The
    // failures are logged but not surfaced — the wake refresh is a
    // best-effort sync, not a user-initiated action that needs error UI.
    const results = await Promise.allSettled(tasks);
    for (const r of results) {
        if (r.status === "rejected") {
            console.warn("[refreshAllData] channel call failed", r.reason);
        }
    }

    // Step 2: push the freshly-cached IDB data into React state. The
    // caller owns this because only their hook instances can mutate
    // their state.
    try {
        await onIDBRefreshed();
    } catch (err) {
        console.error("[refreshAllData] onIDBRefreshed threw", err);
    }
};

import { activityChannel, inboxChannel, usersChannel } from "../db/workers/channels";
import { loadProjectTasks } from "../features/tasks/services/loadProjectTasks";
import { UserProps } from "../types/admin";
import { channelService } from "./channel/channelService";

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

    // Chat history (messages) is owned by `channelService` and caught up
    // by the WS reconnect resync. But the chat-list `unreadCount` is NOT:
    // it's recomputed server-side from the `ReadCursor` and only lands via
    // `listChannels()`. A wake can fire from `visibilitychange` WITHOUT a
    // socket reconnect (the WS often survives a short background stretch),
    // so we can't lean on the reconnect handler to refresh it. Re-pull the
    // channel list here so a read that happened on another device shows up
    // when the user returns to this one. `refreshChannels` is best-effort
    // and swallows its own errors, so it doesn't need the `withTimeout`
    // wrapper the worker-channel calls use.
    void channelService.refreshChannels();
    const tasks: Array<Promise<unknown>> = [
        withTimeout(inboxChannel.request("loadInbox", { myself, accessToken }), "loadInbox"),
        withTimeout(
            // `forceFull: true` — a bare `loadActivityHistory` runs an
            // INCREMENTAL delta keyed on `ts_created_at`, but `Activity` has
            // no `ts_updated_at`, so an `is_read` flip on another device is
            // never in the delta window. Only a full reload re-fetches the
            // now-read rows and clears their unread badge here. See the
            // worker handler for the checkpoint mechanics.
            activityChannel.request("loadActivityHistory", {
                myself,
                accessToken,
                forceFull: true,
            }),
            "loadActivityHistory"
        ),
        withTimeout(
            usersChannel.request("loadTeamMembers", { myself, accessToken }),
            "loadTeamMembers"
        ),
    ];
    if (currentProjectId != null && currentProjectId > 0) {
        // Go through the `loadProjectTasks` wrapper (not `tasksChannel`
        // directly) so this shares the wrapper's in-flight dedup keyed on
        // `teamId:projectId` — on boot `useProjectManagement` fetches the same
        // project's tasks, and overlapping calls now collapse to one request.
        tasks.push(
            withTimeout(
                loadProjectTasks(myself, currentProjectId, accessToken),
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

/**
 * The change-driven refresh behind the `#` menu, the sidebars and the open
 * project's table (MIP-970).
 *
 * Every 60 s (and on focus, on `visibilitychange`, and when the `#` menu asks)
 * the app used to re-fetch ~9 lists whether or not anything had changed. Now a
 * trigger makes ONE call, `GET /changes/`, which returns an opaque token per
 * collection; the loaders of a collection run only when its token differs from
 * the last one that was APPLIED, and nothing else is requested.
 *
 * Rules, each with a reason:
 *
 *   * A token is stored only after every loader of its collection succeeded,
 *     and it is the token read BEFORE the loaders ran. A failed loader leaves
 *     the old token, so the next trigger retries it; a write that lands while
 *     the loaders run bumps the server token past the stored one, so the next
 *     trigger refetches. Never "re-read the token afterwards": that could
 *     record a change the loaders did not see.
 *   * A FULL refresh (every loader, today's behaviour) runs on the first run,
 *     after the identity (user, team) changes, at least every ten minutes (the
 *     backstop: it heals a write that forgot to bump, and the joined display
 *     fields, such as an assignee's name, that a delta never re-sends), and
 *     whenever `/changes/` fails or answers with something unusable. A 404
 *     from an API that predates the endpoint is such a failure, so the client
 *     can deploy first.
 *   * State belongs to the refresher INSTANCE, never to module scope. The app
 *     mounts hooks in more than one place, and each host's loaders write into
 *     that host's own state: tokens shared between two hosts would let the
 *     first host's success suppress the second host's loaders for good.
 */

/** A full refresh at least this often, whatever the tokens say. */
export const FULL_REFRESH_BACKSTOP_MS = 10 * 60_000;

/** The keys of `tokens` in the `/changes/` response, and what each one drives. */
export const CHANGE_COLLECTIONS = [
    "tasks_project",
    "tasks_team",
    "projects",
    "notes_personal",
    "notes_task",
    "notes_chat",
] as const;

export type ChangeCollection = (typeof CHANGE_COLLECTIONS)[number];

/** Collections whose token is team-wide (all but the per-project one). */
type TeamCollection = Exclude<ChangeCollection, "tasks_project">;

export type ChangeTokens = Record<TeamCollection, string> & { tasks_project: string | null };

/** Resolves `true` when it loaded. `false` or a rejection means it did not. */
export type Loader = () => Promise<boolean>;

export type LoaderGroups = Record<ChangeCollection, Loader[]>;

/**
 * The shape check for a `/changes/` body. Strict on purpose: a malformed 200
 * must read as a failure (full refresh), never as tokens. Storing `undefined`
 * would make the next tick compare `undefined === undefined` and suppress every
 * refresh until the backstop.
 */
export const parseChangeTokens = (data: unknown): ChangeTokens | null => {
    if (typeof data !== "object" || data === null) return null;
    const tokens = (data as { tokens?: unknown }).tokens;
    if (typeof tokens !== "object" || tokens === null) return null;
    const raw = tokens as Record<string, unknown>;
    for (const c of CHANGE_COLLECTIONS) {
        const v = raw[c];
        // Only the per-project token may be null (no project given, or one the
        // caller cannot open).
        if (c === "tasks_project" ? v !== null && typeof v !== "string" : typeof v !== "string") {
            return null;
        }
    }
    return raw as ChangeTokens;
};

export interface ChangeRefreshInput {
    /** `userId:teamId`, or null when there is no session / no team yet. */
    identity: string | null;
    /** The open project, if any: its token is asked for and kept per project. */
    projectId: number | null;
    /** Null when `/changes/` cannot be asked (no session): a plain full refresh. */
    fetchChanges: (() => Promise<unknown>) | null;
    /** The loaders of each collection, built from the CURRENT render. */
    groups: LoaderGroups;
}

export interface ChangeRefreshResult {
    /** Every loader was run (first run, backstop, or `/changes/` unusable). */
    full: boolean;
    /** Collections whose loaders were run. */
    ran: ChangeCollection[];
    /** Collections whose token was recorded (all their loaders succeeded). */
    stored: ChangeCollection[];
    /** `/changes/` failed or its body was unusable. */
    changesFailed: boolean;
}

export interface ChangeRefresher {
    run: (input: ChangeRefreshInput) => Promise<ChangeRefreshResult>;
    /** Forget every token and abandon any run still in flight. */
    reset: () => void;
}

export const createChangeRefresher = (now: () => number = Date.now): ChangeRefresher => {
    let identity: string | null | undefined;
    // Bumped by every reset: a run that started before it must not write a token
    // (or run its loaders) into the slate of the next session or team.
    let generation = 0;
    let teamTokens: Partial<Record<TeamCollection, string>> = {};
    let projectTokens = new Map<number, string>();
    let lastFullAt: number | null = null;

    const forget = () => {
        generation += 1;
        teamTokens = {};
        projectTokens = new Map();
        lastFullAt = null;
    };

    const runGroup = async (loaders: Loader[]): Promise<boolean> => {
        const settled = await Promise.allSettled(loaders.map(async (load) => load()));
        // `=== true`, not "did not reject": a loader that forgets to report
        // must not be taken for a success.
        return settled.every((r) => r.status === "fulfilled" && r.value === true);
    };

    const run = async (input: ChangeRefreshInput): Promise<ChangeRefreshResult> => {
        if (input.identity !== identity) {
            forget();
            identity = input.identity;
        }
        const myGeneration = generation;
        const startedAt = now();

        let tokens: ChangeTokens | null = null;
        if (input.fetchChanges) {
            try {
                tokens = parseChangeTokens(await input.fetchChanges());
            } catch {
                tokens = null;
            }
            // A team switch or sign-out while `/changes/` was in flight: the
            // loaders in `input` belong to the old session. The new one runs
            // its own first (full) refresh.
            if (myGeneration !== generation) {
                return { full: false, ran: [], stored: [], changesFailed: tokens === null };
            }
        }
        const changesFailed = input.fetchChanges !== null && tokens === null;
        const full =
            tokens === null ||
            lastFullAt === null ||
            startedAt - lastFullAt >= FULL_REFRESH_BACKSTOP_MS;
        if (full) {
            // Start from nothing: whatever succeeds below is recorded afresh, what
            // fails is retried at the next trigger, and a project not open now
            // gets a full look when it is next opened.
            teamTokens = {};
            projectTokens = new Map();
            if (tokens !== null) lastFullAt = startedAt;
        }

        const { projectId } = input;
        const due: ChangeCollection[] = [];
        for (const c of CHANGE_COLLECTIONS) {
            if (input.groups[c].length === 0) continue;
            if (full || tokens === null) {
                due.push(c);
                continue;
            }
            const seen = tokens[c];
            if (c === "tasks_project") {
                // A project is open but the server gave no token for it (it
                // would not say: no access, or an API that never saw the
                // project): nothing to compare, so load it and record nothing.
                if (seen === null || projectId === null || projectTokens.get(projectId) !== seen) {
                    due.push(c);
                }
            } else if (teamTokens[c] !== seen) {
                due.push(c);
            }
        }

        const stored: ChangeCollection[] = [];
        await Promise.all(
            due.map(async (c) => {
                const ok = await runGroup(input.groups[c]);
                if (!ok || tokens === null || myGeneration !== generation) return;
                const seen = tokens[c];
                if (c === "tasks_project") {
                    if (seen === null || projectId === null) return;
                    projectTokens.set(projectId, seen);
                } else {
                    teamTokens[c] = tokens[c];
                }
                stored.push(c);
            })
        );
        return { full, ran: due, stored, changesFailed };
    };

    return { run, reset: forget };
};

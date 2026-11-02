// Tasks-channel handlers. Consolidates the 4 single-purpose task workers
// (addTask, loadProjectTasks, loadTeamTasks, popSpecificProjectTasks).

import { loadProjectTasksFromApi } from "../../../features/tasks/services/loadProjectTasksFromApi";
import { loadTeamTasks } from "../../../features/tasks/services/loadTeamTasks";
import type { TaskTableProps } from "../../../types/tasks";
import { TaskRepository } from "../../repositories";
import { CheckpointRepository } from "../../repositories/checkpoints";
import { TaskService } from "../../services";
import type { TasksRequests } from "../contracts";
import type { HandlerMap } from "../poolWorker";
import { syncWithCheckpoint } from "../utils/syncWithCheckpoint";

const BATCH_SIZE = 1000;

// After a full reload that still left the store disagreeing with the server,
// another one would cost the same and change nothing. This long, that project
// is left alone; any other problem it has is the next delta's to find.
const FAILED_HEAL_RETRY_MS = 30 * 60 * 1000;

// A full load that evicts must not take a row the user saved while it was in
// flight: the answer was taken before the save, so it can't list it. A row
// stamped within this long BEFORE the answer's own time still counts as saved
// after it, to absorb clock skew between this browser and the server.
const SAVED_DURING_LOAD_MS = 60 * 1000;

const taskRepo = new TaskRepository();
const taskService = new TaskService();
const checkpointRepo = new CheckpointRepository();

// projectId -> when a forced full load last failed to make the store agree
// with the server. Lives as long as this worker, so a reload of the page
// starts afresh.
const failedHeals = new Map<number, number>();

// `updatedAt` reaches the store in three shapes: the server's `str(datetime)`
// ("2026-11-02 14:05:13.200904+00:00"), ISO ("...T...Z"), and the app's own
// zone-less local time ("2026-11-02 14:05:13"). `Date.parse` accepts the first
// and last only in some browsers (older Safari does not), so read them by
// hand. Anything else is null, and a row whose time is null is never treated
// as recent.
const TIMESTAMP =
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/;

const parseTimestamp = (value: unknown): number | null => {
    if (typeof value !== "string") return null;
    const m = TIMESTAMP.exec(value.trim());
    if (!m) return null;
    const [year, month, day, hour, minute] = [m[1], m[2], m[3], m[4], m[5]].map(Number);
    const second = Number(m[6] ?? 0);
    const millis = Number(`${m[7] ?? ""}000`.slice(0, 3));
    let time: number;
    if (m[8] === undefined) {
        time = new Date(year, month - 1, day, hour, minute, second, millis).getTime();
    } else {
        const sign = m[8].startsWith("-") ? -1 : 1;
        const digits = m[8].replace(/\D/g, "").padEnd(4, "0");
        const offsetMinutes =
            m[8] === "Z" ? 0 : sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2)));
        time =
            Date.UTC(year, month - 1, day, hour, minute, second, millis) - offsetMinutes * 60000;
    }
    return Number.isNaN(time) ? null : time;
};

export const tasksHandlers: HandlerMap<TasksRequests> = {
    addTask: async ({ task }) => {
        await taskRepo.put(task);
    },

    loadProjectTasks: async ({ myself, projectId, accessToken }) => {
        // Per-project checkpoint key so switching between projects
        // doesn't collide. The TASK_META store is shared across projects
        // (indexed by projectId), so it can never be `clear()`ed on a full
        // load — that would wipe sibling projects' tasks. A full load
        // replaces THIS project's rows instead (see the applier), and an
        // incremental one evicts the server's soft-deletes.
        //
        // "v2" (MIP-943): saves used to cache root rows with `parentTaskId`
        // as the text "null", which hid them from the table, and a row older
        // than its checkpoint is never sent again. A new key makes every
        // browser fetch each project in full once, which rewrites those rows.
        // Keep the "tasks:" prefix: `loadTeamTasks` forgets checkpoints by it.
        const key = `tasks:v2:${projectId}`;
        // What the server says we should hold once the delta is applied.
        // Only an answer to "what changed" carries it: a full answer is its
        // own proof, so there is nothing to check after one. Held in an
        // object because the forced reload below overwrites the answer
        // but must still be judged against the claim that prompted it.
        const claim = { count: null as number | null, idSum: null as number | null };
        // The `serverTime` of the answer being applied: the applier needs
        // it to tell a row saved mid-load from one that is simply stale.
        const answer = { serverTime: "" };
        const sync = () =>
            syncWithCheckpoint({
                key,
                fetcher: async (since) => {
                    const response = await loadProjectTasksFromApi(
                        myself,
                        projectId,
                        accessToken,
                        since
                    );
                    if (!response) {
                        throw new Error("Failed to load project tasks");
                    }
                    answer.serverTime = response.serverTime;
                    if (since !== null) {
                        claim.count = response.totalCount ?? null;
                        // An API that predates the sum leaves it undefined,
                        // and the count has to do alone.
                        claim.idSum = typeof response.idSum === "number" ? response.idSum : null;
                    }
                    return {
                        serverTime: response.serverTime,
                        data: response.tasks,
                        forceFull: response.forceFull,
                    };
                },
                applier: async (tasks, hadCheckpoint) => {
                    const toUpsert: TaskTableProps[] = [];
                    for (const t of tasks) {
                        if (t.isDeleted) {
                            // Backend always emits a string id; guard for the
                            // declared-nullable TS type only.
                            if (t.id) await taskRepo.delete(t.id);
                        } else {
                            const { isDeleted: _ignored, ...rest } = t;
                            toUpsert.push(rest);
                        }
                    }
                    for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
                        await taskRepo.batchInsert(toUpsert.slice(i, i + BATCH_SIZE));
                    }
                    if (hadCheckpoint) return;

                    // A full answer is every row this project has, so a row
                    // it doesn't mention is gone from the server — a task
                    // deleted for good, or a milestone removed by a bulk
                    // write — and upserting alone would keep it forever.
                    // After the upsert, not before, so a reader never sees
                    // the table half empty.
                    const answered = new Set(tasks.map((t) => String(t.id)));
                    const loadedAt = parseTimestamp(answer.serverTime);
                    const savedAfter = loadedAt === null ? null : loadedAt - SAVED_DURING_LOAD_MS;
                    for (const row of await taskRepo.getTasksByProject(projectId)) {
                        if (row.id == null || answered.has(String(row.id))) continue;
                        // Saved while this load was in flight, so the answer
                        // predates it. Evicting it would make a task the user
                        // just made vanish; the next delta restores or
                        // confirms it. Only a readable time protects a row.
                        const savedAt = parseTimestamp(row.updatedAt);
                        if (savedAfter !== null && savedAt !== null && savedAt > savedAfter) {
                            continue;
                        }
                        // The row's own key, not the string form: IndexedDB
                        // tells 5 from "5".
                        await taskRepo.delete(row.id);
                    }
                },
            });

        // Compare the store with what the server claimed. Null when they
        // agree or nothing was claimed; otherwise a line saying how.
        const disagreement = async (): Promise<string | null> => {
            if (claim.count === null && claim.idSum === null) return null;
            const rows = await taskRepo.getTasksByProject(projectId);
            if (claim.count !== null && rows.length !== claim.count) {
                return `${rows.length} rows held, server says ${claim.count}`;
            }
            if (claim.idSum !== null) {
                let sum = 0;
                for (const row of rows) sum += Number(row.id);
                // NaN (a row without a numeric id) never equals anything.
                if (sum !== claim.idSum) {
                    return `ids add up to ${sum}, server says ${claim.idSum}`;
                }
            }
            return null;
        };

        await sync();

        // A checkpoint claims we already hold everything older than it.
        // When that is untrue there is nothing in a later answer to reveal
        // it — a changes-since request cannot mention a row that has not
        // changed — so the store stays wrong for good: missing rows mean an
        // empty task table, board and dashboard (with a working single-task
        // preview beside them, because that path doesn't read this store);
        // surplus rows mean tasks that are gone from the server but still
        // listed here.
        //
        // Ways to get there, all of which happened: a full load that
        // returned nothing because the server was refusing the caller
        // (guests in a shared project, before the API was taught to answer
        // for them), `loadTeamTasks` below emptying the shared store out
        // from under this checkpoint, a share that arrives AFTER the
        // watermark — the guest's own new task lands, so the store isn't
        // empty, while the project's existing work never does — and a
        // delete the delta can't carry: a task removed for good leaves no
        // row to tombstone, and a bulk write skips the timestamp the delta
        // keys on.
        //
        // So the test is "different from what the server has", in either
        // direction, and not "fewer" or "none at all": one ghost and one
        // missing row balance a count, which is why the server also sends
        // the sum of the ids it expects. A server that predates the sum is
        // checked by count alone.
        //
        // Comparing is the client's half of the bargain; asking again is
        // cheap, and happens once per gap.
        if ((await disagreement()) === null) {
            failedHeals.delete(projectId);
            return;
        }
        const failedAt = failedHeals.get(projectId);
        if (failedAt !== undefined && Date.now() - failedAt < FAILED_HEAL_RETRY_MS) return;

        await checkpointRepo.forgetCheckpoint(key);
        await sync();

        // The full answer carries no claim, so this judges the store against
        // the one that prompted the reload. If it still differs, asking the
        // same question every time would only repeat the cost: the server's
        // count and its list disagree, or a row is being kept on purpose.
        const after = await disagreement();
        if (after === null) {
            failedHeals.delete(projectId);
            return;
        }
        failedHeals.set(projectId, Date.now());
        console.warn(
            `[loadProjectTasks] project ${projectId}: still out of step with the server after a full reload (${after}); not forcing another for 30 minutes`
        );
    },

    loadTeamTasks: async ({ myself, accessToken }) => {
        // Fetch ALL of it before touching the store. The loader returns
        // `undefined` when any page failed, and emptying the store first and
        // then having nothing to put back is the worst outcome here: every
        // per-project checkpoint below counts on this store being full.
        const taskList: TaskTableProps[] | undefined = await loadTeamTasks(myself, accessToken);
        if (!taskList) return;
        await taskRepo.clear();
        // The store this just emptied is the one every per-project
        // checkpoint counts on. Drop them together or each project's next
        // sync asks for changes-since and restores nothing.
        await checkpointRepo.forgetCheckpointsWithPrefix("tasks:");
        for (let i = 0; i < taskList.length; i += BATCH_SIZE) {
            await taskRepo.batchInsert(taskList.slice(i, i + BATCH_SIZE));
        }
    },

    popSpecificProjectTasks: async ({ projectId, targetStatuses }) => {
        const tasks = await taskService.getTasksByMultipleStatus(projectId, targetStatuses);
        return tasks ?? [];
    },
};

import { UserProps } from "../../../../types/admin";
import { TaskDependencyRef, TaskTableProps } from "../../../../types/tasks";
import { loadProjectTasksFromApi } from "../../services/loadProjectTasksFromApi";
import { loadTaskDependenciesForTasks } from "../../services/loadTaskDependencies";
import { TaskGraph } from "../types";

const MAX_DEPTH = 10; // mirrors backend `_cascade_tree_position_to_subtasks`

// Deeper than MAX_DEPTH: walking UP a chain is bounded by how deep the
// anchor sits, and bailing early would anchor the diagram mid-chain.
const MAX_ANCESTOR_DEPTH = 64;

/**
 * The top of the parent chain the anchor task sits in, resolved by
 * walking `parentTaskId` through the tasks we just fetched.
 *
 * Callers pass whatever task the user opened the diagram from, which may
 * be a leaf sub-task. The diagram has to anchor on the WHOLE hierarchy —
 * the milestone, the parent, the siblings — so it needs the chain top.
 *
 * This is deliberately computed rather than read from the stored
 * `rootTaskId`: that column is denormalized, and a row whose ancestor
 * moved between milestones can still be carrying the root it had before
 * the move. Trusting it meant opening the diagram on a tree the task had
 * already left (or, when the column was null, on the lone leaf itself).
 * The project's tasks are already in hand here, so walking up costs
 * nothing.
 */
const resolveChainTop = (anchorTaskId: number, byId: Map<number, TaskTableProps>): number => {
    let current = anchorTaskId;
    const visited = new Set<number>([current]);
    for (let hop = 0; hop < MAX_ANCESTOR_DEPTH; hop++) {
        const task = byId.get(current);
        if (!task || task.parentTaskId == null) return current;
        const parentId = Number(task.parentTaskId);
        // A parent outside the fetched set (deleted, or in another
        // project) makes the current row the highest one we can render.
        if (!byId.has(parentId)) return current;
        // Corrupt data: a cycle. Anchor here rather than spin.
        if (visited.has(parentId)) return current;
        visited.add(parentId);
        current = parentId;
    }
    return current;
};

const indexById = (allTasks: TaskTableProps[]): Map<number, TaskTableProps> => {
    const byId = new Map<number, TaskTableProps>();
    for (const t of allTasks) {
        if (t.id != null) byId.set(Number(t.id), t);
    }
    return byId;
};

/** Collect the root + every descendant via BFS over parent_task_id. */
const collectDescendantTree = (
    rootTaskId: number,
    allTasks: TaskTableProps[],
    byId: Map<number, TaskTableProps>
): TaskTableProps[] => {
    const byParent = new Map<number, TaskTableProps[]>();
    for (const t of allTasks) {
        const pid = t.parentTaskId == null ? null : Number(t.parentTaskId);
        if (pid == null) continue;
        const bucket = byParent.get(pid) ?? [];
        bucket.push(t);
        byParent.set(pid, bucket);
    }

    const out: TaskTableProps[] = [];
    const visited = new Set<number>();
    const root = byId.get(rootTaskId);
    if (!root) return [];
    out.push(root);
    visited.add(rootTaskId);

    let frontier = [rootTaskId];
    for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0; depth++) {
        const next: number[] = [];
        for (const parentId of frontier) {
            const kids = byParent.get(parentId) ?? [];
            for (const k of kids) {
                if (k.id == null) continue;
                const kid = Number(k.id);
                if (visited.has(kid)) continue;
                visited.add(kid);
                out.push(k);
                next.push(kid);
            }
        }
        frontier = next;
    }
    return out;
};

/**
 * Synthesize a minimal TaskTableProps shape from a TaskDependencyRef
 * so we can render a ghost card for an external endpoint. The fields
 * the card renders all exist on the ref (id, displayId, title,
 * status, projectId, projectName, isMilestone). Other fields are
 * filled with safe defaults — the ghost is read-only so they're
 * never edited.
 */
const refToGhostTask = (ref: TaskDependencyRef): TaskTableProps => {
    const statusLabel = ref.status?.status ?? null;
    return {
        id: String(ref.otherTaskId),
        displayId: ref.displayId,
        title: ref.title,
        priority: null,
        effortLevel: null,
        createdDate: null,
        updatedAt: null,
        dueDate: null,
        startDate: null,
        daysLeft: null,
        status: statusLabel,
        assigneeId: ref.assigneeUserId != null ? String(ref.assigneeUserId) : null,
        assigneeEmail: null,
        assigneeName: null,
        assigneeImgPath: null,
        parentTaskId: null,
        rootTaskId: null,
        threadId: null,
        tags: [],
        concatTags: null,
        teamId: null,
        projectId: ref.projectId,
        // Stash projectName on the row so the ghost card can show
        // "blocker lives in PROJECT-X" — the canvas reads it via a
        // cast (TaskTableProps proper has no `projectName` field;
        // ghosts are the only producer of one inside this graph).
        projectName: ref.projectName ?? null,
        isMilestone: ref.isMilestone,
        milestoneId: null,
        sprintId: null,
    } as TaskTableProps & { projectName?: string | null };
};

/**
 * Compose the data the diagram needs:
 *  1. Pull every task in the project (one network call, cache-warm).
 *  1b. Resolve the chain top above `anchorTaskId` (see
 *     `resolveChainTop`) — callers may hand us a leaf sub-task.
 *  2. BFS-filter to the root's descendant tree.
 *  3. Fetch dependency edges for every task in the visible set in
 *     parallel; flatten into a single dedup'd edge list (each edge
 *     appears once — the blocker side returns it as "blocking", the
 *     blocked side as "blockedBy", same row).
 *  4. For any dependency edge whose other endpoint is OUTSIDE the
 *     visible set, synthesize a ghost task from the ref data so the
 *     edge has somewhere to land on the canvas.
 */
export const loadTaskGraph = async (
    myself: UserProps,
    projectId: number,
    anchorTaskId: number,
    accessToken: string | null
): Promise<TaskGraph | null> => {
    const response = await loadProjectTasksFromApi(myself, projectId, accessToken, null);
    const allTasks = response?.tasks;
    if (!Array.isArray(allTasks)) return null;

    const byId = indexById(allTasks as TaskTableProps[]);
    const rootTaskId = resolveChainTop(anchorTaskId, byId);

    const visibleTasks = collectDescendantTree(rootTaskId, allTasks as TaskTableProps[], byId);
    if (visibleTasks.length === 0) return null;

    const visibleIds = new Set(visibleTasks.map((t) => Number(t.id)));

    // One batched request for the whole visible set (chunked at the
    // backend's cap) — per-node GETs meant N requests + N CORS
    // preflights for a single diagram open.
    const visibleTaskIds = visibleTasks.filter((t) => t.id != null).map((t) => Number(t.id));
    const depsByTask = await loadTaskDependenciesForTasks(visibleTaskIds, accessToken);

    const seen = new Set<number>();
    const dependencyEdges: TaskGraph["dependencyEdges"] = [];
    // Map keyed by the external task id so ghosts are deduped when
    // multiple visible tasks reference the same outside endpoint.
    const externalById = new Map<number, TaskTableProps>();

    visibleTaskIds.forEach((ownerTaskId) => {
        const res = depsByTask?.[ownerTaskId];
        if (!res) return;

        // Owner's "blocking" list: owner blocks otherTask.
        for (const d of res.blocking) {
            if (seen.has(d.dependencyId)) continue;
            seen.add(d.dependencyId);
            if (!visibleIds.has(d.otherTaskId)) {
                if (!externalById.has(d.otherTaskId)) {
                    externalById.set(d.otherTaskId, refToGhostTask(d));
                }
            }
            dependencyEdges.push({
                dependencyId: d.dependencyId,
                blockerTaskId: ownerTaskId,
                blockedTaskId: d.otherTaskId,
                otherStatus: d.status,
            });
        }

        // Owner's "blockedBy" list: otherTask blocks owner.
        for (const d of res.blockedBy) {
            if (seen.has(d.dependencyId)) continue;
            seen.add(d.dependencyId);
            if (!visibleIds.has(d.otherTaskId)) {
                if (!externalById.has(d.otherTaskId)) {
                    externalById.set(d.otherTaskId, refToGhostTask(d));
                }
            }
            dependencyEdges.push({
                dependencyId: d.dependencyId,
                blockerTaskId: d.otherTaskId,
                blockedTaskId: ownerTaskId,
                otherStatus: d.status,
            });
        }
    });

    return {
        rootTaskId,
        tasks: visibleTasks,
        externalTasks: Array.from(externalById.values()),
        dependencyEdges,
    };
};

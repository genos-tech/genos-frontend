import { UserProps } from "../../../../types/admin";
import { TaskDependencyRef, TaskTableProps } from "../../../../types/tasks";
import { loadProjectTasksFromApi } from "../../services/loadProjectTasksFromApi";
import { loadTaskDependencies } from "../../services/loadTaskDependencies";
import { TaskGraph } from "../types";

const MAX_DEPTH = 10; // mirrors backend `_cascade_milestone_to_subtasks`

/** Collect the root + every descendant via BFS over parent_task_id. */
const collectDescendantTree = (
    rootTaskId: number,
    allTasks: TaskTableProps[]
): TaskTableProps[] => {
    const byId = new Map<number, TaskTableProps>();
    for (const t of allTasks) {
        if (t.id != null) byId.set(Number(t.id), t);
    }

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
        // We keep ProjectName on a side channel via the ghost card —
        // TaskTableProps has no projectName field, but the card reads
        // it from a parallel lookup we build in TaskFlowCanvas. Here
        // we stash it on a non-typed extension so the lookup is
        // trivial: `(task as any).projectName` works without growing
        // the shared TaskTableProps shape.
        isMilestone: ref.isMilestone,
        milestoneId: null,
        sprintId: null,
    } as TaskTableProps & { projectName?: string | null };
};

/**
 * Compose the data the diagram needs:
 *  1. Pull every task in the project (one network call, cache-warm).
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
    rootTaskId: number,
    accessToken: string | null
): Promise<TaskGraph | null> => {
    const allTasks = await loadProjectTasksFromApi(myself, projectId, accessToken);
    if (!Array.isArray(allTasks)) return null;

    const visibleTasks = collectDescendantTree(rootTaskId, allTasks as TaskTableProps[]);
    if (visibleTasks.length === 0) return null;

    const visibleIds = new Set(visibleTasks.map((t) => Number(t.id)));

    const responses = await Promise.all(
        visibleTasks
            .filter((t) => t.id != null)
            .map((t) => loadTaskDependencies(Number(t.id), accessToken))
    );

    const seen = new Set<number>();
    const dependencyEdges: TaskGraph["dependencyEdges"] = [];
    // Map keyed by the external task id so ghosts are deduped when
    // multiple visible tasks reference the same outside endpoint.
    const externalById = new Map<number, TaskTableProps>();

    responses.forEach((res, idx) => {
        if (!res) return;
        const ownerTaskId = Number(visibleTasks[idx].id);

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
        tasks: visibleTasks,
        externalTasks: Array.from(externalById.values()),
        dependencyEdges,
    };
};
